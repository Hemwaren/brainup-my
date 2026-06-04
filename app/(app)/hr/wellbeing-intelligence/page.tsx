"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  BrainCircuit, Users, ChevronRight, RefreshCw, Loader2,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  CalendarCheck, Sparkles, MessageSquare, UserCheck, Send,
  ClipboardList, X, ArrowLeft, Activity, Target, Mail, Calendar,
  Monitor, WifiOff, ChevronDown, ArrowUpDown, Info,
} from "lucide-react";

type RiskLevel = "THRIVING" | "MONITOR" | "NEEDS ATTENTION" | "CRITICAL";
type SortKey = "risk_score" | "name" | "department" | "work_signal";

interface TeamEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
  avatar_url: string | null;
  google_connected: boolean;
  risk_score: number;
  risk_level: RiskLevel;
  signals: {
    calendar: { meeting_hours: number; after_hours: number; signal: string; score: number };
    gmail: { sent_this_week: number; after_hours_emails: number; signal: string; score: number };
    inapp: { mood_avg: number; mood_signal: string; journal_count: number; ei_score: number; last_login_days: number; score: number };
    work_behaviour: { active_minutes: number; idle_minutes: number; idle_spikes: number; signal: string; score: number };
  };
}

interface EmployeeReport {
  employee: { id: string; name: string; department: string; avatar_url: string | null; google_connected: boolean };
  risk_score: number;
  risk_level: RiskLevel;
  signals: {
    calendar: { meeting_hours_this_week: number; meeting_hours_last_week: number; after_hours_meetings: number; back_to_back_meetings: number; focus_time_ratio: number; signal: string; score: number; is_mock: boolean };
    gmail: { emails_sent_this_week: number; emails_sent_last_week: number; after_hours_emails: number; volume_delta: number; signal: string; score: number; is_mock: boolean };
    inapp: {
      mood: { avg: number; delta: number; low_mood_days: number; checkin_count: number; recent_emotions: string[]; signal: string };
      journal: { count: number; delta: number; tone: string; signal: string };
      ei: { latest_score: number | null; delta: number; weakest_dimension: string; brain_style: string | null; ea: number | null; eu: number | null; eus: number | null; ec: number | null; signal: string };
      engagement: { last_login_days: number; xp_delta: number; streak: number; level: number; mission_rate: number; signal: string };
      score: number;
    };
    work_behaviour: { active_minutes: number; idle_minutes: number; idle_spikes: number; after_hours_days: number; active_delta: number; signal: string; score: number };
  };
  support: { tickets_30d: number; consultations_30d: number };
  ai_narrative: {
    risk_level: string;
    narrative: string;
    calendar_insight: string;
    gmail_insight: string;
    inapp_insight: string;
    workbehaviour_insight: string;
    recommendations: string[];
  } | null;
  hr_actions: { action_type: string; notes: string | null; created_at: string }[];
}

