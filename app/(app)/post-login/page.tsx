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
  Phone,
  Heart,
  Wrench,
  ArrowRight,
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

type Announcement = {
  id: string;
  title: string;
  content: string;
  category: string;
  publish_date: string;
  status: string;
};

type SupportListing = {
  id: string;
  title: string;
  description: string;
  category: string;
  contact: string | null;
  url: string | null;
  is_urgent: boolean;
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

function fmtDate(d: string) {
  const date = new Date(d);
  const today = new Date();
  const diff = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function progressPct(value: number, max: number) {
  if (max <= 0) return 0;
  return clamp(Math.round((value / max) * 100), 0, 100);
}

const CATEGORY_BORDER: Record<string, string> = {
  WELLNESS: "border-l-emerald-400",
  EVENT: "border-l-sky-400",
  REMINDER: "border-l-amber-400",
  GENERAL: "border-l-slate-300",
};

const CATEGORY_BADGE: Record<string, string> = {
  WELLNESS: "bg-emerald-50 text-emerald-700",
  EVENT: "bg-sky-50 text-sky-700",
  REMINDER: "bg-amber-50 text-amber-700",
  GENERAL: "bg-slate-50 text-slate-600",
};

export default function PostLoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [supportListings, setSupportListings] = useState<SupportListing[]>([]);
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

      try {
        const { data: ann } = await supabase
          .from("hr_announcements")
          .select("id, title, content, category, publish_date, status")
          .eq("status", "PUBLISHED")
          .order("publish_date", { ascending: false })
          .limit(4);
        if (alive) setAnnouncements(ann ?? []);
      } catch {
        if (alive) setAnnouncements([]);
      }

      try {
        const { data: support } = await supabase
          .from("support_directory")
          .select("id, title, description, category, contact, url, is_urgent")
          .eq("is_active", true)
          .order("is_urgent", { ascending: false })
          .limit(6);
        if (alive) setSupportListings(support ?? []);
      } catch {
        if (alive) setSupportListings([]);
      }

      const role: AppRole = (dbProfile?.role ??
        md?.role ??
        "EMPLOYEE") as AppRole;
      const deptRaw = (dbProfile?.department ??
        md?.department ??
        md?.dept ??
        "") as string;
      const department =
        String(role).toUpperCase() === "HR"
          ? "Human Resources"
          : deptRaw || "—";
      const joined_at = (dbProfile?.joined_at ??
        md?.joined_at ??
        u.created_at ??
        new Date().toISOString()) as string;
      const full_name = (dbProfile?.full_name ??
        md?.full_name ??
        md?.name ??
        "User") as string;
      const avatar_url = (dbProfile?.avatar_url ??
        md?.avatar_url ??
        null) as string | null;

      const total_xp = Number(gamRow?.total_xp ?? 0);
      const level = Number(gamRow?.level ?? 1);
      const days_streak = Number(gamRow?.current_streak ?? 0);

      setProfile({
        full_name,
        email: u.email ?? "",
        role,
        department,
        joined_at,
        avatar_url,
        level,
        total_xp,
        days_streak,
      });
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

  const levelInfo = useMemo(
    () => getLevelFromXP(profile?.total_xp ?? 0),
    [profile?.total_xp]
  );
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

  const supportIconMap: Record<string, React.ReactNode> = {
    CRISIS: <Phone size={18} />,
    COUNSELLING: <Heart size={18} />,
    SELF_HELP: <Wrench size={18} />,
    ONLINE: <Phone size={18} />,
    IN_PERSON: <Heart size={18} />,
  };

  const supportColorMap: Record<string, "teal" | "rose" | "amber"> = {
    CRISIS: "rose",
    COUNSELLING: "teal",
    SELF_HELP: "amber",
    ONLINE: "teal",
    IN_PERSON: "rose",
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-slate-900">Home</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome back. Here is your overview in BrainUp.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile card */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
              <div className="text-lg font-extrabold text-slate-900">
                {profile.full_name}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {roleLabel} • {profile.department}
              </div>
              <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {fmtJoined(profile.joined_at)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoBox
              label="Email"
              value={profile.email || "—"}
              icon={<Mail size={16} className="text-slate-500" />}
            />
            <InfoBox
              label="Role"
              value={roleLabel}
              icon={<BadgeCheck size={16} className="text-slate-500" />}
            />
            <InfoBox
              label="Department"
              value={profile.department || "—"}
              icon={<Building2 size={16} className="text-slate-500" />}
            />
            <InfoBox
              label="Days Streak"
              value={String(profile.days_streak)}
              icon={<Flame size={16} className="text-slate-500" />}
            />
            <InfoBox
              label="Level"
              value={`${profile.level} — ${levelInfo.title}`}
              icon={<Sparkles size={16} className="text-slate-500" />}
            />
            <InfoBox
              label="Total XP"
              value={String(profile.total_xp)}
              icon={<BarChart3 size={16} className="text-slate-500" />}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500">
                Level Progress
              </div>
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
                {levelInfo.xpNeeded - levelInfo.xpIntoLevel} XP to Level{" "}
                {levelInfo.nextLevel.level}
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

        {/* Today's Focus */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-slate-900">
            Today&#39;s Focus
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Add small tasks and tick them off when done.
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
              placeholder="Create a task..."
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            />
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
                  <span className="text-slate-400 group-hover:hidden">
                    <Circle size={18} />
                  </span>
                  <span className="hidden text-emerald-600 group-hover:inline-flex">
                    <CheckCircle2 size={18} />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {t.text}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Tip: Click a task to mark it complete (it will disappear).
          </div>
        </section>
      </div>

      {/* ANNOUNCEMENT BOARD */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">
              Announcement Board
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Updates posted by HR will appear here.
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition"
            onClick={() => router.push("/announcements")}
          >
            View all
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="mt-4">
          {announcements.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              No announcements yet. Check back soon.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className={[
                    "rounded-xl border border-slate-200 border-l-4 bg-white p-4 hover:shadow-sm transition-shadow duration-200",
                    CATEGORY_BORDER[a.category] ?? "border-l-slate-300",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-extrabold text-slate-900">
                      {a.title}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 shrink-0">
                      {fmtDate(a.publish_date)}
                    </div>
                  </div>
                  <div
                    className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                      CATEGORY_BADGE[a.category] ?? "bg-slate-50 text-slate-600"
                    }`}
                  >
                    {a.category}
                  </div>
                  <div className="mt-2 text-sm text-slate-600 line-clamp-2">
                    {a.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MENTAL HEALTH SUPPORT */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">
              Mental Health Support
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Verified resources posted by BrainUp admin.
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition"
            onClick={() => router.push("/support-directory")}
          >
            Open directory
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="mt-4">
          {supportListings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              No support resources available yet.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {supportListings.map((s) => (
                <SupportCard
                  key={s.id}
                  icon={supportIconMap[s.category] ?? <Heart size={18} />}
                  color={supportColorMap[s.category] ?? "teal"}
                  title={s.title}
                  desc={s.description}
                  contact={s.contact}
                  url={s.url}
                  isUrgent={s.is_urgent}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        {icon && <span className="inline-flex">{icon}</span>}
        <div className="text-xs font-bold text-slate-500">{label}</div>
      </div>
      <div className="mt-1 text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function SupportCard({
  icon,
  color,
  title,
  desc,
  contact,
  url,
  isUrgent,
}: {
  icon: React.ReactNode;
  color: "teal" | "rose" | "amber";
  title: string;
  desc: string;
  contact?: string | null;
  url?: string | null;
  isUrgent?: boolean;
}) {
  const colorMap = {
    teal: "bg-teal-50 text-teal-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm hover:border-slate-300 transition-all duration-200">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="text-sm font-extrabold text-slate-900">{title}</div>
          {isUrgent && (
            <span className="inline-flex rounded-full bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-700">URGENT</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{desc}</div>
        {contact && <div className="mt-1 text-xs font-bold text-cyan-600">{contact}</div>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs font-bold text-cyan-600 hover:underline block truncate">{url}</a>}
      </div>
    </div>
  );
}

function cryptoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}