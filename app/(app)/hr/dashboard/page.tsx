"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, ReferenceLine,
} from "recharts";
import {
  Users, TrendingUp, TrendingDown, Heart, Filter,
  RefreshCw, Download, RotateCcw, Calendar,
  Activity, Target, Zap, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

type CheckIn = {
  id: string;
  user_id: string;
  emotion_level: number;
  emotion_tag: string;
  department: string;
  checked_in_at: string;
};

type DeptStat = {
  department: string;
  avg_score: number;
  prev_avg: number;
  delta: number;
  total_checkins: number;
  unique_users: number;
  low_count: number;
  high_count: number;
  status: "healthy" | "monitor" | "concern";
};

type DailyTrend = {
  date: string;
  label: string;
  current: number | null;
  previous: number | null;
  checkins: number;
};

type HeatmapCell = {
  department: string;
  day: string;
  date: string;
  avg: number | null;
  count: number;
};

type LevelDistribution = {
  department: string;
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  level5: number;
};

// ─── Constants ────────────────────────────────────────────────────

const DEPARTMENTS = ["All", "Operation", "Human Resources", "Engineering", "Marketing", "Finance"];

const LEVEL_COLORS = {
  1: "#164e63",  // darkest cyan-900
  2: "#0e7490",  // cyan-700
  3: "#0891b2",  // cyan-600
  4: "#06b6d4",  // cyan-500
  5: "#67e8f9",  // cyan-300
};

const STATUS_META = {
  healthy: { label: "Healthy", color: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500" },
  monitor: { label: "Monitor", color: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-400" },
  concern: { label: "Concern", color: "bg-teal-50 text-teal-800 border-teal-200", dot: "bg-teal-600" },
};

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Helpers ──────────────────────────────────────────────────────

function getTodayUTC() { return new Date().toISOString().slice(0, 10); }

function getDateNDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
}

function shortDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short" });
}

function getDeptStatus(avg: number, delta: number): DeptStat["status"] {
  if (avg < 2.5) return "concern";
  if (avg < 3.5 || delta < -0.3) return "monitor";
  return "healthy";
}

// ─── Main Page ────────────────────────────────────────────────────

export default function HRDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [prevPeriodCheckins, setPrevPeriodCheckins] = useState<CheckIn[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);

  // Filters
  const [selectedDept, setSelectedDept] = useState("All");
  const [startDate, setStartDate] = useState(getDateNDaysAgo(13));
  const [endDate, setEndDate] = useState(getTodayUTC());

  // ─── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const role = String(profile?.role || "").toUpperCase();
      if (role !== "HR" && role !== "ADMIN") {
        router.push("/post-login");
        return;
      }

      if (!alive) return;
      await fetchData();
      if (!alive) return;
      setLoading(false);
    }
    init();
    return () => { alive = false; };
  }, [router]);

  // ─── Fetch ─────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setRefreshing(true);

    const periodDays = daysBetween(startDate, endDate);
    const prevStart = (() => {
      const d = new Date(startDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - periodDays);
      return d.toISOString().slice(0, 10);
    })();
    const prevEnd = (() => {
      const d = new Date(startDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    // Fetch all profiles to get department mapping
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, department");
    const deptMap = new Map((profilesData ?? []).map(p => [p.id, p.department ?? "Unknown"]));

    // Current period
    const { data: cur } = await supabase
      .from("emotion_checkins")
      .select("*")
      .gte("checked_in_at", startDate + "T00:00:00Z")
      .lte("checked_in_at", endDate + "T23:59:59Z");

    // Previous period
    const { data: prev } = await supabase
      .from("emotion_checkins")
      .select("*")
      .gte("checked_in_at", prevStart + "T00:00:00Z")
      .lte("checked_in_at", prevEnd + "T23:59:59Z");

    // Active employees count
    let qEmp = supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["EMPLOYEE", "HR"]);
    if (selectedDept !== "All") qEmp = qEmp.eq("department", selectedDept);
    const { count: empCount } = await qEmp;

    // Inject department into checkins
    const enriched = (cur ?? []).map(c => ({ ...c, department: deptMap.get(c.user_id) ?? "Unknown" }));
    const enrichedPrev = (prev ?? []).map(c => ({ ...c, department: deptMap.get(c.user_id) ?? "Unknown" }));

    // Filter by dept if selected
    const filtered = selectedDept === "All" ? enriched : enriched.filter(c => c.department === selectedDept);
    const filteredPrev = selectedDept === "All" ? enrichedPrev : enrichedPrev.filter(c => c.department === selectedDept);

    setCheckins(filtered);
    setPrevPeriodCheckins(filteredPrev);
    setTotalEmployees(empCount ?? 0);
    setRefreshing(false);
  }, [startDate, endDate, selectedDept]);

  useEffect(() => {
    if (!loading) fetchData();
  }, [fetchData, loading]);

  // ─── Computed metrics ──────────────────────────────────────────

  const overallAvg = useMemo(() => {
    if (checkins.length === 0) return 0;
    return Math.round((checkins.reduce((a, c) => a + c.emotion_level, 0) / checkins.length) * 10) / 10;
  }, [checkins]);

  const prevAvg = useMemo(() => {
    if (prevPeriodCheckins.length === 0) return 0;
    return Math.round((prevPeriodCheckins.reduce((a, c) => a + c.emotion_level, 0) / prevPeriodCheckins.length) * 10) / 10;
  }, [prevPeriodCheckins]);

  const avgDelta = useMemo(() => {
    if (prevAvg === 0) return 0;
    return Math.round((overallAvg - prevAvg) * 10) / 10;
  }, [overallAvg, prevAvg]);

  const activeEmployees = useMemo(() => {
    return new Set(checkins.map(c => c.user_id)).size;
  }, [checkins]);

  const coverage = useMemo(() => {
    if (totalEmployees === 0) return 0;
    return Math.round((activeEmployees / totalEmployees) * 100);
  }, [activeEmployees, totalEmployees]);

  // Department stats
  const deptStats = useMemo((): DeptStat[] => {
    const cur = new Map<string, { sum: number; n: number; users: Set<string>; low: number; high: number }>();
    for (const c of checkins) {
      const d = c.department || "Unknown";
      const e = cur.get(d) ?? { sum: 0, n: 0, users: new Set(), low: 0, high: 0 };
      e.sum += c.emotion_level;
      e.n += 1;
      e.users.add(c.user_id);
      if (c.emotion_level <= 2) e.low += 1;
      if (c.emotion_level >= 4) e.high += 1;
      cur.set(d, e);
    }

    const prev = new Map<string, { sum: number; n: number }>();
    for (const c of prevPeriodCheckins) {
      const d = c.department || "Unknown";
      const e = prev.get(d) ?? { sum: 0, n: 0 };
      e.sum += c.emotion_level;
      e.n += 1;
      prev.set(d, e);
    }

    return Array.from(cur.entries()).map(([department, v]) => {
      const avg = Math.round((v.sum / v.n) * 10) / 10;
      const pVal = prev.get(department);
      const pAvg = pVal && pVal.n > 0 ? Math.round((pVal.sum / pVal.n) * 10) / 10 : avg;
      const delta = Math.round((avg - pAvg) * 10) / 10;
      return {
        department,
        avg_score: avg,
        prev_avg: pAvg,
        delta,
        total_checkins: v.n,
        unique_users: v.users.size,
        low_count: v.low,
        high_count: v.high,
        status: getDeptStatus(avg, delta),
      };
    }).sort((a, b) => b.avg_score - a.avg_score);
  }, [checkins, prevPeriodCheckins]);

  // Daily trend with prev-period overlay
  const dailyTrend = useMemo((): DailyTrend[] => {
    const curMap = new Map<string, { sum: number; n: number }>();
    for (const c of checkins) {
      const day = c.checked_in_at.slice(0, 10);
      const e = curMap.get(day) ?? { sum: 0, n: 0 };
      e.sum += c.emotion_level;
      e.n += 1;
      curMap.set(day, e);
    }

    const prevMap = new Map<string, { sum: number; n: number }>();
    for (const c of prevPeriodCheckins) {
      const day = c.checked_in_at.slice(0, 10);
      const e = prevMap.get(day) ?? { sum: 0, n: 0 };
      e.sum += c.emotion_level;
      e.n += 1;
      prevMap.set(day, e);
    }

    const periodDays = daysBetween(startDate, endDate);
    const out: DailyTrend[] = [];
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(startDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const cur = curMap.get(iso);
      const curAvg = cur && cur.n > 0 ? Math.round((cur.sum / cur.n) * 10) / 10 : null;

      // Map to corresponding prev day
      const pd = new Date(d);
      pd.setUTCDate(pd.getUTCDate() - periodDays);
      const prevIso = pd.toISOString().slice(0, 10);
      const prev = prevMap.get(prevIso);
      const prevAvg = prev && prev.n > 0 ? Math.round((prev.sum / prev.n) * 10) / 10 : null;

      out.push({
        date: iso,
        label: shortDate(iso),
        current: curAvg,
        previous: prevAvg,
        checkins: cur?.n ?? 0,
      });
    }
    return out;
  }, [checkins, prevPeriodCheckins, startDate, endDate]);

  // Level distribution per dept (stacked)
  const levelDistribution = useMemo((): LevelDistribution[] => {
    const map = new Map<string, LevelDistribution>();
    for (const c of checkins) {
      const d = c.department || "Unknown";
      const e = map.get(d) ?? { department: d, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 };
      const key = `level${c.emotion_level}` as keyof Omit<LevelDistribution, "department">;
      (e[key] as number) += 1;
      map.set(d, e);
    }
    return Array.from(map.values()).sort((a, b) => a.department.localeCompare(b.department));
  }, [checkins]);

  // Top emotion tags
  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checkins) {
      if (c.emotion_tag) map.set(c.emotion_tag, (map.get(c.emotion_tag) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [checkins]);

  // Heatmap data — last 7 days × department
  const heatmap = useMemo((): { departments: string[]; days: string[]; cells: HeatmapCell[] } => {
    const periodDays = Math.min(7, daysBetween(startDate, endDate));
    const days: { iso: string; label: string }[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(endDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, label: shortDate(iso) });
    }

    const departments = Array.from(new Set(checkins.map(c => c.department || "Unknown"))).sort();
    const cells: HeatmapCell[] = [];

    for (const dept of departments) {
      for (const day of days) {
        const matching = checkins.filter(c =>
          (c.department || "Unknown") === dept &&
          c.checked_in_at.slice(0, 10) === day.iso
        );
        const avg = matching.length > 0
          ? Math.round((matching.reduce((a, c) => a + c.emotion_level, 0) / matching.length) * 10) / 10
          : null;
        cells.push({
          department: dept,
          day: day.label,
          date: day.iso,
          avg,
          count: matching.length,
        });
      }
    }

    return { departments, days: days.map(d => d.label), cells };
  }, [checkins, startDate, endDate]);

  // ─── Handlers ──────────────────────────────────────────────────

  function handleResetFilters() {
    setSelectedDept("All");
    setStartDate(getDateNDaysAgo(13));
    setEndDate(getTodayUTC());
  }

  function handleExportCSV() {
    const headers = ["Department", "Avg Score", "Prev Avg", "Δ", "Check-ins", "Unique Users", "Low Mood", "High Mood", "Status"];
    const rows = deptStats.map(d => [
      d.department, d.avg_score, d.prev_avg, d.delta, d.total_checkins, d.unique_users, d.low_count, d.high_count, d.status
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr-dashboard-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDeptClickFromChart(dept: string) {
    if (selectedDept === dept) setSelectedDept("All");
    else setSelectedDept(dept);
  }

  const filtersActive = selectedDept !== "All" || startDate !== getDateNDaysAgo(13) || endDate !== getTodayUTC();

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading HR dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* SVG gradient defs for charts */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="grad-cyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#0891b2" stopOpacity={1} />
          </linearGradient>
          <linearGradient id="grad-cyan-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="grad-slate-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="grad-bar-1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
          <linearGradient id="grad-emerald" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
          <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="grad-rose" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e7490" />
            <stop offset="100%" stopColor="#164e63" />
          </linearGradient>
        </defs>
      </svg>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">HR Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Organisation-wide wellbeing intelligence overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <Download size={13} />Export CSV
          </button>
          <button
            type="button"
            onClick={fetchData}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 mr-1">
            <Filter size={14} className="text-cyan-500" />
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Filters</span>
          </div>

          <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">
            {/* Custom Department Dropdown */}
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">Department</label>
              <DeptDropdown value={selectedDept} onChange={setSelectedDept} options={DEPARTMENTS} />
            </div>

            {/* Styled Date Inputs */}
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">Start Date</label>
              <StyledDateInput value={startDate} onChange={setStartDate} />
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">End Date</label>
              <StyledDateInput value={endDate} onChange={setEndDate} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {filtersActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-extrabold text-cyan-700 hover:bg-cyan-100 transition"
              >
                <RotateCcw size={12} />Reset
              </button>
            )}

            {selectedDept !== "All" && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 border border-cyan-200 px-3 py-1 text-xs font-extrabold text-cyan-700">
                <Target size={11} />{selectedDept}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          label="Total Check-ins"
          value={checkins.length}
          icon={<Heart size={14} />}
          accent="cyan"
        />
        <KpiCard
          label="Avg EI Score"
          value={`${overallAvg}`}
          suffix="/5"
          icon={<Activity size={14} />}
          accent="cyan"
          delta={avgDelta}
        />
        <KpiCard
          label="Active Employees"
          value={`${activeEmployees}`}
          suffix={` / ${totalEmployees}`}
          icon={<Users size={14} />}
          accent="cyan"
        />
        <KpiCard
          label="Check-in Coverage"
          value={`${coverage}`}
          suffix="%"
          icon={<Target size={14} />}
          accent="cyan"
        />
        <KpiCard
          label="Departments"
          value={deptStats.length}
          icon={<Zap size={14} />}
          accent="cyan"
        />
      </section>

      {checkins.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
            <Heart size={22} className="text-slate-400" />
          </div>
          <div className="mt-4 text-base font-extrabold text-slate-900">No check-in data for this period</div>
          <div className="mt-1 text-sm text-slate-500">Try adjusting the filters or date range above.</div>
        </div>
      ) : (
        <>
          {/* Row 1 — Trend + Dept Comparison */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Daily Trend with prev-period overlay */}
            <ChartCard
              title="Daily Emotion Trend"
              subtitle="Current period vs previous period of same length"
            >
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} iconType="circle" />
                  <Area type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#grad-slate-area)" name="Previous period" />
                  <Area type="monotone" dataKey="current" stroke="#0891b2" strokeWidth={2.5} fill="url(#grad-cyan-area)" name="Current period" />
                  <ReferenceLine y={3} stroke="#cbd5e1" strokeDasharray="2 2" label={{ value: "Neutral", fontSize: 9, fill: "#94a3b8" }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Department Comparison */}
            <ChartCard
              title="Department EI Comparison"
              subtitle="Click any bar to filter all charts by that department"
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -16, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <YAxis dataKey="department" type="category" tick={{ fontSize: 11, fill: "#334155", fontWeight: 700 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} width={110} />
                  <Tooltip content={<DeptTooltip />} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="avg_score" radius={[0, 6, 6, 0]} onClick={(d: any) => handleDeptClickFromChart(d.department)} cursor="pointer">
                    {deptStats.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.status === "healthy" ? "url(#grad-emerald)" :
                          d.status === "monitor" ? "url(#grad-amber)" :
                          "url(#grad-rose)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Row 2 — Distribution + Tags */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Emotion Level Distribution Stacked */}
            <ChartCard
              title="Emotion Level Distribution"
              subtitle="Count of each emotion level per department"
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={levelDistribution} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} content={<StackedTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} iconType="square" />
                  <Bar dataKey="level1" stackId="a" fill={LEVEL_COLORS[1]} name="1 — Very Low" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="level2" stackId="a" fill={LEVEL_COLORS[2]} name="2 — Low" />
                  <Bar dataKey="level3" stackId="a" fill={LEVEL_COLORS[3]} name="3 — Neutral" />
                  <Bar dataKey="level4" stackId="a" fill={LEVEL_COLORS[4]} name="4 — Good" />
                  <Bar dataKey="level5" stackId="a" fill={LEVEL_COLORS[5]} name="5 — Excellent" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Top Emotion Tags */}
            <ChartCard
              title="Top Emotion Tags"
              subtitle="Most frequent self-reported emotions in this period"
            >
              <div className="px-2 py-1 space-y-2.5">
                {topTags.length === 0 && (
                  <div className="text-xs text-slate-400 italic py-8 text-center">No tags recorded yet.</div>
                )}
                {topTags.map((t, i) => {
                  const maxCount = topTags[0]?.count ?? 1;
                  const pct = Math.round((t.count / maxCount) * 100);
                  return (
                    <div key={t.tag}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                          <span className="grid h-4 w-4 place-items-center rounded text-[9px] font-extrabold text-cyan-700 bg-cyan-50">
                            {i + 1}
                          </span>
                          {t.tag}
                        </span>
                        <span className="font-extrabold text-slate-500">{t.count}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-500 to-sky-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          </div>

          {/* Row 3 — Heatmap */}
          <ChartCard
            title="Mood Heatmap by Day & Department"
            subtitle="Average emotion level — last 7 days. Darker = healthier mood."
          >
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-2 font-extrabold text-slate-500 uppercase tracking-wider text-[10px] sticky left-0 bg-white">Dept</th>
                    {heatmap.days.map(day => (
                      <th key={day} className="p-2 font-extrabold text-slate-500 uppercase tracking-wider text-[10px] min-w-[68px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.departments.length === 0 && (
                    <tr>
                      <td colSpan={heatmap.days.length + 1} className="text-center text-slate-400 italic py-6 text-xs">
                        No data in this window
                      </td>
                    </tr>
                  )}
                  {heatmap.departments.map(dept => (
                    <tr key={dept}>
                      <td className="p-2 font-extrabold text-slate-800 sticky left-0 bg-white border-r border-slate-100">{dept}</td>
                      {heatmap.days.map(day => {
                        const cell = heatmap.cells.find(c => c.department === dept && c.day === day);
                        return (
                          <td key={day} className="p-1">
                            <HeatCell avg={cell?.avg ?? null} count={cell?.count ?? 0} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-2 mt-3 text-[10px] font-bold text-slate-500">
                <span>Low</span>
                <div className="flex h-3 w-32 rounded overflow-hidden">
                  <div className="flex-1 bg-sky-200" />
                  <div className="flex-1 bg-sky-300" />
                  <div className="flex-1 bg-cyan-400" />
                  <div className="flex-1 bg-cyan-600" />
                  <div className="flex-1 bg-cyan-700" />
                </div>
                <span>High</span>
              </div>
            </div>
          </ChartCard>

          {/* Row 4 — Drill-down Table */}
          <ChartCard
            title="Department Performance Breakdown"
            subtitle="Sortable detail view across all dimensions"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Department</th>
                    <th className="text-right py-2 px-3 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Avg Score</th>
                    <th className="text-right py-2 px-3 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Δ vs Prev</th>
                    <th className="text-right py-2 px-3 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Check-ins</th>
                    <th className="text-right py-2 px-3 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Active</th>
                    <th className="text-right py-2 px-3 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Low Mood</th>
                    <th className="text-right py-2 px-3 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">High Mood</th>
                    <th className="text-center py-2 px-3 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deptStats.map(d => {
                    const s = STATUS_META[d.status];
                    return (
                      <tr
                        key={d.department}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                        onClick={() => handleDeptClickFromChart(d.department)}
                      >
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{d.department}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">{d.avg_score}</td>
                        <td className="py-2.5 px-3 text-right">
                          <DeltaBadge value={d.delta} />
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-bold">{d.total_checkins}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-bold">{d.unique_users}</td>
                        <td className="py-2.5 px-3 text-right text-cyan-800 font-bold">{d.low_count}</td>
                        <td className="py-2.5 px-3 text-right text-cyan-600 font-bold">{d.high_count}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${s.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function KpiCard({
  label, value, suffix, icon, accent, delta,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ReactNode;
  accent: "cyan" | "emerald" | "amber" | "rose";
  delta?: number;
}) {
  const accentMap = {
    cyan: "from-cyan-500 to-sky-500",
    emerald: "from-teal-500 to-cyan-500",
    amber: "from-cyan-400 to-teal-500",
    rose: "from-sky-500 to-cyan-600",
  };
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm overflow-hidden hover:shadow-md transition">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accentMap[accent]}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{label}</div>
        <div className={`grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br ${accentMap[accent]} text-white`}>
          {icon}
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</span>
        {suffix && <span className="text-xs font-bold text-slate-400">{suffix}</span>}
      </div>
      {delta !== undefined && delta !== 0 && (
        <div className="mt-1">
          <DeltaBadge value={delta} small />
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        {subtitle && <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

function DeltaBadge({ value, small = false }: { value: number; small?: boolean }) {
  if (value === 0) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 font-extrabold ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}>
        <Minus size={small ? 9 : 11} />0
      </span>
    );
  }
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-extrabold ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"} ${
      up ? "bg-cyan-50 text-cyan-700" : "bg-sky-100 text-sky-800"
    }`}>
      {up ? <ArrowUpRight size={small ? 9 : 11} /> : <ArrowDownRight size={small ? 9 : 11} />}
      {up ? "+" : ""}{value}
    </span>
  );
}

function HeatCell({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null) {
    return <div className="h-9 rounded grid place-items-center text-[10px] text-slate-300 bg-slate-50">—</div>;
  }
  const color =
    avg >= 4 ? "bg-cyan-700 text-white" :
    avg >= 3.5 ? "bg-cyan-600 text-white" :
    avg >= 3 ? "bg-cyan-500 text-white" :
    avg >= 2.5 ? "bg-cyan-400 text-white" :
    avg >= 2 ? "bg-sky-300 text-slate-800" :
    "bg-sky-200 text-slate-700";
  return (
    <div className={`h-9 rounded grid place-items-center text-[11px] font-extrabold ${color}`} title={`${count} check-ins`}>
      {avg}
    </div>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="font-bold text-slate-700">{p.name}:</span>
          <span className="font-extrabold text-slate-900">{p.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function DeptTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d: DeptStat = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg min-w-[180px]">
      <div className="text-xs font-extrabold text-slate-900 mb-1.5">{d.department}</div>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between gap-3"><span className="text-slate-500">Avg</span><span className="font-extrabold">{d.avg_score} / 5</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">Prev</span><span className="font-extrabold">{d.prev_avg}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">Δ</span><span className={`font-extrabold ${d.delta > 0 ? "text-cyan-600" : d.delta < 0 ? "text-sky-800" : "text-slate-600"}`}>{d.delta > 0 ? "+" : ""}{d.delta}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">Check-ins</span><span className="font-extrabold">{d.total_checkins}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">Active</span><span className="font-extrabold">{d.unique_users}</span></div>
      </div>
    </div>
  );
}

function StackedTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg min-w-[180px]">
      <div className="text-xs font-extrabold text-slate-900 mb-1.5">{label}</div>
      <div className="space-y-0.5 text-[11px]">
        {payload.slice().reverse().map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.fill }} />
              <span className="text-slate-600">{p.name}</span>
            </div>
            <span className="font-extrabold text-slate-900">{p.value}</span>
          </div>
        ))}
        <div className="border-t border-slate-100 mt-1 pt-1 flex justify-between">
          <span className="font-extrabold text-slate-500">Total</span>
          <span className="font-extrabold text-slate-900">{total}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Department Dropdown ───────────────────────────────────

function DeptDropdown({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center justify-between gap-2 min-w-[160px] rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
          open
            ? "border-cyan-400 bg-white shadow-[0_0_0_3px_rgba(6,182,212,0.15)]"
            : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/30"
        } text-slate-800`}
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
          {value}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 min-w-full rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="p-1">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-extrabold transition ${
                  value === opt
                    ? "bg-cyan-500 text-white"
                    : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  value === opt ? "bg-white" : "bg-cyan-400"
                }`} />
                {opt}
                {value === opt && (
                  <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styled Date Input ────────────────────────────────────────────

function StyledDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);

  function formatDisplay(iso: string) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className={`relative inline-flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
      focused
        ? "border-cyan-400 bg-white shadow-[0_0_0_3px_rgba(6,182,212,0.15)]"
        : "border-slate-200 bg-white hover:border-cyan-300"
    }`}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-cyan-500 flex-shrink-0">
        <rect x="1" y="2.5" width="11" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 5.5H12" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 1V3.5M9 1V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="text-xs font-extrabold text-slate-700 min-w-[88px] select-none pointer-events-none">
        {value ? formatDisplay(value) : "Select date"}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
      />
    </div>
  );
}