const RISK_META: Record<RiskLevel, { bg: string; text: string; border: string; dot: string; label: string }> = {
  THRIVING:          { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", dot: "bg-emerald-500",  label: "Thriving"        },
  MONITOR:           { bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",   dot: "bg-amber-500",    label: "Monitor"         },
  "NEEDS ATTENTION": { bg: "bg-orange-50",   text: "text-orange-700",   border: "border-orange-200",  dot: "bg-orange-500",   label: "Needs Attention" },
  CRITICAL:          { bg: "bg-rose-50",     text: "text-rose-700",     border: "border-rose-200",    dot: "bg-rose-500",     label: "Critical"        },
};

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  consultation_opened: { label: "Schedule Consultation", icon: <CalendarCheck size={14} />, color: "bg-cyan-600 hover:bg-cyan-700" },
  resource_sent:       { label: "Send Resource",         icon: <Send size={14} />,           color: "bg-teal-600 hover:bg-teal-700" },
  noted:               { label: "Mark as Noted",         icon: <ClipboardList size={14} />,  color: "bg-slate-600 hover:bg-slate-700" },
  nudge_sent:          { label: "Send Nudge",            icon: <MessageSquare size={14} />,  color: "bg-violet-600 hover:bg-violet-700" },
};

const ACTION_LABELS: Record<string, string> = {
  consultation_opened: "Consultation Scheduled",
  resource_sent:       "Resource Sent",
  noted:               "Marked as Noted",
  nudge_sent:          "Nudge Sent",
};

const AUTO_REFRESH_MS = 5_000;

const SIGNAL_ORDER: Record<string, number> = {
  HIGH: 0, BALANCED: 0, NORMAL: 0, GOOD: 0, ACTIVE: 0, GROWING: 0, THRIVING: 0,
  MEDIUM: 1, MODERATE: 1, ELEVATED: 1, WARNING: 1, DECLINING: 1, STABLE: 1, MONITOR: 1,
  LOW: 2, OVERLOADED: 2, HIGH_VOLUME: 2, AT_RISK: 2, DISENGAGED: 2, "NEEDS ATTENTION": 2,
  NO_DATA: 3, CRITICAL: 4,
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp size={12} className="text-emerald-500" />;
  if (delta < 0) return <TrendingDown size={12} className="text-rose-500" />;
  return <Minus size={12} className="text-slate-400" />;
}

function Avatar({ name, url, size = 8 }: { name: string; url: string | null; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className={`w-${size} h-${size} rounded-full object-cover ring-2 ring-white shrink-0`} />;
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-white text-xs font-extrabold grid place-items-center ring-2 ring-white shrink-0`}>
      {initials}
    </div>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const m = RISK_META[level] ?? RISK_META["MONITOR"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${m.bg} ${m.text} border ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}
    </span>
  );
}

function ScoreBar({ score, color = "bg-teal-500" }: { score: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.max(2, score)}%` }} />
    </div>
  );
}

