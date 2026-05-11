"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Users } from "lucide-react";

type MyProfile = {
  user_id: string;
  display_name: string;
  role: string;
  level: number;
  total_xp: number;
  current_streak: number;
  ei_score: number;
  avatar_url: string | null;
  avatar: Record<string, string>;
};

type PresenceRow = {
  user_id: string;
  display_name: string;
  role: string;
  level: number;
  total_xp: number;
  current_streak: number;
  ei_score: number;
  x: number;
  y: number;
  avatar: Record<string, string> | null;
  last_seen: string;
};

type AvatarMap = Record<string, string | null>;

export default function SocialPage() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const profileRef = useRef<MyProfile | null>(null);
  const avatarRef = useRef<Record<string, string>>({});
  const posRef = useRef({ x: 480, y: 280 });
  const presenceThrottle = useRef(0);

  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

  const postToWorld = useCallback((type: string, payload: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "brainup", type, payload },
      "*"
    );
  }, []);

  const getProfilePhotos = useCallback(async (userIds: string[]): Promise<AvatarMap> => {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const { data, error } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", uniqueIds);

    if (error) {
      console.error("Failed to load teammate profile photos:", error);
      return {};
    }

    return Object.fromEntries(
      (data ?? []).map((profile) => [profile.id, profile.avatar_url ?? null])
    );
  }, []);

  const toWorldPerson = useCallback((row: PresenceRow, avatarUrl?: string | null) => ({
    id: row.user_id,
    name: row.display_name,
    role: row.role,
    level: row.level,
    xp: row.total_xp,
    ei: row.ei_score,
    streak: row.current_streak,
    avatar: row.avatar ?? {},
    avatarUrl: avatarUrl ?? null,
    avatar_url: avatarUrl ?? null,
    x: row.x,
    y: row.y,
  }), []);

  const upsertPresence = useCallback(async (
    profile: MyProfile,
    avatar: Record<string, string>,
    pos: { x: number; y: number }
  ) => {
    const { error } = await supabase.from("social_presence").upsert({
      user_id: profile.user_id,
      display_name: profile.display_name,
      role: profile.role,
      level: profile.level,
      total_xp: profile.total_xp,
      current_streak: profile.current_streak,
      ei_score: profile.ei_score,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      avatar,
      last_seen: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) console.error("Failed to update social presence:", error);
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      const [
        { data: profile, error: profileError },
        { data: gami },
        { data: assessment },
        { data: savedPresence },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, nickname, role, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_gamification")
          .select("total_xp, level, current_streak")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("ei_assessment_results")
          .select("overall_score")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("social_presence")
          .select("avatar, x, y")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileError) {
        console.error("Failed to load social profile:", profileError);
      }

      if (!alive) return;

      const savedAvatar = (
        savedPresence?.avatar && Object.keys(savedPresence.avatar).length > 0
      ) ? savedPresence.avatar as Record<string, string> : {};

      const me: MyProfile = {
        user_id: user.id,
        display_name: profile?.nickname || profile?.full_name || "You",
        role: profile?.role ?? "EMPLOYEE",
        level: gami?.level ?? 1,
        total_xp: gami?.total_xp ?? 0,
        current_streak: gami?.current_streak ?? 0,
        ei_score: assessment?.overall_score ?? 0,
        avatar_url: profile?.avatar_url ?? null,
        avatar: savedAvatar,
      };

      if (typeof savedPresence?.x === "number" && typeof savedPresence?.y === "number") {
        posRef.current = { x: savedPresence.x, y: savedPresence.y };
      }

      setMyProfile(me);
      profileRef.current = me;
      avatarRef.current = savedAvatar;

      await upsertPresence(me, savedAvatar, posRef.current);
      setLoading(false);
    }

    load();
    return () => { alive = false; };
  }, [router, upsertPresence]);

  useEffect(() => {
    if (!iframeReady || !myProfile) return;

    postToWorld("INIT_ME", {
      id: myProfile.user_id,
      name: myProfile.display_name.split(" ")[0],
      role: myProfile.role,
      level: myProfile.level,
      xp: myProfile.total_xp,
      ei: myProfile.ei_score,
      streak: myProfile.current_streak,
      avatarUrl: myProfile.avatar_url,
      avatar_url: myProfile.avatar_url,
      avatar: myProfile.avatar,
      x: posRef.current.x,
      y: posRef.current.y,
    });
  }, [iframeReady, myProfile, postToWorld]);

  useEffect(() => {
    if (!myProfile) return;

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    async function loadOnlineMembers() {
      const { data, error } = await supabase
        .from("social_presence")
        .select("*")
        .neq("user_id", myProfile!.user_id)
        .gte("last_seen", fiveMinAgo);

      if (error) {
        console.error("Failed to load online members:", error);
        return;
      }

      const rows = (data ?? []) as PresenceRow[];
      if (rows.length === 0) return;

      const photoMap = await getProfilePhotos(rows.map((row) => row.user_id));
      postToWorld("UPDATE_OTHERS", rows.map((row) => toWorldPerson(row, photoMap[row.user_id])));
    }

    loadOnlineMembers();

    const presenceSub = supabase
      .channel("social_presence_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_presence" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<PresenceRow>;
            if (oldRow?.user_id && oldRow.user_id !== myProfile.user_id) {
              postToWorld("REMOVE_OTHER", { id: oldRow.user_id });
            }
            return;
          }

          const row = payload.new as PresenceRow;
          if (!row || row.user_id === myProfile.user_id) return;

          const photoMap = await getProfilePhotos([row.user_id]);
          postToWorld("UPDATE_OTHERS", [toWorldPerson(row, photoMap[row.user_id])]);
        }
      )
      .subscribe();

    const chatSub = supabase
      .channel("social_messages_rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "social_messages" },
        (payload) => {
          const msg = payload.new as {
            user_id: string;
            display_name: string;
            message: string;
            type?: string;
            emoteFrame?: number;
          };

          if (msg.user_id === myProfile.user_id) return;

          if (msg.type === "emote") {
            postToWorld("NEW_EMOTE", {
              user_id: msg.user_id,
              emoteFrame: msg.emoteFrame,
            });
            return;
          }

          postToWorld("NEW_CHAT", {
            user_id: msg.user_id,
            display_name: msg.display_name,
            message: msg.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceSub);
      supabase.removeChannel(chatSub);
    };
  }, [myProfile, postToWorld, getProfilePhotos, toWorldPerson]);

  useEffect(() => {
    if (!myProfile) return;

    async function handleMessage(event: MessageEvent) {
      if (event.data?.source !== "brainup-world") return;
      const { type, payload } = event.data;

      if (type === "NAVIGATE" && payload?.href) {
        router.push(payload.href);
        return;
      }

      if (type === "SEND_CHAT") {
        await supabase.from("social_messages").insert({
          user_id: myProfile!.user_id,
          display_name: myProfile!.display_name,
          role: myProfile!.role,
          message: payload.message,
          type: "chat",
        });
      }

      if (type === "SEND_EMOTE") {
        await supabase.from("social_messages").insert({
          user_id: myProfile!.user_id,
          display_name: myProfile!.display_name,
          role: myProfile!.role,
          message: "emote",
          type: "emote",
          emoteFrame: payload.emoteFrame,
        });
      }

      if (type === "SAVE_AVATAR") {
        avatarRef.current = payload.avatar;
        if (profileRef.current) {
          await upsertPresence(
            profileRef.current,
            payload.avatar,
            posRef.current
          );
        }
      }

      if (type === "PLAYER_MOVE") {
        posRef.current = { x: payload.x, y: payload.y };
        const now = Date.now();
        if (now - presenceThrottle.current > 900 && profileRef.current) {
          presenceThrottle.current = now;
          await upsertPresence(profileRef.current, avatarRef.current, posRef.current);
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [myProfile, router, upsertPresence]);

  useEffect(() => {
    if (!myProfile) return;

    const interval = setInterval(() => {
      if (profileRef.current) {
        upsertPresence(profileRef.current, avatarRef.current, posRef.current);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [myProfile, upsertPresence]);

  if (loading) return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-cyan-500" />
        <p className="text-sm font-semibold text-slate-500">
          Loading Social Area...
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
          <Users size={16} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Social Area
          </h1>
          <p className="text-sm text-slate-500">
            Walk around BrainUp HQ · connect with your team
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-700 flex items-center gap-2 flex-wrap">
        <span className="font-bold">Controls:</span>
        {["W", "A", "S", "D"].map(k => (
          <kbd key={k} className="rounded border border-cyan-300 bg-white px-1.5 py-0.5 font-mono text-xs">
            {k}
          </kbd>
        ))}
        <span>or arrow keys to move ·</span>
        <kbd className="rounded border border-cyan-300 bg-white px-1.5 py-0.5 font-mono text-xs">E</kbd>
        <span>to interact · hover teammates to see profile · use 1–5 for emotes · 👤 to customise avatar</span>
      </div>

      <div
        className="overflow-hidden rounded-3xl border-2 border-slate-200 shadow-xl"
        style={{ height: "75vh" }}
      >
        <iframe
          ref={iframeRef}
          src="/social-world-phaser.html?v=character07-final-2"
          className="h-full w-full border-0"
          title="BrainUp Social Area"
          onLoad={() => {
            setTimeout(() => setIframeReady(true), 400);
          }}
        />
      </div>
    </div>
  );
}
