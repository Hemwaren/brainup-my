"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getLevelFromXP, getJourneyStage, LEVEL_TABLE } from "@/lib/gamification";
import {
  Flame,
  Trophy,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Circle,
  ClipboardList,
  Star,
} from "lucide-react";

type GamificationRow = {
  total_xp: number;
  level: number;
  stars: number;
  current_streak: number;
  longest_streak: number;
  xp_earned_today: number;
  last_active_date: string | null;
};

type MissionCompletion = {
  mission_id: string;
  completed_at: string;
};

const DAILY_MISSIONS = [
  { id: "m1", title: "Mood Check Minute", desc: "Log today's emotion", xp: 2, key: "daily_emotion_checkin" },
  { id: "m2", title: "3-Line Reflection", desc: "Write 3 sentences about how today felt", xp: 4, key: "daily_journal_entry" },
  { id: "m3", title: "Breathing Reset", desc: "Complete one short breathing exercise", xp: 3, key: "breathing_exercise" },
  { id: "m4", title: "Lesson of the Day", desc: "Read one EI article and note 1 takeaway", xp: 3, key: "read_ei_resource" },
  { id: "m5", title: "Reflection Worksheet", desc: "Complete one reflection worksheet", xp: 6, key: "reflection_worksheet" },
];

const JOURNEY_STAGES = [
  { stage: 1, name: "Emotional Awareness", desc: "Begin understanding your emotions", unlockLevel: 1 },
  { stage: 2, name: "Self Reflection", desc: "Build a journaling practice", unlockLevel: 5 },
  { stage: 3, name: "Emotional Regulation", desc: "Manage reactions and stress", unlockLevel: 9 },
  { stage: 4, name: "Empathy Building", desc: "Understand others perspectives", unlockLevel: 13 },
  { stage: 5, name: "Social Intelligence", desc: "Lead with emotional wisdom", unlockLevel: 17 },
];

const BADGES = [
  { key: "first_step", label: "First Step", cond: "Complete first emotion check-in", rarity: "Common" },
  { key: "pen_to_paper", label: "Pen to Paper", cond: "Write first journal entry", rarity: "Common" },
  { key: "3_day_momentum", label: "3-Day Momentum", cond: "Maintain a 3-day activity streak", rarity: "Common" },
  { key: "weekly_warrior", label: "Weekly Warrior", cond: "Maintain a 7-day streak", rarity: "Rare" },
  { key: "emotion_explorer", label: "Emotion Explorer", cond: "Log emotions on 10 different days", rarity: "Rare" },
  { key: "reflection_spark", label: "Reflection Spark", cond: "Complete 5 journal entries", rarity: "Common" },
  { key: "reflection_master", label: "Reflection Master", cond: "Complete 20 journal entries", rarity: "Rare" },
  { key: "insight_hunter", label: "Insight Hunter", cond: "Finish first EI assessment", rarity: "Rare" },
  { key: "growth_tracker", label: "Growth Tracker", cond: "Complete 3 EI assessments", rarity: "Rare" },
  { key: "resource_rover", label: "Resource Rover", cond: "Read or watch 5 EI resources", rarity: "Common" },
  { key: "learning_lover", label: "Learning Lover", cond: "Read or watch 15 EI resources", rarity: "Rare" },
  { key: "consistency_seed", label: "Consistency Seed", cond: "Stay active for 14 days", rarity: "Rare" },
  { key: "habit_guardian", label: "Habit Guardian", cond: "Stay active for 30 days", rarity: "Legendary" },
  { key: "level_climber", label: "Level Climber", cond: "Reach Level 10", rarity: "Rare" },
  { key: "brainup_legend", label: "BrainUp Legend", cond: "Reach Level 20", rarity: "Legendary" },
];

