"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Users,
  Activity,
  BookOpen,
  Trophy,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Plus,
  ArrowRight,
  Brain,
  NotebookPen,
  BarChart3,
  Shield,
} from "lucide-react";

type Stats = {
  totalUsers: number;
  activeUsers: number;
  totalEmployees: number;
  totalHR: number;
  totalCheckins: number;
  totalJournalEntries: number;
  totalXPAwarded: number;
  totalBadgesAwarded: number;
  flaggedUsers: number;
};

type AuditLog = {
  id: string;
  action: string;
  created_at: string;
};

type FocusTask = {
  id: string;
  text: string;
};

function getGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const [adminNumber, setAdminNumber] = useState("01");
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    totalEmployees: 0,
    totalHR: 0,
    totalCheckins: 0,
    totalJournalEntries: 0,
    totalXPAwarded: 0,
    totalBadgesAwarded: 0,
    flaggedUsers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [tasks, setTasks] = useState<FocusTask[]>([
    { id: "t1", text: "Review flagged employee reports" },
    { id: "t2", text: "Update support directory listings" },
    { id: "t3", text: "Check platform engagement stats" },
  ]);
  const [taskText, setTaskText] = useState("");

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [realName, setRealName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const md: any = session.user.user_metadata || {};
      const fullName = md?.full_name ?? "Admin";
      setAdminName(fullName);

      // Extract admin number e.g. "Admin 01" → "01"
      const match = fullName.match(/\d+/);
      if (match) setAdminNumber(match[0].padStart(2, "0"));

      // Show onboarding if real name hasn't been set yet
      if (fullName.startsWith("Admin")) {
        setShowOnboarding(true);
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const [
        { count: totalUsers },
        { count: totalEmployees },
        { count: totalHR },
        { count: totalCheckins },
        { count: activeUsers },
        { count: totalJournalEntries },
        { count: totalXPAwarded },
        { count: totalBadgesAwarded },
        { count: flaggedUsers },
        { data: recentXP },
      ] = await Promise.all([
        supabase.from("emotion_checkins").select("*", { count: "exact", head: true }),
        supabase.rpc("count_users_by_role", { role_param: "EMPLOYEE" }).maybeSingle(),
        supabase.rpc("count_users_by_role", { role_param: "HR" }).maybeSingle(),
        supabase.from("emotion_checkins").select("*", { count: "exact", head: true }),
        supabase.from("emotion_checkins").select("*", { count: "exact", head: true }).gte("checked_in_at", sevenDaysAgoISO),
        supabase.from("journal_entries").select("*", { count: "exact", head: true }),
        supabase.from("xp_transactions").select("*", { count: "exact", head: true }),
        supabase.from("user_badges").select("*", { count: "exact", head: true }),
        supabase.from("emotion_checkins").select("user_id", { count: "exact", head: true }).eq("emotion_level", 1).gte("checked_in_at", sevenDaysAgoISO),
        supabase.from("xp_transactions").select("activity_key, created_at").order("created_at", { ascending: false }).limit(8),
      ]);

      if (!alive) return;

      setStats({
        totalUsers: totalUsers ?? 0,
        activeUsers: activeUsers ?? 0,
        totalEmployees: totalEmployees ?? 0,
        totalHR: totalHR ?? 0,
        totalCheckins: totalCheckins ?? 0,
        totalJournalEntries: totalJournalEntries ?? 0,
        totalXPAwarded: totalXPAwarded ?? 0,
        totalBadgesAwarded: totalBadgesAwarded ?? 0,
        flaggedUsers: flaggedUsers ?? 0,
      });

      setRecentActivity(
        (recentXP ?? []).map((r: any, i: number) => ({
          id: String(i),
          action: formatActivity(r.activity_key),
          created_at: r.created_at,
        }))
      );

      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  async function saveRealName() {
    if (!realName.trim()) return;
    setSavingName(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.auth.updateUser({
      data: { full_name: realName.trim() }
    });

    await supabase
      .from("profiles")
      .update({ full_name: realName.trim() })
      .eq("id", session.user.id);

    setAdminName(realName.trim());
    setSavingName(false);
    setShowOnboarding(false);
  }

  function formatActivity(key: string) {
    const map: Record<string, string> = {
      daily_emotion_checkin: "Employee logged daily emotion",
      daily_journal_entry: "Employee wrote a journal entry",
      read_ei_resource: "Employee read an EI resource",
      full_ei_assessment: "Employee completed EI assessment",
      bookmark_resource: "Employee bookmarked a resource",
      breathing_exercise: "Employee completed breathing exercise",
      reflection_worksheet: "Employee completed reflection worksheet",
      ei_mini_quiz: "Employee completed EI mini quiz",
      weekly_reflection_review: "Employee completed weekly review",
    };
    return map[key] ?? key;
  }

  function addTask() {
    const text = taskText.trim();
    if (!text) return;
    setTasks(prev => [{ id: crypto.randomUUID(), text }, ...prev]);
    setTaskText("");
  }

  function completeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading admin dashboard...</p>
      </div>
    );
  }

  const platformHealthPct = stats.totalUsers > 0
    ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
    : 0;

  return (
    <div className="space-y-5">

      {/* ONBOARDING POPUP */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl mx-4">

            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm mb-4 text-3xl">
                👋
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                Welcome, Admin {adminNumber}!
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                You are now logged in as a BrainUp Administrator. Before you get started, tell us your real name so we can personalise your experience.
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase tracking-wider">
                  Your Real Name
                </label>
                <input
                  type="text"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveRealName(); }}
                  placeholder="e.g. Ahmad Faris"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"
                  autoFocus
                />
              </div>

              <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3">
                <div className="text-xs font-bold text-cyan-700 mb-1">Your Admin Account</div>
                <div className="text-xs text-cyan-600">
                  Account ID: <span className="font-extrabold">Admin {adminNumber}</span> — this is your permanent admin identifier.
                </div>
              </div>

              <button
                type="button"
                onClick={saveRealName}
                disabled={savingName || !realName.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 py-3 text-sm font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition"
              >
                {savingName ? "Saving..." : "Get Started →"}
              </button>

              <button
                type="button"
                onClick={() => setShowOnboarding(false)}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GREETING HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 p-6 shadow-lg">
        <div className="relative z-10">
          <div className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 className="text-2xl font-extrabold text-white">{getGreeting(adminName)}</h1>
          <p className="mt-1 text-sm text-white/80">
            Platform health is at <span className="font-extrabold text-white">{platformHealthPct}%</span> — {stats.flaggedUsers > 0 ? `${stats.flaggedUsers} users need attention.` : "everything looks good."}
          </p>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Users", value: stats.totalUsers, icon: <Users size={14} /> },
            { label: "Active (7d)", value: stats.activeUsers, icon: <Activity size={14} /> },
            { label: "Check-ins", value: stats.totalCheckins, icon: <Brain size={14} /> },
            { label: "XP Events", value: stats.totalXPAwarded, icon: <Trophy size={14} /> },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-white/70 mb-1">
                {s.icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
              </div>
              <div className="text-sm font-extrabold text-white">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -right-4 -bottom-10 h-28 w-28 rounded-full bg-white/10" />
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Employees", value: stats.totalEmployees, icon: <Users size={16} />, color: "blue" },
          { label: "HR Managers", value: stats.totalHR, icon: <Shield size={16} />, color: "cyan" },
          { label: "Journal Entries", value: stats.totalJournalEntries, icon: <NotebookPen size={16} />, color: "teal" },
          { label: "Badges Awarded", value: stats.totalBadgesAwarded, icon: <Trophy size={16} />, color: "amber" },
        ].map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* PLATFORM HEALTH + FLAGGED */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="glow-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-cyan-500" />
            <div className="text-sm font-extrabold text-slate-900">Platform Health</div>
          </div>

          <div className="space-y-3">
            {[
              { label: "Active users (7 days)", value: stats.activeUsers, total: stats.totalUsers, color: "from-teal-500 to-cyan-500" },
              { label: "Emotion check-ins", value: stats.totalCheckins, total: Math.max(stats.totalCheckins, 100), color: "from-cyan-500 to-sky-500" },
              { label: "Journal entries", value: stats.totalJournalEntries, total: Math.max(stats.totalJournalEntries, 100), color: "from-sky-500 to-blue-500" },
              { label: "Badges awarded", value: stats.totalBadgesAwarded, total: Math.max(stats.totalBadgesAwarded, 50), color: "from-amber-500 to-orange-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-600">{item.label}</span>
                  <span className="font-extrabold text-slate-900">{item.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-700`}
                    style={{ width: `${Math.min(100, Math.round((item.value / item.total) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className={`glow-card rounded-2xl border p-5 shadow-sm ${stats.flaggedUsers > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className={stats.flaggedUsers > 0 ? "text-amber-500" : "text-slate-400"} />
              <div className="text-sm font-extrabold text-slate-900">Flagged Users</div>
            </div>
            <div className={`text-3xl font-extrabold ${stats.flaggedUsers > 0 ? "text-amber-600" : "text-slate-400"}`}>
              {stats.flaggedUsers}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {stats.flaggedUsers > 0
                ? "Employees with 3+ low emotion check-ins in 7 days"
                : "No flagged users right now"}
            </div>
            {stats.flaggedUsers > 0 && (
              <button
                type="button"
                onClick={() => router.push("/admin/users")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-95 transition"
              >
                View Users
                <ArrowRight size={12} />
              </button>
            )}
          </section>

          <section className="glow-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-extrabold text-slate-900 mb-3">Quick Actions</div>
            <div className="space-y-2">
              {[
                { label: "Manage Users", href: "/admin/users", icon: <Users size={14} /> },
                { label: "EI Resources", href: "/admin/content?tab=resources", icon: <BookOpen size={14} /> },
                { label: "Gamification", href: "/admin/content?tab=gamification", icon: <Trophy size={14} /> },
                { label: "Support Directory", href: "/admin/support", icon: <BarChart3 size={14} /> },
              ].map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => router.push(a.href)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left hover:bg-cyan-50 hover:border-cyan-200 transition group"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-slate-500 group-hover:text-cyan-600 transition shadow-sm">
                    {a.icon}
                  </span>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-cyan-700 transition">{a.label}</span>
                  <ArrowRight size={13} className="ml-auto text-slate-300 group-hover:text-cyan-400 transition" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* RECENT ACTIVITY + TO DO */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="glow-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-slate-500" />
            <div className="text-sm font-extrabold text-slate-900">Recent Platform Activity</div>
          </div>

          {recentActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              No recent activity yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-500">
                    <Activity size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700 truncate">{log.action}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{timeAgo(log.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glow-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-extrabold text-slate-900">Admin To Do</div>
            <div className="text-xs text-slate-400">{tasks.length} remaining</div>
          </div>
          <div className="mt-1 text-xs text-slate-500 mb-4">Track your admin tasks here.</div>

          <div className="flex gap-2 mb-3">
            <input
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
              placeholder="Add a task..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"
            />
            <button
              type="button"
              onClick={addTask}
              className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white hover:opacity-95 transition"
            >
              <Plus size={15} />
            </button>
          </div>

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                All done. Add a new task above.
              </div>
            ) : (
              tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => completeTask(t.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-cyan-200 hover:bg-cyan-50 transition"
                >
                  <span className="text-slate-300 group-hover:text-cyan-400 transition">
                    <Circle size={16} />
                  </span>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-cyan-700 transition">{t.text}</span>
                  <CheckCircle2 size={14} className="ml-auto text-slate-200 group-hover:text-cyan-400 transition" />
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    cyan: "bg-cyan-50 text-cyan-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="glow-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex h-8 w-8 place-items-center grid rounded-xl ${colorMap[color]} mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs font-bold text-slate-500">{label}</div>
    </div>
  );
}