function SignalChip({ signal }: { signal: string }) {
  const map: Record<string, string> = {
    GOOD: "bg-emerald-100 text-emerald-700", WARNING: "bg-amber-100 text-amber-700", AT_RISK: "bg-rose-100 text-rose-700",
    ACTIVE: "bg-emerald-100 text-emerald-700", DECLINING: "bg-amber-100 text-amber-700", DISENGAGED: "bg-rose-100 text-rose-700",
    GROWING: "bg-emerald-100 text-emerald-700", STABLE: "bg-slate-100 text-slate-600",
    HIGH: "bg-emerald-100 text-emerald-700", MEDIUM: "bg-amber-100 text-amber-700", LOW: "bg-rose-100 text-rose-700",
    NO_DATA: "bg-slate-100 text-slate-500", BALANCED: "bg-emerald-100 text-emerald-700",
    MODERATE: "bg-amber-100 text-amber-700", OVERLOADED: "bg-rose-100 text-rose-700",
    NORMAL: "bg-emerald-100 text-emerald-700", ELEVATED: "bg-amber-100 text-amber-700", HIGH_VOLUME: "bg-rose-100 text-rose-700",
    POSITIVE: "bg-emerald-100 text-emerald-700", NEUTRAL: "bg-slate-100 text-slate-600", NEGATIVE_TRENDING: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[signal] ?? "bg-slate-100 text-slate-600"}`}>
      {signal.replace(/_/g, " ")}
    </span>
  );
}

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-rose-500";
}

function SignalCard({ title, icon, signal, score, isMock, children }: {
  title: string; icon: React.ReactNode; signal: string; score: number; isMock?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
          {icon}{title}
          {isMock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 font-semibold">
              <WifiOff size={9} /> not connected
            </span>
          )}
        </div>
        <SignalChip signal={signal} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Score</span><span className="font-bold text-slate-700">{score}/100</span>
        </div>
        <ScoreBar score={score} color={scoreColor(score)} />
      </div>
      <div className="space-y-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

function ActionModal({ open, actionType, employeeId, onClose, onDone }: {
  open: boolean; actionType: string; employeeId: string; onClose: () => void; onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meta = ACTION_META[actionType];

  async function handleSubmit() {
    setLoading(true); setErr(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/hr/wellbeing/log-action", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId, action_type: actionType, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Failed"); return; }
      onDone(); onClose(); setNotes("");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2">{meta?.icon}{meta?.label}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-600">Notes (optional)</label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Add context for this action..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none" />
        </div>
        {err && <p className="text-xs text-rose-600">{err}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${meta?.color}`}>
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sort Dropdown ────────────────────────────────────────────────────────────
function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const options: { key: SortKey; label: string }[] = [
    { key: "risk_score", label: "Overall Score" },
    { key: "name", label: "Name" },
    { key: "department", label: "Department" },
    { key: "work_signal", label: "Work Signal" },
  ];
  const current = options.find(o => o.key === value);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-all">
        <ArrowUpDown size={13} className="text-slate-400" />
        Sort: <span className="font-semibold text-slate-700">{current?.label}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {options.map(o => (
            <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === o.key ? "bg-teal-50 text-teal-700 font-bold" : "text-slate-600 hover:bg-slate-50"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalLegend() {
  const [open, setOpen] = useState(false);

  const sections = [
    {
      title: "Google Calendar",
      icon: <Calendar size={13} className="text-blue-500" />,
      rows: [
        { signal: "BALANCED", color: "bg-emerald-100 text-emerald-700", meaning: "Healthy meeting load", range: "< 15h meetings, no after-hours" },
        { signal: "MODERATE", color: "bg-amber-100 text-amber-700",   meaning: "Some overload signs",  range: "15–30h meetings or 1 after-hours" },
        { signal: "OVERLOADED", color: "bg-rose-100 text-rose-700",   meaning: "High workload risk",   range: "30h+ meetings or 3+ after-hours" },
      ],
    },
    {
      title: "Gmail Activity",
      icon: <Mail size={13} className="text-red-400" />,
      rows: [
        { signal: "NORMAL",      color: "bg-emerald-100 text-emerald-700", meaning: "Healthy communication",  range: "< 40 emails sent this week" },
        { signal: "ELEVATED",    color: "bg-amber-100 text-amber-700",     meaning: "Slightly high volume",   range: "40–80 emails or 2 after-hours" },
        { signal: "HIGH VOLUME", color: "bg-rose-100 text-rose-700",       meaning: "Communication stress",   range: "80+ emails or 5+ after-hours" },
      ],
    },
    {
      title: "Work Behaviour",
      icon: <Monitor size={13} className="text-violet-500" />,
      rows: [
        { signal: "HIGH",   color: "bg-emerald-100 text-emerald-700", meaning: "Highly engaged",      range: "Active ratio > 70%, few idle spikes" },
        { signal: "MEDIUM", color: "bg-amber-100 text-amber-700",     meaning: "Moderate engagement", range: "Active ratio 45–70%" },
        { signal: "LOW",    color: "bg-rose-100 text-rose-700",       meaning: "Low engagement",      range: "Active ratio < 45% or many idle spikes" },
      ],
    },
    {
      title: "BrainUp In-App",
      icon: <BrainCircuit size={13} className="text-cyan-500" />,
      rows: [
        { signal: "GOOD",    color: "bg-emerald-100 text-emerald-700", meaning: "Positive emotional state", range: "Mood avg 3.5–5.0" },
        { signal: "WARNING", color: "bg-amber-100 text-amber-700",     meaning: "Needs monitoring",         range: "Mood avg 2.5–3.5" },
        { signal: "AT RISK", color: "bg-rose-100 text-rose-700",       meaning: "Concerning signals",       range: "Mood avg below 2.5" },
      ],
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Info size={15} className="text-cyan-500" />
          Signal Indicator Guide
        </div>
        <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="border-t border-slate-100 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map(section => (
              <div key={section.title} className="space-y-2">
                {/* Section header */}
                <div className="flex items-center gap-2 font-bold text-slate-700 text-xs uppercase tracking-wide">
                  {section.icon}
                  {section.title}
                </div>
                {/* Rows */}
                <div className="rounded-xl overflow-hidden border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left py-2 px-3 font-bold text-slate-400 w-24">Signal</th>
                        <th className="text-left py-2 px-3 font-bold text-slate-400">Meaning</th>
                        <th className="text-left py-2 px-3 font-bold text-slate-400">Range</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {section.rows.map(row => (
                        <tr key={row.signal}>
                          <td className="py-2 px-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${row.color}`}>
                              {row.signal}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-medium">{row.meaning}</td>
                          <td className="py-2 px-3 text-slate-400">{row.range}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Overall score legend */}
          <div className="mt-5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-700 text-xs uppercase tracking-wide">
              <BrainCircuit size={13} className="text-slate-400" />
              Overall Risk Score (weighted average of all 4 sources)
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2 px-3 font-bold text-slate-400 w-36">Risk Level</th>
                    <th className="text-left py-2 px-3 font-bold text-slate-400">Score Range</th>
                    <th className="text-left py-2 px-3 font-bold text-slate-400">What it means</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { level: "THRIVING",         color: "bg-emerald-100 text-emerald-700", range: "75–100", meaning: "Employee is doing well across all signals" },
                    { level: "MONITOR",           color: "bg-amber-100 text-amber-700",     range: "50–74",  meaning: "Some signals need watching, not urgent" },
                    { level: "NEEDS ATTENTION",   color: "bg-orange-100 text-orange-700",   range: "25–49",  meaning: "Multiple signals declining, HR should reach out" },
                    { level: "CRITICAL",          color: "bg-rose-100 text-rose-700",       range: "0–24",   meaning: "Significant risk, immediate HR intervention needed" },
                  ].map(row => (
                    <tr key={row.level}>
                      <td className="py-2 px-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${row.color}`}>
                          {row.level}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium">{row.range}</td>
                      <td className="py-2 px-3 text-slate-400">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Team Overview Table ──────────────────────────────────────────────────────
function TeamOverview({ employees, onSelect, refreshing, onRefresh, lastRefreshed }: {
  employees: TeamEmployee[]; onSelect: (id: string) => void;
  refreshing: boolean; onRefresh: () => void; lastRefreshed: Date | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");

  const sorted = [...employees].sort((a, b) => {
    switch (sortKey) {
      case "risk_score": return a.risk_score - b.risk_score;
      case "name": return a.name.localeCompare(b.name);
      case "department": return a.department.localeCompare(b.department);
      case "work_signal": return (SIGNAL_ORDER[a.signals.work_behaviour.signal] ?? 9) - (SIGNAL_ORDER[b.signals.work_behaviour.signal] ?? 9);
      default: return 0;
    }
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <BrainCircuit size={20} className="text-cyan-500" />EI Insights Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            4-source wellbeing intelligence — Calendar · Gmail · In-App · Work Behaviour
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastRefreshed && (
            <span className="text-xs text-slate-400">
              Updated {lastRefreshed.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <SortDropdown value={sortKey} onChange={setSortKey} />
          <button onClick={onRefresh} disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {/* Col 1: Employee */}
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[160px]">Employee</th>
                {/* Col 2: Dept */}
                <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[100px]">Dept</th>
                {/* Col 3: Email */}
                <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[160px]">Email</th>
                {/* Col 4: Google */}
                <th className="text-center py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[80px]">Google</th>
                {/* Col 5: Calendar */}
                <th className="text-center py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[100px]">
                  <div className="flex items-center justify-center gap-1"><Calendar size={11} />Calendar</div>
                </th>
                {/* Col 6: Gmail */}
                <th className="text-center py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[100px]">
                  <div className="flex items-center justify-center gap-1"><Mail size={11} />Gmail</div>
                </th>
                {/* Col 7: Work */}
                <th className="text-center py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[100px]">
                  <div className="flex items-center justify-center gap-1"><Monitor size={11} />Work</div>
                </th>
                {/* Col 8: In-App */}
                <th className="text-center py-3 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[100px]">
                  <div className="flex items-center justify-center gap-1"><BrainCircuit size={11} />In-App</div>
                </th>
                
                <th className="py-3 px-3 min-w-[30px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(emp => (
                <tr key={emp.id} onClick={() => onSelect(emp.id)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors group">

                  {/* Col 1: Name + Avatar */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={emp.name} url={emp.avatar_url} size={8} />
                      <p className="font-semibold text-slate-800 text-sm truncate max-w-[120px]">{emp.name}</p>
                    </div>
                  </td>

                  {/* Col 2: Department */}
                  <td className="py-3 px-3">
                    <p className="text-xs text-slate-500 truncate max-w-[100px]">{emp.department || "—"}</p>
                  </td>

                  {/* Col 3: Email */}
                  <td className="py-3 px-3">
                    <p className="text-xs text-slate-400 truncate max-w-[150px]">{emp.email}</p>
                  </td>

                  {/* Col 4: Google Connected */}
                  <td className="py-3 px-3 text-center">
                    {emp.google_connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10px] font-bold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-400">
                        <WifiOff size={9} />
                        None
                      </span>
                    )}
                  </td>

                  {/* Col 5: Calendar */}
                  <td className="py-3 px-3 text-center">
                    {emp.google_connected ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-slate-700">{emp.signals.calendar.meeting_hours}h</span>
                        <SignalChip signal={emp.signals.calendar.signal} />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 font-medium">—</span>
                    )}
                  </td>

                  {/* Col 6: Gmail */}
                  <td className="py-3 px-3 text-center">
                    {emp.google_connected ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-slate-700">{emp.signals.gmail.sent_this_week} sent</span>
                        <SignalChip signal={emp.signals.gmail.signal} />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 font-medium">—</span>
                    )}
                  </td>

                  {/* Col 7: Work Behaviour */}
                  <td className="py-3 px-3 text-center">
                    {emp.signals.work_behaviour.active_minutes > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-slate-700">{emp.signals.work_behaviour.active_minutes}m</span>
                        <SignalChip signal={emp.signals.work_behaviour.signal} />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 font-medium">—</span>
                    )}
                  </td>

                  {/* Col 8: In-App */}
                  <td className="py-3 px-3 text-center">
                    {emp.signals.inapp.mood_avg > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-slate-700">{emp.signals.inapp.mood_avg.toFixed(1)} mood</span>
                        <SignalChip signal={emp.signals.inapp.mood_signal} />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 font-medium">—</span>
                    )}
                  </td>

                  

                  {/* Arrow */}
                  <td className="py-3 px-3">
                    <ChevronRight size={15} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <Users size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No employee data found.</p>
          </div>
        )}
      </div>

            {/* Signal Legend */}
      <SignalLegend />

      <p className="text-xs text-slate-400 text-center">
        Scores weighted equally: Calendar 25% · Gmail 25% · In-App 25% · Work Behaviour 25%
        · — = data not available · Auto-refreshes every 5 seconds
      </p>

    </div>
  );
}

// ─── Individual Deep Dive ─────────────────────────────────────────────────────
function EmployeeDeepDive({ userId, onBack, onActionDone }: {
  userId: string; onBack: () => void; onActionDone: () => void;
}) {
  const [report, setReport] = useState<EmployeeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  const fetchReport = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const headers = await authHeaders();
    const url = silent
      ? `/api/hr/wellbeing/employee/${userId}?skipAI=1`
      : `/api/hr/wellbeing/employee/${userId}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (res.ok) {
      setReport(prev => ({
        ...data,
        ai_narrative: silent && prev?.ai_narrative ? prev.ai_narrative : data.ai_narrative,
      }));
      setLastRefreshed(new Date());
    }
    if (!silent) setLoading(false);
  }, [userId]);

  useEffect(() => { fetchReport(false); }, [fetchReport]);

  useEffect(() => {
    const interval = setInterval(() => { fetchReport(true); }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchReport]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <Loader2 size={28} className="animate-spin text-cyan-400" />
      <p className="text-sm">Loading wellbeing report…</p>
    </div>
  );

  if (!report) return (
    <div className="py-12 text-center text-slate-400">
      <AlertTriangle size={28} className="mx-auto mb-2 text-rose-400" />
      <p className="text-sm">Could not load employee report.</p>
    </div>
  );

  const { employee, risk_score, risk_level, signals, ai_narrative, hr_actions } = report;
  const riskMeta = RISK_META[risk_level];
  const dimLabels: Record<string, string> = {
    EA: "Emotional Awareness", EU: "Emotion Usage", EUS: "Understanding", EC: "Controlling",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 transition-colors font-semibold">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <Avatar name={employee.name} url={employee.avatar_url} size={10} />
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">{employee.name}</h2>
            <p className="text-sm text-slate-500">{employee.department}</p>
          </div>
          <RiskBadge level={risk_level} />
          <span className={`text-sm font-bold ${riskMeta.text}`}>{risk_score}/100</span>
          {!employee.google_connected && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <WifiOff size={11} /> Google not connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastRefreshed && (
            <span className="text-xs text-slate-400">
              {lastRefreshed.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button onClick={() => fetchReport(false)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* 4 Signal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SignalCard title="Google Calendar" icon={<Calendar size={15} className="text-blue-500" />}
          signal={signals.calendar.signal} score={signals.calendar.score} isMock={signals.calendar.is_mock}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-400 mb-0.5">Meeting hours</p>
              <p className="font-extrabold text-slate-800 text-base">{signals.calendar.meeting_hours_this_week}h<span className="text-slate-400 text-xs font-normal"> this week</span></p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-400 mb-0.5">Focus ratio</p>
              <p className="font-extrabold text-slate-800 text-base">{Math.round(signals.calendar.focus_time_ratio * 100)}%</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {signals.calendar.after_hours_meetings > 0 && <span className="text-rose-500 font-semibold">⚠ {signals.calendar.after_hours_meetings} after-hours meeting{signals.calendar.after_hours_meetings > 1 ? "s" : ""}</span>}
            {signals.calendar.back_to_back_meetings > 0 && <span className="text-amber-500 font-semibold">{signals.calendar.back_to_back_meetings} back-to-back</span>}
            {signals.calendar.after_hours_meetings === 0 && signals.calendar.back_to_back_meetings === 0 && <span className="text-emerald-600 font-semibold">✓ Healthy meeting load</span>}
          </div>
        </SignalCard>

        <SignalCard title="Gmail Activity" icon={<Mail size={15} className="text-red-400" />}
          signal={signals.gmail.signal} score={signals.gmail.score} isMock={signals.gmail.is_mock}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-400 mb-0.5">Sent this week</p>
              <p className="font-extrabold text-slate-800 text-base flex items-center gap-1">{signals.gmail.emails_sent_this_week}<DeltaIcon delta={signals.gmail.volume_delta} /></p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-400 mb-0.5">vs last week</p>
              <p className="font-extrabold text-slate-800 text-base">{signals.gmail.emails_sent_last_week}</p>
            </div>
          </div>
          <div className="text-xs">
            {signals.gmail.after_hours_emails > 0
              ? <span className="text-rose-500 font-semibold">⚠ {signals.gmail.after_hours_emails} after-hours email{signals.gmail.after_hours_emails > 1 ? "s" : ""}</span>
              : <span className="text-emerald-600 font-semibold">✓ No after-hours emails</span>}
            {signals.gmail.volume_delta !== 0 && <span className="ml-2 text-slate-500">Volume {signals.gmail.volume_delta > 0 ? "+" : ""}{signals.gmail.volume_delta} vs last week</span>}
          </div>
        </SignalCard>

        <SignalCard title="BrainUp In-App" icon={<BrainCircuit size={15} className="text-cyan-500" />}
          signal={signals.inapp.mood.signal} score={signals.inapp.score}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-400 mb-0.5">Mood avg</p>
              <p className="font-extrabold text-slate-800 text-base flex items-center gap-1">
                {signals.inapp.mood.avg > 0 ? signals.inapp.mood.avg.toFixed(1) : "—"}<DeltaIcon delta={signals.inapp.mood.delta} />
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-400 mb-0.5">EI Score</p>
              <p className="font-extrabold text-slate-800 text-base">
                {signals.inapp.ei.latest_score ? Math.round(signals.inapp.ei.latest_score) : "—"}
                {signals.inapp.ei.delta !== 0 && <span className={`text-xs ml-1 ${signals.inapp.ei.delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>{signals.inapp.ei.delta > 0 ? "+" : ""}{Math.round(signals.inapp.ei.delta * 10) / 10}</span>}
              </p>
            </div>
          </div>
          {signals.inapp.ei.ea !== null && (
            <div className="space-y-1.5">
              {(["ea", "eu", "eus", "ec"] as const).map(dim => (
                <div key={dim} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-slate-400 shrink-0 truncate">{dimLabels[dim.toUpperCase()]}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${signals.inapp.ei.weakest_dimension === dim.toUpperCase() ? "bg-orange-400" : "bg-cyan-400"}`}
                      style={{ width: `${signals.inapp.ei[dim] ?? 0}%` }} />
                  </div>
                  <span className="w-6 text-slate-600 font-semibold text-right text-[10px]">{Math.round(signals.inapp.ei[dim] ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Journal: <span className="font-semibold text-slate-700">{signals.inapp.journal.count}</span> entries</span>
            <SignalChip signal={signals.inapp.journal.signal} />
            <span>Last login: <span className={`font-semibold ${signals.inapp.engagement.last_login_days > 7 ? "text-rose-500" : "text-slate-700"}`}>
              {signals.inapp.engagement.last_login_days === 0 ? "Today" : signals.inapp.engagement.last_login_days === 1 ? "Yesterday" : `${signals.inapp.engagement.last_login_days}d ago`}
            </span></span>
          </div>
        </SignalCard>

        <SignalCard title="Work Behaviour" icon={<Monitor size={15} className="text-violet-500" />}
          signal={signals.work_behaviour.signal} score={signals.work_behaviour.score}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-400 mb-0.5">Active time</p>
              <p className="font-extrabold text-slate-800 text-base flex items-center gap-1">{signals.work_behaviour.active_minutes}m<DeltaIcon delta={signals.work_behaviour.active_delta} /></p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-400 mb-0.5">Idle time</p>
              <p className="font-extrabold text-slate-800 text-base">{signals.work_behaviour.idle_minutes}m</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400"><span>Active</span><span>Idle</span></div>
            <div className="h-2 w-full rounded-full bg-rose-100 overflow-hidden">
              <div className="h-full rounded-full bg-teal-400 transition-all duration-700"
                style={{ width: `${signals.work_behaviour.active_minutes + signals.work_behaviour.idle_minutes > 0 ? Math.round(signals.work_behaviour.active_minutes / (signals.work_behaviour.active_minutes + signals.work_behaviour.idle_minutes) * 100) : 50}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            {signals.work_behaviour.idle_spikes > 0 && <span className="text-amber-500 font-semibold">⚠ {signals.work_behaviour.idle_spikes} idle spike{signals.work_behaviour.idle_spikes > 1 ? "s" : ""}</span>}
            {signals.work_behaviour.after_hours_days > 0 && <span className="text-rose-500 font-semibold">{signals.work_behaviour.after_hours_days} after-hours day{signals.work_behaviour.after_hours_days > 1 ? "s" : ""}</span>}
            {signals.work_behaviour.idle_spikes === 0 && signals.work_behaviour.after_hours_days === 0 && <span className="text-emerald-600 font-semibold">✓ Healthy work pattern</span>}
          </div>
        </SignalCard>
      </div>

      {/* AI Narrative */}
      {ai_narrative ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Sparkles size={16} className="text-cyan-500" />AI Wellbeing Narrative
            <span className="ml-auto"><RiskBadge level={(ai_narrative.risk_level?.replace(/_/g, " ") as RiskLevel) ?? "MONITOR"} /></span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{ai_narrative.narrative}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              { label: "Calendar", value: ai_narrative.calendar_insight, icon: <Calendar size={11} className="text-blue-400" /> },
              { label: "Gmail", value: ai_narrative.gmail_insight, icon: <Mail size={11} className="text-red-400" /> },
              { label: "In-App", value: ai_narrative.inapp_insight, icon: <BrainCircuit size={11} className="text-cyan-500" /> },
              { label: "Work Behaviour", value: ai_narrative.workbehaviour_insight, icon: <Monitor size={11} className="text-violet-400" /> },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1">
                <p className="flex items-center gap-1.5 font-bold text-slate-500">{item.icon}{item.label}</p>
                <p className="text-slate-600">{item.value}</p>
              </div>
            ))}
          </div>
          {ai_narrative.recommendations?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Target size={11} className="text-teal-500" />Recommended HR Actions</p>
              <ul className="space-y-1.5">
                {ai_narrative.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 shrink-0" />{rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center text-slate-400">
          <Sparkles size={20} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">AI narrative not available — check GROQ_API_KEY.</p>
        </div>
      )}

      {/* Support context */}
      {(report.support.tickets_30d > 0 || report.support.consultations_30d > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4 text-sm">
          <Activity size={14} className="text-slate-400 shrink-0" />
          <div className="flex items-center gap-4 text-slate-600">
            {report.support.tickets_30d > 0 && <span><span className="font-bold text-slate-800">{report.support.tickets_30d}</span> support ticket{report.support.tickets_30d > 1 ? "s" : ""} (30d)</span>}
            {report.support.consultations_30d > 0 && <span><span className="font-bold text-slate-800">{report.support.consultations_30d}</span> consultation{report.support.consultations_30d > 1 ? "s" : ""} (30d)</span>}
          </div>
        </div>
      )}

      

      {actionModal && (
        <ActionModal open={true} actionType={actionModal} employeeId={userId}
          onClose={() => setActionModal(null)}
          onDone={() => { showToast(`✓ ${ACTION_META[actionModal]?.label} logged`); fetchReport(true); onActionDone(); }} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-800 text-white text-sm font-semibold px-4 py-3 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WellbeingIntelligencePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isHR, setIsHR] = useState(false);
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      const role = String(profile?.role ?? "").toUpperCase();
      if (!["HR", "ADMIN"].includes(role)) { router.push("/post-login"); return; }
      if (!alive) return;
      setIsHR(true);
      await loadTeam(session.access_token);
      if (!alive) return;
      setLoading(false);
    }
    init();
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    if (!isHR || selectedId) return;
    const interval = setInterval(() => { loadTeam(); }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [isHR, selectedId]);

  async function loadTeam(token?: string) {
    setRefreshing(true);
    const headers = token ? { Authorization: `Bearer ${token}` } : await authHeaders();
    const res = await fetch("/api/hr/wellbeing/team-overview", { headers });
    const data = await res.json();
    if (res.ok) { setEmployees(data.employees ?? []); setLastRefreshed(new Date()); }
    setRefreshing(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <BrainCircuit size={32} className="text-cyan-400 animate-pulse" />
        <p className="text-sm">Loading EI Insights…</p>
      </div>
    </div>
  );

  if (!isHR) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-16">
      {selectedId ? (
        <EmployeeDeepDive userId={selectedId} onBack={() => setSelectedId(null)} onActionDone={() => loadTeam()} />
      ) : (
        <TeamOverview employees={employees} onSelect={id => setSelectedId(id)}
          refreshing={refreshing} onRefresh={() => loadTeam()} lastRefreshed={lastRefreshed} />
      )}
    </div>
  );
}