const DAILY_XP_CAP = 15;

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function rarityStyle(rarity: string) {
  if (rarity === "Legendary") return "bg-amber-50 text-amber-700 border-amber-200";
  if (rarity === "Rare") return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function StatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gRow, setGRow] = useState<GamificationRow | null>(null);
  const [unlockedBadges, setUnlockedBadges] = useState<Set<string>>(new Set());
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const uid = session.user.id;

      const [{ data: gData }, { data: badgeData }, { data: missionData }] = await Promise.all([
        supabase.from("user_gamification").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_badges").select("badge_key").eq("user_id", uid),
        supabase.from("user_mission_completions")
          .select("mission_id, completed_at")
          .eq("user_id", uid)
          .gte("completed_at", getTodayUTC()),
      ]);

      if (!alive) return;

      setGRow(gData ?? null);
      setUnlockedBadges(new Set((badgeData ?? []).map((b: any) => b.badge_key)));

      const todayMissions = new Set(
        (missionData ?? [])
          .filter((m: MissionCompletion) => m.completed_at.startsWith(getTodayUTC()))
          .map((m: MissionCompletion) => m.mission_id)
      );
      setCompletedToday(todayMissions);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  async function completeMission(missionId: string, activityKey: string) {
    if (completedToday.has(missionId) || completing) return;
    setCompleting(missionId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/gamification/award-xp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ activityKey }),
    });

    const data = await res.json();

    if (data.ok) {
      if (data.xpAwarded > 0) {
        showToast(`+${data.xpAwarded} XP earned`);
        setGRow((prev) => prev ? {
          ...prev,
          total_xp: data.totalXP,
          level: data.level,
          stars: data.stars,
          current_streak: data.currentStreak,
          longest_streak: data.longestStreak,
          xp_earned_today: (prev.xp_earned_today ?? 0) + data.xpAwarded,
          last_active_date: getTodayUTC(),
        } : prev);
      } else {
        showToast("Daily XP cap reached");
      }
      setCompletedToday((prev) => new Set([...prev, missionId]));
    }

    setCompleting(null);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading your stats...</p>
      </div>
    );
  }

  const totalXP = gRow?.total_xp ?? 0;
  const levelInfo = getLevelFromXP(totalXP);
  const currentStage = getJourneyStage(levelInfo.level);
  const todayXP = gRow?.last_active_date === getTodayUTC() ? (gRow?.xp_earned_today ?? 0) : 0;
  const capPct = Math.min(100, Math.round((todayXP / DAILY_XP_CAP) * 100));

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-slate-900">Stats</h1>
        <p className="mt-1 text-sm text-slate-600">Your emotional intelligence journey at a glance.</p>
      </div>

      {/* Level hero */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-5xl font-extrabold text-slate-900">{levelInfo.level}</div>
            <div className="mt-1 text-sm font-extrabold text-slate-500">{levelInfo.title}</div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700">
              <Flame size={14} className="text-orange-500" />
              {gRow?.current_streak ?? 0}-day streak
            </div>
            <div className="mt-2 text-xs text-slate-500">{totalXP} / {levelInfo.nextLevel?.xpRequired ?? totalXP} XP total</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Level {levelInfo.level}</span>
            <span>{levelInfo.nextLevel ? `${levelInfo.xpNeeded - levelInfo.xpIntoLevel} XP to Level ${levelInfo.nextLevel.level}` : "Max level reached"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
              style={{ width: `${levelInfo.progressPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total XP", value: totalXP, icon: <BarChart3 size={16} className="text-slate-500" /> },
          { label: "Level", value: levelInfo.level, icon: <Sparkles size={16} className="text-slate-500" /> },
          { label: "Streak", value: `${gRow?.current_streak ?? 0}d`, icon: <Flame size={16} className="text-slate-500" /> },
          { label: "Stars", value: gRow?.stars ?? 0, icon: <Star size={16} className="text-slate-500" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              {s.icon}
              <div className="text-xs font-bold text-slate-500">{s.label}</div>
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Today XP cap */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-extrabold text-slate-900">Today's XP</div>
          <div className="text-xs text-slate-500">{todayXP} / {DAILY_XP_CAP} XP daily cap</div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
            style={{ width: `${capPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">Daily cap is {DAILY_XP_CAP} XP. Only first completion of each activity counts per day.</p>
      </section>

      {/* Daily missions */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList size={16} className="text-slate-500" />
          <div className="text-sm font-extrabold text-slate-900">Today's Missions</div>
        </div>
        <div className="space-y-2">
          {DAILY_MISSIONS.map((m) => {
            const done = completedToday.has(m.id);
            const busy = completing === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={done || !!completing}
                onClick={() => completeMission(m.id, m.key)}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                  done ? "border-slate-100 bg-slate-50 opacity-60" : "border-slate-200 bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                <span className={done ? "text-teal-500" : "text-slate-300"}>
                  {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </span>
                <div className="flex-1">
                  <div className={`text-sm font-extrabold ${done ? "line-through text-slate-400" : "text-slate-900"}`}>{m.title}</div>
                  <div className="text-xs text-slate-500">{m.desc}</div>
                </div>
                <div className="text-xs font-extrabold text-slate-500">
                  {busy ? "..." : done ? "Done" : `+${m.xp} XP`}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Journey Roadmap */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-extrabold text-slate-900">Journey Roadmap</div>
        <div className="space-y-0">
          {JOURNEY_STAGES.map((s, i) => {
            const unlocked = levelInfo.level >= s.unlockLevel;
            const isCurrent = s.stage === currentStage;
            return (
              <div key={s.stage} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={[
                    "h-4 w-4 rounded-full border-2 mt-3 shrink-0",
                    unlocked && isCurrent ? "border-slate-900 bg-white" :
                    unlocked ? "border-slate-900 bg-slate-900" :
                    "border-slate-300 bg-white",
                  ].join(" ")} />
                  {i < JOURNEY_STAGES.length - 1 && (
                    <div className={`w-0.5 flex-1 mt-0 ${unlocked ? "bg-slate-900" : "bg-slate-200"}`} style={{ minHeight: 24 }} />
                  )}
                </div>
                <div className="pb-4">
                  <div className={`text-sm font-extrabold ${unlocked ? "text-slate-900" : "text-slate-400"}`}>{s.name}</div>
                  <div className="text-xs text-slate-500">{unlocked ? s.desc : `Unlocks at Level ${s.unlockLevel}`}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Badge collection */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-1 text-sm font-extrabold text-slate-900">Badge Collection</div>
        <div className="mb-3 text-xs text-slate-500">{unlockedBadges.size} of {BADGES.length} unlocked</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {BADGES.map((b) => {
            const unlocked = unlockedBadges.has(b.key);
            return (
              <div
                key={b.key}
                className={[
                  "rounded-2xl border p-3 transition",
                  unlocked ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-50",
                ].join(" ")}
              >
                <div className={`mb-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-extrabold ${rarityStyle(b.rarity)}`}>
                  {b.rarity}
                </div>
                <div className="text-sm font-extrabold text-slate-900">{b.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{b.cond}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}