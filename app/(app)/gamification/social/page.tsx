"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  avatar: Record<string, string>;
  last_seen: string;
};

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

  // ── Send message to iframe ──────────────────────────────────────────────────
  const postToWorld = useCallback((type: string, payload: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "brainup", type, payload }, "*"
    );
  }, []);

  // ── Upsert presence to Supabase ────────────────────────────────────────────
  const upsertPresence = useCallback(async (
    profile: MyProfile,
    avatar: Record<string, string>,
    pos: { x: number; y: number }
  ) => {
    await supabase.from("social_presence").upsert({
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
  }, []);

  // ── Load profile + gamification data ───────────────────────────────────────
  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      const [
        { data: profile },
        { data: gami },
        { data: assessment },
        { data: savedPresence },
      ] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
        supabase.from("user_gamification").select("total_xp, level, current_streak").eq("user_id", user.id).maybeSingle(),
        supabase.from("assessment_results").select("ei_score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("social_presence").select("avatar, x, y").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!alive) return;

      const savedAvatar = (
        savedPresence?.avatar && Object.keys(savedPresence.avatar).length > 0
      ) ? savedPresence.avatar as Record<string, string> : {};

      const me: MyProfile = {
        user_id: user.id,
        display_name: profile?.full_name ?? "You",
        role: profile?.role ?? "EMPLOYEE",
        level: gami?.level ?? 1,
        total_xp: gami?.total_xp ?? 0,
        current_streak: gami?.current_streak ?? 0,
        ei_score: assessment?.ei_score ?? 0,
        avatar: savedAvatar,
      };

      if (savedPresence?.x) {
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

  // ── Send real data to iframe once it's ready ───────────────────────────────
  useEffect(() => {
    if (!iframeReady || !myProfile) return;
    postToWorld("INIT_ME", {
      name: myProfile.display_name.split(" ")[0],
      role: myProfile.role,
      level: myProfile.level,
      xp: myProfile.total_xp,
      ei: myProfile.ei_score,
      streak: myProfile.current_streak,
      avatar: myProfile.avatar,
    });
  }, [iframeReady, myProfile, postToWorld]);

  // ── Realtime: presence + chat ──────────────────────────────────────────────
  useEffect(() => {
    if (!myProfile) return;

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Load existing online members first
    supabase
      .from("social_presence")
      .select("*")
      .neq("user_id", myProfile.user_id)
      .gte("last_seen", fiveMinAgo)
      .then(({ data }) => {
        if (data && data.length > 0) {
          postToWorld("UPDATE_OTHERS", data.map(p => ({
            id: p.user_id,
            name: p.display_name,
            role: p.role,
            level: p.level,
            xp: p.total_xp,
            ei: p.ei_score,
            streak: p.current_streak,
            avatar: p.avatar,
            x: p.x,
            y: p.y,
          })));
        }
      });

    // Realtime presence changes
    const presenceSub = supabase
      .channel("social_presence_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_presence" },
        (payload) => {
          const row = payload.new as PresenceRow;
          if (!row || row.user_id === myProfile.user_id) return;
          postToWorld("UPDATE_OTHERS", [{
            id: row.user_id,
            name: row.display_name,
            role: row.role,
            level: row.level,
            xp: row.total_xp,
            ei: row.ei_score,
            streak: row.current_streak,
            avatar: row.avatar,
            x: row.x,
            y: row.y,
          }]);
        }
      )
      .subscribe();

    // Realtime new chat messages
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
          };
          if (msg.user_id === myProfile.user_id) return;
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
  }, [myProfile, postToWorld]);

  // ── Listen for messages FROM the iframe ───────────────────────────────────
  useEffect(() => {
    if (!myProfile) return;

    async function handleMessage(event: MessageEvent) {
      if (event.data?.source !== "brainup-world") return;
      const { type, payload } = event.data;

      if (type === "SEND_CHAT") {
        await supabase.from("social_messages").insert({
          user_id: myProfile!.user_id,
          display_name: myProfile!.display_name,
          role: myProfile!.role,
          message: payload.message,
          type: "chat",
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
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [myProfile, upsertPresence]);

  // ── Heartbeat: keep presence alive every 30s ──────────────────────────────
  useEffect(() => {
    if (!myProfile) return;
    const interval = setInterval(() => {
      if (profileRef.current) {
        upsertPresence(profileRef.current, avatarRef.current, posRef.current);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [myProfile, upsertPresence]);

  // ─────────────────────────────────────────────────────────────────────────
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

      {/* Header */}
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

      {/* Controls hint */}
      <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-700 flex items-center gap-2 flex-wrap">
        <span className="font-bold">Controls:</span>
        {["W", "A", "S", "D"].map(k => (
          <kbd key={k} className="rounded border border-cyan-300 bg-white px-1.5 py-0.5 font-mono text-xs">
            {k}
          </kbd>
        ))}
        <span>or arrow keys to move ·</span>
        <kbd className="rounded border border-cyan-300 bg-white px-1.5 py-0.5 font-mono text-xs">E</kbd>
        <span>to chat · hover teammates to see profile · 👤 to customise avatar</span>
      </div>

      {/* Pixel world iframe */}
      <div
        className="overflow-hidden rounded-3xl border-2 border-slate-200 shadow-xl"
        style={{ height: "75vh" }}
      >
        <iframe
          ref={iframeRef}
          src="/social-world.html"
          className="h-full w-full border-0"
          title="BrainUp Social Area"
          onLoad={() => {
            // Give iframe JS time to fully initialise before sending data
            setTimeout(() => setIframeReady(true), 400);
          }}
        />
      </div>
    </div>
  );
}