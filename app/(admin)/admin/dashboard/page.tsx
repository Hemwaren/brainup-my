"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Users, Activity, BookOpen, Trophy, TrendingUp, AlertTriangle,
  CheckCircle2, Circle, Plus, ArrowRight, Brain, NotebookPen,
  BarChart3, Shield, Clock, Trash2, Save, Loader2, ChevronDown,
  Check, Settings, AlertCircle,
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

type CheckinWindow = {
  id: string;
  label: string;
  start: string;
  end: string;
  is_active: boolean;
};

const PRESET_LABELS = ["Morning", "Late Morning", "Afternoon", "Late Afternoon", "Evening"];

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

// ─── Time Dropdown ────────────────────────────────────────
function TimeDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const times: string[] = [];
  for (let h = 6; h <= 22; h++) {
    times.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) times.push(`${String(h).padStart(2, "0")}:30`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center justify-between gap-2 min-w-[100px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
          open
            ? "border-cyan-400 bg-white shadow-[0_0_0_3px_rgba(6,182,212,0.15)]"
            : "border-slate-200 bg-white hover:border-cyan-300"
        } text-slate-800`}
      >
        <Clock size={12} className="text-cyan-500" />
        {value}
        <ChevronDown size={11} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="p-1">
            {times.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { onChange(t); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  value === t ? "bg-cyan-500 text-white" : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700"
                }`}
              >
                {t}
                {value === t && <Check size={11} className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const [adminNumber, setAdminNumber] = useState("01");
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, activeUsers: 0, totalEmployees: 0, totalHR: 0,
    totalCheckins: 0, totalJournalEntries: 0, totalXPAwarded: 0,
    totalBadgesAwarded: 0, flaggedUsers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [tasks, setTasks] = useState<FocusTask[]>([
    { id: "t1", text: "Review flagged employee reports" },
    { id: "t2", text: "Update support directory listings" },
    { id: "t3", text: "Check platform engagement stats" },
  ]);
  const [taskText, setTaskText] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [realName, setRealName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // ─── Check-in Windows state ───────────────────────────
  const [windows, setWindows] = useState<CheckinWindow[]>([]);
  const [windowsSaving, setWindowsSaving] = useState(false);
  const [windowsMsg, setWindowsMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const md: any = session.user.user_metadata || {};
      const fullName = md?.full_name ?? "Admin";
      setAdminName(fullName);
      const match = fullName.match(/\d+/);
      if (match) setAdminNumber(match[0].padStart(2, "0"));
      if (fullName.startsWith("Admin")) setShowOnboarding(true);

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
        { data: settingsRow },
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
        supabase.from("platform_settings").select("value").eq("key", "checkin_windows").single(),
      ]);

      if (!alive) return;

      setStats({
        totalUsers: totalUsers ?? 0, activeUsers: activeUsers ?? 0,
        totalEmployees: totalEmployees ?? 0, totalHR: totalHR ?? 0,
        totalCheckins: totalCheckins ?? 0, totalJournalEntries: totalJournalEntries ?? 0,
        totalXPAwarded: totalXPAwarded ?? 0, totalBadgesAwarded: totalBadgesAwarded ?? 0,
        flaggedUsers: flaggedUsers ?? 0,
      });

      setRecentActivity(
        (recentXP ?? []).map((r: any, i: number) => ({
          id: String(i),
          action: formatActivity(r.activity_key),
          created_at: r.created_at,
        }))
      );

      setWindows((settingsRow?.value ?? []) as CheckinWindow[]);
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
    await supabase.auth.updateUser({ data: { full_name: realName.trim() } });
    await supabase.from("profiles").update({ full_name: realName.trim() }).eq("id", session.user.id);
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

  // ─── Window handlers ──────────────────────────────────
  function showWindowsMsg(text: string, type: "success" | "error" = "success") {
    setWindowsMsg({ text, type });
    setTimeout(() => setWindowsMsg(null), 3000);
  }

  function addWindow() {
    const usedLabels = windows.map(w => w.label);
    const nextLabel = PRESET_LABELS.find(p => !usedLabels.includes(p)) ?? `Window ${windows.length + 1}`;
    setWindows([...windows, { id: `w_${Date.now()}`, label: nextLabel, start: "09:00", end: "10:30", is_active: true }]);
  }

  function removeWindow(id: string) {
    setWindows(windows.filter(w => w.id !== id));
  }

  function updateWindow(id: string, patch: Partial<CheckinWindow>) {
    setWindows(windows.map(w => w.id === id ? { ...w, ...patch } : w));
  }

  async function saveWindows() {
    for (const w of windows) {
      if (!w.label.trim()) return showWindowsMsg("All windows must have a label.", "error");
      if (w.start >= w.end) return showWindowsMsg(`"${w.label}" — start must be before end time.`, "error");
    }
    setWindowsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: windows, updated_at: new Date().toISOString(), updated_by: session?.user.id })
      .eq("key", "checkin_windows");
    setWindowsSaving(false);
    if (error) showWindowsMsg(`Failed: ${error.message}`, "error");
    else showWindowsMsg("Check-in windows saved! Employees will see updated slots immediately.", "success");
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
            <div className="text-center mb-6">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm mb-4 text-3xl">
                👋
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">Welcome, Admin {adminNumber}!</h2>
              <p className="mt-2 text-sm text-slate-500">
                You are now logged in as a BrainUp Administrator. Before you get started, tell us your real name.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase tracking-wider">Your Real Name</label>
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
                <div className="text-xs text-cyan-600">Account ID: <span className="font-extrabold">Admin {adminNumber}</span></div>
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
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
          <section className={`rounded-2xl border p-5 shadow-sm ${stats.flaggedUsers > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className={stats.flaggedUsers > 0 ? "text-amber-500" : "text-slate-400"} />
              <div className="text-sm font-extrabold text-slate-900">Flagged Users</div>
            </div>
            <div className={`text-3xl font-extrabold ${stats.flaggedUsers > 0 ? "text-amber-600" : "text-slate-400"}`}>
              {stats.flaggedUsers}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {stats.flaggedUsers > 0 ? "Employees with 3+ low emotion check-ins in 7 days" : "No flagged users right now"}
            </div>
            {stats.flaggedUsers > 0 && (
              <button
                type="button"
                onClick={() => router.push("/admin/users")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-95 transition"
              >
                View Users <ArrowRight size={12} />
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

      {/* ─── CHECK-IN WINDOWS ──────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-50 text-cyan-600">
                <Settings size={14} />
              </div>
              <div className="text-sm font-extrabold text-slate-900">Check-in Time Windows</div>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 max-w-lg">
              Configure when employees can submit emotion check-ins. Changes take effect immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={addWindow}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-extrabold text-cyan-700 hover:bg-cyan-100 transition shrink-0"
          >
            <Plus size={13} />Add Window
          </button>
        </div>

        {windowsMsg && (
          <div className={`mb-4 rounded-xl border px-4 py-2.5 text-xs font-bold ${
            windowsMsg.type === "success"
              ? "border-cyan-200 bg-cyan-50 text-cyan-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}>
            <span className="inline-flex items-center gap-2">
              {windowsMsg.type === "success" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {windowsMsg.text}
            </span>
          </div>
        )}

        <div className="space-y-2.5">
          {windows.map((w, i) => (
            <div key={w.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 text-white text-[10px] font-extrabold shrink-0">
                  {i + 1}
                </div>
                <input
                  type="text"
                  value={w.label}
                  onChange={(e) => updateWindow(w.id, { label: e.target.value })}
                  placeholder="Window name"
                  className="flex-1 min-w-[100px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition"
                />
                <div className="flex items-center gap-1.5">
                  <TimeDropdown value={w.start} onChange={(v) => updateWindow(w.id, { start: v })} />
                  <span className="text-xs font-extrabold text-slate-400">→</span>
                  <TimeDropdown value={w.end} onChange={(v) => updateWindow(w.id, { end: v })} />
                </div>
                <button
                  type="button"
                  onClick={() => updateWindow(w.id, { is_active: !w.is_active })}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold transition ${
                    w.is_active
                      ? "bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100"
                      : "bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${w.is_active ? "bg-cyan-500" : "bg-slate-400"}`} />
                  {w.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => removeWindow(w.id)}
                  className="grid h-7 w-7 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}

          {windows.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <Clock size={20} className="mx-auto text-slate-300 mb-2" />
              <div className="text-xs font-bold text-slate-500">No windows configured. Click Add Window.</div>
            </div>
          )}
        </div>

        {windows.length > 0 && (
          <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-2 flex flex-wrap items-center gap-3 text-[11px]">
            <span className="font-extrabold text-slate-600">{windows.length} windows</span>
            <span className="text-slate-300">·</span>
            <span className="font-extrabold text-cyan-600">{windows.filter(w => w.is_active).length} active</span>
            <span className="text-slate-300">·</span>
            <span className="font-bold text-slate-500">Coverage: {windows[0]?.start} — {windows[windows.length - 1]?.end}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={saveWindows}
            disabled={windowsSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-4 py-2 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-50 shadow-sm"
          >
            {windowsSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {windowsSaving ? "Saving..." : "Save Windows"}
          </button>
          <p className="text-[11px] text-slate-400">Employees see updated slots on next refresh.</p>
        </div>
      </section>

      {/* RECENT ACTIVITY + TO DO */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-slate-500" />
            <div className="text-sm font-extrabold text-slate-900">Recent Platform Activity</div>
          </div>
          {recentActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">No recent activity yet.</div>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">All done. Add a new task above.</div>
            ) : (
              tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => completeTask(t.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-cyan-200 hover:bg-cyan-50 transition"
                >
                  <span className="text-slate-300 group-hover:text-cyan-400 transition"><Circle size={16} /></span>
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

function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    cyan: "bg-cyan-50 text-cyan-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${colorMap[color]} mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs font-bold text-slate-500">{label}</div>
    </div>
  );
}