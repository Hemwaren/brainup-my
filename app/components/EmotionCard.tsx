"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ChevronLeft, ChevronRight, Smile, Clock } from "lucide-react";
import EmotionCheckin from "./EmotionCheckin";
import { AnimatePresence } from "framer-motion";

type CheckIn = {
  id: string;
  emotion_level: number;
  emotion_tag: string;
  checked_in_at: string;
  schedule_slot?: string | null;
};

type Schedule = {
  id: string;
  time_slot: string;
  is_active: boolean;
};

type Props = {
  userId: string;
  department: string;
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Very Unpleasant",
  2: "Unpleasant",
  3: "Neutral",
  4: "Pleasant",
  5: "Very Pleasant",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "#7c3aed",
  2: "#2563eb",
  3: "#16a34a",
  4: "#ca8a04",
  5: "#ea580c",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekStart(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekRange(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function isWithinWindow(timeSlot: string): boolean {
  const now = new Date();
  const [hours, minutes] = timeSlot.split(":").map(Number);
  const slotDate = new Date();
  slotDate.setHours(hours, minutes, 0, 0);
  const diffMs = Math.abs(now.getTime() - slotDate.getTime());
  return diffMs <= 60 * 60 * 1000;
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length && payload[0].value !== null) {
    const val = payload[0].value;
    const rounded = Math.round(val);
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
        <div className="font-bold text-slate-700 mb-0.5">{label}</div>
        <div className="text-slate-500">{LEVEL_LABELS[rounded] ?? "—"}</div>
        <div className="font-extrabold mt-0.5" style={{ color: LEVEL_COLORS[rounded] ?? "#64748b" }}>
          {val.toFixed(1)} / 5
        </div>
      </div>
    );
  }
  return null;
}

export default function EmotionCard({ userId, department }: Props) {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayCheckins, setTodayCheckins] = useState<CheckIn[]>([]);

  const fetchData = useCallback(async () => {
    const weekStart = getWeekStart(weekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [{ data: ciData }, { data: schData }, { data: todayData }] = await Promise.all([
      supabase
        .from("emotion_checkins")
        .select("id, emotion_level, emotion_tag, checked_in_at, schedule_slot")
        .eq("user_id", userId)
        .gte("checked_in_at", weekStart.toISOString())
        .lt("checked_in_at", weekEnd.toISOString())
        .order("checked_in_at", { ascending: true }),
      supabase
        .from("checkin_schedules")
        .select("id, time_slot, is_active")
        .eq("is_active", true)
        .order("time_slot", { ascending: true }),
      supabase
        .from("emotion_checkins")
        .select("id, emotion_level, emotion_tag, checked_in_at, schedule_slot")
        .eq("user_id", userId)
        .gte("checked_in_at", today.toISOString())
        .lt("checked_in_at", tomorrow.toISOString()),
    ]);

    setCheckins(ciData ?? []);
    setSchedules(schData ?? []);
    setTodayCheckins(todayData ?? []);
    setLoading(false);
  }, [userId, weekOffset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build chart data — avg emotion per day
  const chartData = DAY_LABELS.map((day, i) => {
    const weekStart = getWeekStart(weekOffset);
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + i);

    const dayCheckins = checkins.filter(c => {
      const d = new Date(c.checked_in_at);
      return (
        d.getFullYear() === dayDate.getFullYear() &&
        d.getMonth() === dayDate.getMonth() &&
        d.getDate() === dayDate.getDate()
      );
    });

    const avg = dayCheckins.length > 0
      ? dayCheckins.reduce((sum, c) => sum + c.emotion_level, 0) / dayCheckins.length
      : null;

    return { day, avg, count: dayCheckins.length };
  });

  // Check if a slot has been done today
  function isSlotDone(timeSlot: string): boolean {
    const slotHour = parseInt(timeSlot.split(":")[0]);
    return todayCheckins.some(c => {
      const checkinHour = new Date(c.checked_in_at).getHours();
      return Math.abs(checkinHour - slotHour) <= 1;
    });
  }

  const availableSlots = schedules.filter(s =>
    !isSlotDone(s.time_slot) && isWithinWindow(s.time_slot)
  );

  const canCheckinNow = availableSlots.length > 0;
  const weekStart = getWeekStart(weekOffset);
  const isCurrentWeek = weekOffset === 0;
  const hasData = chartData.some(d => d.avg !== null);

  const latestCheckin = [...checkins].sort((a, b) =>
    new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime()
  )[0];

  function openCheckin() {
    const slot = availableSlots[0]?.time_slot ?? null;
    setActiveSlot(slot);
    setShowModal(true);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Loading emotion data...</p>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showModal && (
          <EmotionCheckin
            userId={userId}
            department={department}
            scheduleSlot={activeSlot}
            onComplete={() => {
              setShowModal(false);
              fetchData(); // ✅ refresh chart after save
            }}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">Emotion Check-in</div>
            <div className="text-xs text-slate-500 mt-0.5">Track how you feel throughout the day</div>
          </div>

          {canCheckinNow ? (
            <button type="button" onClick={openCheckin}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold text-white transition hover:opacity-90 shrink-0"
              style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee)" }}>
              <Smile size={13} />
              Check In Now
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 shrink-0">
              <Clock size={12} />
              {todayCheckins.length > 0 ? "Next slot later" : "No slot now"}
            </div>
          )}
        </div>

        {/* Latest check-in pill */}
        {latestCheckin && (
          <div className="px-5 mb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full"
                style={{ background: LEVEL_COLORS[latestCheckin.emotion_level] }} />
              <span className="text-xs font-bold text-slate-700">
                Latest: {latestCheckin.emotion_tag} · {LEVEL_LABELS[latestCheckin.emotion_level]}
              </span>
            </div>
          </div>
        )}

        {/* Week navigation */}
        <div className="px-5 flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-slate-500">{formatWeekRange(weekStart)}</div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setWeekOffset(v => v - 1)}
              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
              <ChevronLeft size={13} />
            </button>
            {!isCurrentWeek && (
              <button type="button" onClick={() => setWeekOffset(0)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50 transition">
                Today
              </button>
            )}
            <button type="button" onClick={() => setWeekOffset(v => v + 1)}
              disabled={isCurrentWeek}
              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Chart or empty state */}
        <div className="px-2 pb-4">
          {!hasData ? (
            <div className="h-32 flex flex-col items-center justify-center text-center px-6">
              <div className="text-2xl mb-1">🌱</div>
              <div className="text-xs font-bold text-slate-500">No check-ins this week</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {canCheckinNow
                  ? "Tap Check In Now to start!"
                  : "Check back during your next scheduled slot"}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={[1, 5]} ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 9, fill: "#cbd5e1" }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  fill="url(#emotionGradient)"
                  dot={{ r: 4, fill: "#22d3ee", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, fill: "#0891b2", stroke: "#fff", strokeWidth: 2 }}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Today's slots */}
        {schedules.length > 0 && (
          <div className="px-5 pb-4 border-t border-slate-100 pt-3">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
              Today's Slots
            </div>
            <div className="flex gap-2 flex-wrap">
              {schedules.map(s => {
                const done = isSlotDone(s.time_slot);
                const active = isWithinWindow(s.time_slot);
                return (
                  <div key={s.id}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold border transition",
                      done
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : active
                          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                          : "border-slate-200 bg-slate-50 text-slate-500",
                    ].join(" ")}>
                    <div className={[
                      "h-1.5 w-1.5 rounded-full",
                      done ? "bg-emerald-500" : active ? "bg-cyan-500 animate-pulse" : "bg-slate-300",
                    ].join(" ")} />
                    {s.time_slot.slice(0, 5)}
                    {done && " ✓"}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </>
  );
}