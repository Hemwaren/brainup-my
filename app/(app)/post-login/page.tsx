// app/(app)/post-login/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getLevelFromXP } from "@/lib/gamification";
import {
  UserCircle2,
  Mail,
  BadgeCheck,
  Building2,
  Flame,
  Sparkles,
  Plus,
  Circle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";

type AppRole = "EMPLOYEE" | "HR" | "ADMIN" | string;

type Profile = {
  full_name: string;
  email: string;
  role: AppRole;
  department: string;
  joined_at: string;
  avatar_url?: string | null;
  level: number;
  total_xp: number;
  days_streak: number;
};

type FocusTask = {
  id: string;
  text: string;
};

function fmtJoined(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Joined recently";
  return `Joined ${d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function progressPct(value: number, max: number) {
  if (max <= 0) return 0;
  return clamp(Math.round((value / max) * 100), 0, 100);
}

export default function PostLoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [taskText, setTaskText] = useState("");
  const [tasks, setTasks] = useState<FocusTask[]>([
    { id: "t1", text: "Complete EI Assessment module" },
    { id: "t2", text: "Write a short journal entry" },
  ]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;

      if (error || !data?.user) {
        setLoading(false);
        router.push("/auth");
        return;
      }

      const u = data.user;
      const md: any = u.user_metadata || {};

      // Fetch profiles table
      let dbProfile: any = null;
      try {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, role, department, joined_at, avatar_url")
          .eq("id", u.id)
          .maybeSingle();
        dbProfile = p || null;
      } catch {
        dbProfile = null;
      }

      // ✅ Fetch gamification data separately
      let gamRow: any = null;
      try {
        const { data: g } = await supabase
          .from("user_gamification")
          .select("total_xp, level, current_streak")
          .eq("user_id", u.id)
          .maybeSingle();
        gamRow = g || null;
      } catch {
        gamRow = null;
      }

      const role: AppRole = (dbProfile?.role ?? md?.role ?? "EMPLOYEE") as AppRole;
      const deptRaw = (dbProfile?.department ?? md?.department ?? md?.dept ?? "") as string;
      const department = String(role).toUpperCase() === "HR" ? "Human Resources" : deptRaw || "—";
      const joined_at = (dbProfile?.joined_at ?? md?.joined_at ?? u.created_at ?? new Date().toISOString()) as string;
      const full_name = (dbProfile?.full_name ?? md?.full_name ?? md?.name ?? "User") as string;
      const avatar_url = (dbProfile?.avatar_url ?? md?.avatar_url ?? null) as string | null;

      // ✅ Use gamification table values, fall back to 0
      const total_xp = Number(gamRow?.total_xp ?? 0);
      const level = Number(gamRow?.level ?? 1);
      const days_streak = Number(gamRow?.current_streak ?? 0);

      const built: Profile = {
        full_name,
        email: u.email ?? "",
        role,
        department,
        joined_at,
        avatar_url,
        level,
        total_xp,
        days_streak,
      };

      setProfile(built);
      setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  const roleLabel = useMemo(() => {
    const r = String(profile?.role || "EMPLOYEE").toUpperCase();
    if (r === "HR") return "HR Manager";
    if (r === "ADMIN") return "Admin";
    return "Employee";
  }, [profile?.role]);

  // ✅ Use real level table thresholds
  const levelInfo = useMemo(() => getLevelFromXP(profile?.total_xp ?? 0), [profile?.total_xp]);
  const levelProgress = progressPct(levelInfo.xpIntoLevel, levelInfo.xpNeeded);

  function addTask() {
    const text = taskText.trim();
    if (!text) return;
    setTasks((prev) => [{ id: cryptoId(), text }, ...prev]);
    setTaskText("");
  }

  function completeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading || !profile) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-slate-900">Home</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome back. Here's your overview in BrainUp.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="grid h-24 w-24 place-items-center rounded-full border border-slate-200 bg-slate-50">
                  <UserCircle2 className="text-slate-400" size={44} />
                </div>
                <button
                  type="button"
                  className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                  aria-label="Edit profile"
                  onClick={() => router.push("/profile")}
                >
                  <UserCircle2 size={16} className="text-slate-700" />
                </button>
              </div>

              <div>
                <div className="text-lg font-extrabold text-slate-900">{profile.full_name}</div>
                <div className="mt-1 text-sm text-slate-600">{roleLabel} • {profile.department}</div>
                <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {fmtJoined(profile.joined_at)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoBox label="Email" value={profile.email || "—"} icon={<Mail size={16} className="text-slate-500" />} />
            <InfoBox label="Role" value={roleLabel} icon={<BadgeCheck size={16} className="text-slate-500" />} />
            <InfoBox label="Department" value={profile.department || "—"} icon={<Building2 size={16} className="text-slate-500" />} />
            <InfoBox label="Days Streak" value={`${profile.days_streak}`} icon={<Flame size={16} className="text-slate-500" />} />
            <InfoBox label="Level" value={`${profile.level} — ${levelInfo.title}`} icon={<Sparkles size={16} className="text-slate-500" />} />
            <InfoBox label="Total XP" value={`${profile.total_xp}`} icon={<BarChart3 size={16} className="text-slate-500" />} />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500">Level Progress</div>
              <div className="text-xs font-extrabold text-slate-900">
                {levelInfo.xpIntoLevel} / {levelInfo.xpNeeded} XP
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            {levelInfo.nextLevel && (
              <div className="mt-2 text-xs text-slate-500">
                {levelInfo.xpNeeded - levelInfo.xpIntoLevel} XP to Level {levelInfo.nextLevel.level}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              Settings
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <div className="text-base font-extrabold text-slate-900">Today's Focus</div>
            <div className="mt-1 text-sm text-slate-600">Add small tasks and tick them off when done.</div>
          </div>

          <div className="mt-4 flex gap-2">
            <div className="flex-1">
              <input
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                placeholder="Create a task..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>
            <button
              type="button"
              onClick={addTask}
              className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white hover:opacity-95"
              aria-label="Add task"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No tasks yet. Add your first one.
              </div>
            ) : (
              tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => completeTask(t.id)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                  aria-label="Complete task"
                >
                  <span className="text-slate-400 group-hover:hidden"><Circle size={18} /></span>
                  <span className="hidden text-emerald-600 group-hover:inline-flex"><CheckCircle2 size={18} /></span>
                  <span className="text-sm font-semibold text-slate-800">{t.text}</span>
                </button>
              ))
            )}
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Tip: Click a task to mark it complete (it will disappear).
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">Announcement Board</div>
            <div className="mt-1 text-sm text-slate-600">Updates posted by HR will appear here.</div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            onClick={() => router.push("/announcements")}
          >
            View all
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <AnnouncementCard title="Welcome to BrainUp" meta="Today" body="Complete your first activity and start building your progress." />
          <AnnouncementCard title="EI Assessment" meta="This week" body="Try the EI Assessment to discover your current level." />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">Mental Health Support Directory</div>
            <div className="mt-1 text-sm text-slate-600">Verified resources posted by BrainUp admin.</div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            onClick={() => router.push("/support-directory")}
          >
            Open directory
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MiniCard title="Counselling Hotline" desc="Contact details and hours." />
          <MiniCard title="Company EAP" desc="Employee assistance program info." />
          <MiniCard title="Self-help Toolkit" desc="Breathing, grounding, and tips." />
        </div>
      </section>
    </div>
  );
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        {icon ? <span className="inline-flex">{icon}</span> : null}
        <div className="text-xs font-bold text-slate-500">{label}</div>
      </div>
      <div className="mt-1 text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function AnnouncementCard({ title, meta, body }: { title: string; meta: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <div className="text-[11px] font-bold text-slate-500">{meta}</div>
      </div>
      <div className="mt-2 text-sm text-slate-600">{body}</div>
    </div>
  );
}

function MiniCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
      <div className="text-sm font-extrabold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
    </div>
  );
}

function cryptoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}