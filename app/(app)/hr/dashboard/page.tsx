"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Heart,
  Filter,
  RefreshCw,
} from "lucide-react";

type CheckIn = {
  id: string;
  user_id: string;
  emotion_level: number;
  emotion_tag: string;
  department: string;
  checked_in_at: string;
};

type FlaggedUser = {
  user_id: string;
  full_name: string;
  department: string;
  count: number;
};

type DeptSummary = {
  department: string;
  avg_score: number;
  total_checkins: number;
};

type DailyTrend = {
  date: string;
  avg_level: number;
  checkins: number;
};

const EMOTION_LABELS: Record<number, string> = {
  1: "Very Low",
  2: "Low",
  3: "Neutral",
  4: "Good",
  5: "Excellent",
};

const DEPARTMENTS = ["All", "Operation", "Human Resources", "Engineering", "Marketing", "Finance"];

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function getDateNDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function HRDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [flagged, setFlagged] = useState<FlaggedUser[]>([]);

  // Filters
  const [selectedDept, setSelectedDept] = useState("All");
  const [startDate, setStartDate] = useState(getDateNDaysAgo(14));
  const [endDate, setEndDate] = useState(getTodayUTC());

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      // Check HR role
      const md: any = session.user.user_metadata || {};
      const role = (md?.role ?? "EMPLOYEE") as string;
      if (String(role).toUpperCase() !== "HR" && String(role).toUpperCase() !== "ADMIN") {
        router.push("/post-login");
        return;
      }

      await fetchData(alive);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  async function fetchData(alive = true) {
    setLoading(true);

    // Fetch all checkins in date range
    let query = supabase
      .from("emotion_checkins")
      .select("*")
      .gte("checked_in_at", startDate + "T00:00:00Z")
      .lte("checked_in_at", endDate + "T23:59:59Z")
      .order("checked_in_at", { ascending: false });

    if (selectedDept !== "All") {
      query = query.eq("department", selectedDept);
    }

    const { data: checkinData } = await query;
    if (!alive) return;
    setCheckins(checkinData ?? []);

    // Fetch flagged users (emotion_level = 1, 3+ times in last 7 days)
    const sevenDaysAgo = getDateNDaysAgo(7);
    const { data: flaggedData } = await supabase
      .from("emotion_checkins")
      .select("user_id, emotion_level, checked_in_at")
      .eq("emotion_level", 1)
      .gte("checked_in_at", sevenDaysAgo + "T00:00:00Z");

    if (!alive) return;

    // Count per user
    const countMap = new Map<string, number>();
    for (const row of flaggedData ?? []) {
      countMap.set(row.user_id, (countMap.get(row.user_id) ?? 0) + 1);
    }

    // Only keep users with 3+ flags
    const flaggedUserIds = Array.from(countMap.entries())
      .filter(([, count]) => count >= 3)
      .map(([uid]) => uid);

    if (flaggedUserIds.length > 0) {
      // Get names from auth metadata
      const { data: authData } = await supabase
        .from("emotion_checkins")
        .select("user_id, department")
        .in("user_id", flaggedUserIds);

      const deptMap = new Map<string, string>();
      for (const row of authData ?? []) {
        if (!deptMap.has(row.user_id)) deptMap.set(row.user_id, row.department);
      }

      const builtFlagged: FlaggedUser[] = flaggedUserIds.map((uid) => ({
        user_id: uid,
        full_name: `User ${uid.slice(0, 6)}`,
        department: deptMap.get(uid) ?? "—",
        count: countMap.get(uid) ?? 0,
      }));

      setFlagged(builtFlagged);
    } else {
      setFlagged([]);
    }

    setLoading(false);
  }

  // Department summary
  const deptSummary = useMemo((): DeptSummary[] => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const c of checkins) {
      const dept = c.department || "Unknown";
      const prev = map.get(dept) ?? { sum: 0, count: 0 };
      map.set(dept, { sum: prev.sum + c.emotion_level, count: prev.count + 1 });
    }
    return Array.from(map.entries()).map(([department, v]) => ({
      department,
      avg_score: Math.round((v.sum / v.count) * 10) / 10,
      total_checkins: v.count,
    })).sort((a, b) => b.avg_score - a.avg_score);
  }, [checkins]);

  // Daily trend
  const dailyTrend = useMemo((): DailyTrend[] => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const c of checkins) {
      const date = c.checked_in_at.slice(0, 10);
      const prev = map.get(date) ?? { sum: 0, count: 0 };
      map.set(date, { sum: prev.sum + c.emotion_level, count: prev.count + 1 });
    }
    return Array.from(map.entries())
      .map(([date, v]) => ({
        date,
        avg_level: Math.round((v.sum / v.count) * 10) / 10,
        checkins: v.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [checkins]);

  // Emotion tag distribution
  const tagDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checkins) {
      map.set(c.emotion_tag, (map.get(c.emotion_tag) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [checkins]);

  // Overall avg
  const overallAvg = useMemo(() => {
    if (checkins.length === 0) return 0;
    const sum = checkins.reduce((acc, c) => acc + c.emotion_level, 0);
    return Math.round((sum / checkins.length) * 10) / 10;
  }, [checkins]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading HR dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">HR Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Organisation-wide emotional intelligence and wellbeing overview.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchData()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-slate-500" />
          <div className="text-sm font-extrabold text-slate-900">Filters</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => fetchData()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95"
            >
              Apply
            </button>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Total Check-ins"
          value={checkins.length}
          icon={<Heart size={16} className="text-slate-500" />}
        />
        <MetricCard
          label="Avg EI Score"
          value={`${overallAvg} / 5`}
          icon={<TrendingUp size={16} className="text-slate-500" />}
        />
        <MetricCard
          label="Departments"
          value={deptSummary.length}
          icon={<Users size={16} className="text-slate-500" />}
        />
        <MetricCard
          label="Flagged Users"
          value={flagged.length}
          icon={<AlertTriangle size={16} className="text-amber-500" />}
          highlight={flagged.length > 0}
        />
      </div>

      {checkins.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100">
            <Heart size={20} className="text-slate-400" />
          </div>
          <div className="mt-4 text-base font-extrabold text-slate-900">No data found</div>
          <div className="mt-1 text-sm text-slate-500">
            Try adjusting the filters or date range.
          </div>
        </div>
      ) : (
        <>
          {/* Daily trend chart */}
          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-extrabold text-slate-900">Daily Emotion Trend</div>
            <div className="text-xs text-slate-500 mb-3">Average emotion level per day (1 = Very Low, 5 = Excellent)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [String(value ?? ""), "Avg Level"]}
                />
                <Line
                  type="monotone"
                  dataKey="avg_level"
                  stroke="#0891b2"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Avg Emotion Level"
                />
              </LineChart>
            </ResponsiveContainer>
          </section>

          {/* Department summary chart */}
          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-extrabold text-slate-900">Department EI Summary</div>
            <div className="text-xs text-slate-500 mb-3">Average emotion score by department</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip
  formatter={(value) => [String(value ?? ""), "Avg Score"]}
/>
                <Bar dataKey="avg_score" fill="#0891b2" radius={[4, 4, 0, 0]} name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Two column: tag distribution + dept table */}
          <div className="mb-5 grid gap-5 md:grid-cols-2">
            {/* Emotion tag distribution */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-extrabold text-slate-900">Top Emotion Tags</div>
              <div className="space-y-2">
                {tagDistribution.map((t) => {
                  const maxCount = tagDistribution[0]?.count ?? 1;
                  const pct = Math.round((t.count / maxCount) * 100);
                  return (
                    <div key={t.tag}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700">{t.tag}</span>
                        <span className="font-bold text-slate-500">{t.count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Department detail table */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-extrabold text-slate-900">Department Details</div>
              <div className="space-y-2">
                {deptSummary.map((d) => (
                  <div
                    key={d.department}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">{d.department}</div>
                      <div className="text-xs text-slate-500">{d.total_checkins} check-ins</div>
                    </div>
                    <div className={[
                      "rounded-full px-3 py-1 text-xs font-extrabold",
                      d.avg_score >= 4 ? "bg-emerald-50 text-emerald-700" :
                      d.avg_score >= 3 ? "bg-sky-50 text-sky-700" :
                      d.avg_score >= 2 ? "bg-amber-50 text-amber-700" :
                      "bg-rose-50 text-rose-700",
                    ].join(" ")}>
                      {d.avg_score} / 5
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Flagged employees */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <div className="text-sm font-extrabold text-slate-900">Flagged Employees</div>
            </div>
            <div className="mb-4 text-xs text-slate-500">
              Employees who submitted emotion level 1 three or more times in the last 7 days.
            </div>

            {flagged.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                No flagged employees right now.
              </div>
            ) : (
              <div className="space-y-2">
                {flagged.map((f) => (
                  <div
                    key={f.user_id}
                    className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">{f.full_name}</div>
                      <div className="text-xs text-slate-500">{f.department}</div>
                    </div>
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">
                      {f.count}x flagged
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={[
      "rounded-2xl border p-4 shadow-sm",
      highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white",
    ].join(" ")}>
      <div className="flex items-center gap-2">
        {icon}
        <div className="text-xs font-bold text-slate-500">{label}</div>
      </div>
      <div className={[
        "mt-1 text-2xl font-extrabold",
        highlight ? "text-amber-700" : "text-slate-900",
      ].join(" ")}>{value}</div>
    </div>
  );
}