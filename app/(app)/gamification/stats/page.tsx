"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getLevelFromXP, getJourneyStage, JOURNEY_STAGES } from "@/lib/gamification";
// ✅ Client-safe — no supabaseAdmin, no server env vars
import { BADGE_DEFINITIONS } from "@/lib/badgeDefinitions";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, Trophy, Sparkles, BarChart3, CheckCircle2, Circle,
  ClipboardList, Star, Zap, TrendingUp, Users, Lock, Award,
  Calendar, ShieldCheck, PenLine, Shield, BookOpen, Target,
  Library, Brain, Leaf, Mountain, Crown, Footprints, Telescope,
  Loader2, ChevronRight,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────── */
type GamificationRow = {
  total_xp: number;
  level: number;
  stars: number;
  current_streak: number;
  longest_streak: number;
  xp_earned_today: number;
  last_active_date: string | null;
};

type MissionRow = {
  id: string;
  title: string;
  description: string;
  activity_key: string;
  xp_reward: number;
  is_active: boolean;
  verification_type?: string;
  requires_reflection?: boolean;
};

type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  total_xp: number;
  level: number;
  rank: number;
  is_me: boolean;
};

type HeatmapDay = { date: string; xp: number; count: number };
type BadgeUnlockEvent = { key: string; label: string; rarity: string };
type XPBurst = { id: number; xp: number; x: number };

/* ─── Badge icons (lucide, no emoji) ────────────────────────────────── */
const BADGE_ICON_MAP: Record<string, React.ReactNode> = {
  "footprints":   <Footprints  size={18} />,
  "pencil-line":  <PenLine     size={18} />,
  "zap":          <Zap         size={18} />,
  "shield":       <Shield      size={18} />,
  "telescope":    <Telescope   size={18} />,
  "sparkles":     <Sparkles    size={18} />,
  "book-open":    <BookOpen    size={18} />,
  "target":       <Target      size={18} />,
  "trending-up":  <TrendingUp  size={18} />,
  "library":      <Library     size={18} />,
  "brain":        <Brain       size={18} />,
  "leaf":         <Leaf        size={18} />,
  "shield-check": <ShieldCheck size={18} />,
  "mountain":     <Mountain    size={18} />,
  "crown":        <Crown       size={18} />,
};

const DAILY_XP_CAP = 15;

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function rarityStyle(rarity: string) {
  if (rarity === "Legendary") return "bg-amber-50 text-amber-700 border-amber-200";
  if (rarity === "Rare")      return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function rarityGlow(rarity: string) {
  if (rarity === "Legendary") return "shadow-[0_0_20px_rgba(251,191,36,0.28)]";
  if (rarity === "Rare")      return "shadow-[0_0_14px_rgba(56,189,248,0.2)]";
  return "";
}

/* ─── Sparkline ──────────────────────────────────────────────────────── */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 100; const H = 28;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * (H - 2) - 1}`)
    .join(" ");
  return (
    <svg width="100" height="28" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.85)" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke="url(#spk)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Heatmap ────────────────────────────────────────────────────────── */
function StreakHeatmap({ data }: { data: HeatmapDay[] }) {
  const weeks = 12;
  const today = new Date();
  const dayMap = new Map(data.map(d => [d.date, d]));
  const days: { date: string; xp: number }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (weeks * 7 - 1 - i));
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, xp: dayMap.get(key)?.xp ?? 0 });
  }
  const getColor = (xp: number) =>
    xp === 0 ? "bg-slate-100" : xp <= 4 ? "bg-teal-200" : xp <= 9 ? "bg-teal-400" : "bg-teal-600";
  const grid: typeof days[] = [];
  for (let w = 0; w < weeks; w++) grid.push(days.slice(w * 7, w * 7 + 7));
  return (
    <div className="flex gap-0.5">
      {grid.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-0.5">
          {week.map((day, di) => (
            <div key={di} title={`${day.date}: ${day.xp} XP`}
              className={`w-3 h-3 rounded-sm cursor-default ${getColor(day.xp)}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Badge Unlock Modal ─────────────────────────────────────────────── */
function BadgeUnlockModal({ badge, onClose }: { badge: BadgeUnlockEvent; onClose: () => void }) {
  const def = BADGE_DEFINITIONS.find(b => b.key === badge.key);
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        initial={{ scale: 0.75, y: 36, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-500 to-sky-500 text-white shadow-lg">
          {def ? BADGE_ICON_MAP[def.icon] ?? <Trophy size={28} /> : <Trophy size={28} />}
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold mb-4 ${rarityStyle(badge.rarity)}`}>
          <Award size={11} /> {badge.rarity}
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-1">Badge Unlocked</h2>
        <p className="text-base font-bold text-slate-700 mb-2">{badge.label}</p>
        <p className="text-sm text-slate-400 mb-6">{def?.cond}</p>
        <button onClick={onClose}
          className="w-full rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 py-3 text-sm font-extrabold text-white hover:opacity-95 transition">
          Continue
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─── XP Burst ───────────────────────────────────────────────────────── */
function XPBurstLayer({ bursts, onDone }: { bursts: XPBurst[]; onDone: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {bursts.map(b => (
          <motion.div key={b.id}
            initial={{ opacity: 1, y: 0, scale: 0.85 }}
            animate={{ opacity: 0, y: -72, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            onAnimationComplete={() => onDone(b.id)}
            className="absolute text-xl font-extrabold text-teal-600 drop-shadow"
            style={{ left: b.x, top: "46vh" }}>
            +{b.xp} XP
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Leaderboard ────────────────────────────────────────────────────── */
function Leaderboard({ entries, loading }: { entries: LeaderboardEntry[]; loading: boolean }) {
  if (loading) return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}
    </div>
  );
  const rankLabel = (r: number) => r === 1 ? "1st" : r === 2 ? "2nd" : r === 3 ? "3rd" : `#${r}`;
  return (
    <div className="space-y-2">
      {entries.map(e => (
        <div key={e.user_id} className={[
          "flex items-center gap-3 rounded-2xl border px-4 py-3 transition",
          e.is_me ? "border-cyan-200 bg-gradient-to-r from-cyan-50 to-teal-50" : "border-slate-100 bg-white",
        ].join(" ")}>
          <div className={[
            "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold",
            e.rank === 1 ? "bg-amber-100 text-amber-700"
              : e.rank === 2 ? "bg-slate-200 text-slate-600"
                : e.rank === 3 ? "bg-orange-100 text-orange-700"
                  : "bg-slate-100 text-slate-500",
          ].join(" ")}>{rankLabel(e.rank)}</div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-extrabold truncate ${e.is_me ? "text-cyan-700" : "text-slate-800"}`}>
              {e.display_name}
              {e.is_me && <span className="ml-2 text-[10px] font-bold text-cyan-400 uppercase tracking-wide">You</span>}
            </div>
            <div className="text-xs text-slate-400">Level {e.level}</div>
          </div>
          <div className="text-sm font-extrabold text-slate-700">{e.total_xp.toLocaleString()} XP</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function StatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gRow, setGRow] = useState<GamificationRow | null>(null);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [unlockedBadges, setUnlockedBadges] = useState<Set<string>>(new Set());
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);
  const [xpBursts, setXpBursts] = useState<XPBurst[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [weeklyXP, setWeeklyXP] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [badgeUnlock, setBadgeUnlock] = useState<BadgeUnlockEvent | null>(null);
  const [prevBadges, setPrevBadges] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const burstIdRef = useRef(0);
  const [personalisedMissions, setPersonalisedMissions] = useState<MissionRow[]>([]);
  const [personalisedReasoning, setPersonalisedReasoning] = useState<string | null>(null);
  const [personalisedLoading, setPersonalisedLoading] = useState(true);
  const [realworldModalMission, setRealworldModalMission] = useState<MissionRow | null>(null);
  const [missionUpdates, setMissionUpdates] = useState<Array<{
    id: string;
    mission_title: string;
    status: "approved" | "rejected" | "pending";
    xp_awarded?: number;
  }>>([]);
  const [expandedUpdate, setExpandedUpdate] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const triggerXPBurst = useCallback((xp: number) => {
    const id = ++burstIdRef.current;
    const x = 40 + Math.random() * ((typeof window !== "undefined" ? window.innerWidth : 400) - 200);
    setXpBursts(prev => [...prev, { id, xp, x }]);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }
      const uid = session.user.id;
      setUserId(uid);
      const today = getTodayUTC();

      const [
        { data: gData },
        { data: badgeData },
        { data: missionCompletions },
        { data: liveMissions },
        { data: txData },
      ] = await Promise.all([
        supabase.from("user_gamification").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_badges").select("badge_key").eq("user_id", uid),
        supabase.from("user_mission_completions")
          .select("mission_id, completed_at, status").eq("user_id", uid).gte("completed_at", today),
        supabase.from("daily_missions")
          .select("id, title, description, activity_key, xp_reward, is_active, verification_type, requires_reflection")
          .eq("is_active", true).order("xp_reward", { ascending: true }),
        supabase.from("xp_transactions")
          .select("activity_key, xp_awarded, created_at").eq("user_id", uid)
          .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
          .order("created_at", { ascending: true }),
      ]);

      if (!alive) return;

      setGRow(gData ?? null);
      setMissions(liveMissions ?? []);

      const badgeSet = new Set((badgeData ?? []).map((b: any) => b.badge_key as string));
      setUnlockedBadges(badgeSet);
      setPrevBadges(new Set(badgeSet));

      // Only mark as completed if approved or platform (no status = old platform mission)
      setCompletedToday(new Set(
        (missionCompletions ?? [])
          .filter((m: any) => {
            if (!m.completed_at?.startsWith(today)) return false;
            // pending real-world should NOT show as done yet
            if (m.status === "pending") return false;
            return true;
          })
          .map((m: any) => m.mission_id as string)
      ));

      const heatMap = new Map<string, { xp: number; count: number }>();
      (txData ?? []).forEach((tx: any) => {
        const day = tx.created_at?.slice(0, 10);
        if (!day) return;
        const p = heatMap.get(day) ?? { xp: 0, count: 0 };
        heatMap.set(day, { xp: p.xp + (tx.xp_awarded ?? 0), count: p.count + 1 });
      });
      setHeatmapData([...heatMap.entries()].map(([date, v]) => ({ date, ...v })));

      const sevenDays: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        sevenDays.push(heatMap.get(d.toISOString().slice(0, 10))?.xp ?? 0);
      }
      setWeeklyXP(sevenDays);
      setLoading(false);

      // Fetch personalised missions
      try {
        const res = await fetch("/api/gamification/personalised-missions", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.ok) {
          setPersonalisedMissions(data.missions ?? []);
          setPersonalisedReasoning(data.reasoning ?? null);
        }
      } catch {}
      setPersonalisedLoading(false);

      // Check mission approval status
      try {
        const res = await fetch("/api/gamification/check-mission-status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.ok && data.missions?.length > 0) {
          setMissionUpdates(data.missions.filter((m: any) => m.status !== "pending"));
        }
      } catch {}

      loadLeaderboard(uid);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`gamification:${userId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_gamification", filter: `user_id=eq.${userId}` },
        p => setGRow(p.new as GamificationRow))
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "user_badges", filter: `user_id=eq.${userId}` },
        p => setUnlockedBadges(prev => new Set([...prev, (p.new as any).badge_key])))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // Realtime listener for mission approval status
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`mission-updates:${userId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_mission_completions", filter: `user_id=eq.${userId}` },
        async (p) => {
          const update = (p.new as any);
          if (update.status !== "pending") {
            setMissionUpdates(prev => {
              const existing = prev.findIndex(m => m.id === update.id);
              if (existing >= 0) {
                const newUpdates = [...prev];
                newUpdates[existing] = {
                  id: update.id,
                  mission_title: newUpdates[existing].mission_title,
                  status: update.status,
                  xp_awarded: update.xp_awarded,
                };
                return newUpdates;
              }
              return prev;
            });
            showToast(update.status === "approved"
              ? `✅ Mission approved! +${update.xp_awarded} XP`
              : "❌ Mission rejected. Try again!");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, showToast]);

  useEffect(() => {
    unlockedBadges.forEach(key => {
      if (!prevBadges.has(key)) {
        const def = BADGE_DEFINITIONS.find(b => b.key === key);
        if (def) setBadgeUnlock({ key, label: def.label, rarity: def.rarity });
      }
    });
    setPrevBadges(new Set(unlockedBadges));
  }, [unlockedBadges]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLeaderboard(uid: string) {
    setLeaderboardLoading(true);
    try {
      const { data } = await supabase
        .from("user_gamification").select("user_id, total_xp, level")
        .order("total_xp", { ascending: false }).limit(10);
      if (!data) return;
      setLeaderboard(data.map((row: any, i: number) => ({
        user_id: row.user_id,
        display_name: row.user_id === uid ? "You" : `Employee ${i + 1}`,
        total_xp: row.total_xp ?? 0, level: row.level ?? 1, rank: i + 1, is_me: row.user_id === uid,
      })));
    } finally { setLeaderboardLoading(false); }
  }

  async function completeMission(missionId: string, activityKey: string) {
    if (completedToday.has(missionId) || completing) return;
    setCompleting(missionId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCompleting(null); return; }
    try {
      const res = await fetch("/api/gamification/award-xp", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ activityKey }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.xpAwarded > 0) {
          setGRow(prev => prev ? {
            ...prev, total_xp: data.totalXP, level: data.level, stars: data.stars,
            current_streak: data.currentStreak, longest_streak: data.longestStreak,
            xp_earned_today: (prev.xp_earned_today ?? 0) + data.xpAwarded, last_active_date: getTodayUTC(),
          } : prev);
          triggerXPBurst(data.xpAwarded);
          showToast(`+${data.xpAwarded} XP earned`);
          setWeeklyXP(prev => { const n = [...prev]; n[n.length - 1] = (n[n.length - 1] ?? 0) + data.xpAwarded; return n; });
        } else {
          showToast("Daily XP cap reached — come back tomorrow");
        }
        setCompletedToday(prev => new Set([...prev, missionId]));
        if (userId) loadLeaderboard(userId);
      } else {
        showToast(data.message ?? "Something went wrong");
      }
    } catch { showToast("Network error — please try again"); }
    finally { setCompleting(null); }
  }

  if (loading) return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}
    </div>
  );

  const totalXP      = gRow?.total_xp ?? 0;
  const levelInfo    = getLevelFromXP(totalXP);
  const currentStage = getJourneyStage(levelInfo.level);
  const todayXP      = gRow?.last_active_date === getTodayUTC() ? (gRow?.xp_earned_today ?? 0) : 0;
  const remainingXP  = Math.max(0, DAILY_XP_CAP - todayXP);
  const capPct       = Math.min(100, Math.round((todayXP / DAILY_XP_CAP) * 100));
  const myRank       = leaderboard.find(e => e.is_me)?.rank;

  return (
    <>
      <XPBurstLayer bursts={xpBursts} onDone={id => setXpBursts(prev => prev.filter(b => b.id !== id))} />
      <AnimatePresence>
        {realworldModalMission && (
          <RealWorldMissionModal
            mission={realworldModalMission}
            onClose={() => setRealworldModalMission(null)}
            onSubmitted={() => {
              setRealworldModalMission(null);
              showToast("Submitted! Waiting for admin approval.");
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {badgeUnlock && <BadgeUnlockModal badge={badgeUnlock} onClose={() => setBadgeUnlock(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-40 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-xl">
            <Zap size={13} className="text-teal-400" />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-500 p-6 shadow-lg">
          <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-10 -right-4 h-32 w-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold text-white/65 uppercase tracking-widest mb-1">Your EI Journey</div>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-extrabold text-white leading-none">{levelInfo.level}</span>
                <div>
                  <div className="text-lg font-extrabold text-white/95">{levelInfo.title}</div>
                  <div className="text-xs text-white/60 mt-0.5">{totalXP.toLocaleString()} XP total</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {myRank && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-extrabold text-white">
                  <Trophy size={11} /> Rank #{myRank}
                </div>
              )}
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-extrabold text-white">
                <Flame size={11} /> {gRow?.current_streak ?? 0}-day streak
              </div>
            </div>
          </div>
          <div className="relative z-10 mt-5">
            <div className="flex items-center justify-between text-xs text-white/65 mb-1.5">
              <span>Level {levelInfo.level}</span>
              <span>{levelInfo.nextLevel ? `${levelInfo.xpNeeded - levelInfo.xpIntoLevel} XP to Level ${levelInfo.nextLevel.level}` : "Max level reached"}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20">
              <motion.div initial={{ width: 0 }} animate={{ width: `${levelInfo.progressPct}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                className="h-full rounded-full bg-white" />
            </div>
          </div>
          <div className="relative z-10 mt-4 flex items-center gap-3">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">7-day XP</span>
            <Sparkline data={weeklyXP} />
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Total XP",    value: totalXP.toLocaleString(),          icon: <BarChart3 size={15} className="text-cyan-500" />  },
            { label: "Level",       value: levelInfo.level,                    icon: <Sparkles  size={15} className="text-amber-500" /> },
            { label: "Best Streak", value: `${gRow?.longest_streak ?? 0}d`,    icon: <Flame     size={15} className="text-orange-500" /> },
            { label: "Stars",       value: gRow?.stars ?? 0,                   icon: <Star      size={15} className="text-amber-400" fill="currentColor" /> },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs font-bold text-slate-500">{s.label}</span></div>
              <div className="text-2xl font-extrabold text-slate-900">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Today's XP cap */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-cyan-500" />
              <span className="text-sm font-extrabold text-slate-900">Today&apos;s XP</span>
            </div>
            <span className="text-xs text-slate-400">
              {todayXP} / {DAILY_XP_CAP} used{remainingXP > 0 && <span className="text-teal-600 ml-1">· {remainingXP} left</span>}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div initial={{ width: 0 }} animate={{ width: `${capPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${capPct >= 100 ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500"}`} />
          </div>
          {capPct >= 100 && <p className="mt-2 text-xs font-bold text-amber-600">Daily cap reached. Come back tomorrow for more XP.</p>}
        </section>

        {/* Mission Status Updates */}
        <AnimatePresence>
          {missionUpdates.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={15} className="text-amber-500" />
                <span className="text-sm font-extrabold text-slate-900">Real-World Mission Status</span>
                <span className="ml-auto text-xs font-bold text-slate-400">{missionUpdates.length} update{missionUpdates.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {missionUpdates.map(update => (
                  <motion.div key={update.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded-xl border px-4 py-3 cursor-pointer transition ${
                      update.status === "approved"
                        ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                        : "border-rose-200 bg-rose-50 hover:bg-rose-100"
                    }`}
                    onClick={() => setExpandedUpdate(expandedUpdate === update.id ? null : update.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                          {update.status === "approved" ? "✅ Approved" : "❌ Rejected"}
                          <span className="text-xs font-bold text-slate-500">{update.mission_title}</span>
                        </div>
                        {update.status === "approved" && update.xp_awarded && (
                          <div className="text-xs text-emerald-700 mt-1 font-bold">+{update.xp_awarded} XP awarded!</div>
                        )}
                        {update.status === "rejected" && (
                          <div className="text-xs text-rose-700 mt-1">Try submitting a more detailed reflection next time.</div>
                        )}
                      </div>
                      <ChevronRight size={16} className={`shrink-0 text-slate-400 transition-transform ${expandedUpdate === update.id ? "rotate-90" : ""}`} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Personalised Missions */}
        {personalisedMissions.length > 0 && (
          <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/40 to-cyan-50/40 p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={15} className="text-violet-500" />
              <span className="text-sm font-extrabold text-slate-900">Personalised for You</span>
              <span className="ml-auto text-xs font-bold text-violet-600">AI-recommended</span>
            </div>
            {personalisedReasoning && (
              <div className="mb-3 rounded-lg bg-white/60 border border-violet-100 px-3 py-2 text-xs text-slate-700 leading-relaxed">
                💡 {personalisedReasoning}
              </div>
            )}
            <div className="space-y-2">
              {personalisedMissions.map(m => {
                const done = completedToday.has(m.id);
                const busy = completing === m.id;
                const isRealworld = m.verification_type === "realworld";
                return (
                  <motion.button key={m.id} type="button"
                    disabled={done || !!completing}
                    onClick={() => isRealworld ? setRealworldModalMission(m) : completeMission(m.id, m.activity_key)}
                    whileTap={!done ? { scale: 0.985 } : {}}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition",
                      done ? "border-teal-100 bg-teal-50" : "border-violet-200 bg-white hover:border-violet-300 shadow-sm",
                    ].join(" ")}>
                    <span className={done ? "text-teal-500" : "text-violet-400"}>
                      {done ? <CheckCircle2 size={20} /> : isRealworld ? <Sparkles size={20} /> : <Circle size={20} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`text-sm font-extrabold ${done ? "line-through text-slate-400" : "text-slate-900"}`}>{m.title}</div>
                        {isRealworld && (
                          <span className="rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[9px] font-extrabold">🌍 Real-world</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{m.description}</div>
                    </div>
                    <span className={`text-xs font-extrabold shrink-0 ${done ? "text-teal-500" : "text-violet-600"}`}>
                      {busy ? "..." : done ? "Done" : `+${m.xp_reward} XP`}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </section>
        )}

        {/* All Missions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList size={15} className="text-cyan-500" />
            <span className="text-sm font-extrabold text-slate-900">All Available Missions</span>
            <span className="ml-auto text-xs font-bold text-slate-400">{completedToday.size}/{missions.length} done</span>
          </div>
          {missions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No active missions right now.</p>
          ) : (
            <div className="space-y-2">
              {missions.map(m => {
                const done = completedToday.has(m.id);
                const busy = completing === m.id;
                const isRealworld = m.verification_type === "realworld";
                return (
                  <motion.button key={m.id} type="button"
                    disabled={done || !!completing || (remainingXP <= 0 && !isRealworld)}
                    onClick={() => isRealworld ? setRealworldModalMission(m) : completeMission(m.id, m.activity_key)}
                    whileTap={!done ? { scale: 0.985 } : {}}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition",
                      done ? "border-teal-100 bg-teal-50"
                        : remainingXP <= 0 && !isRealworld ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                          : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50 shadow-sm",
                    ].join(" ")}>
                    <span className={done ? "text-teal-500" : "text-slate-300"}>
                      {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`text-sm font-extrabold ${done ? "line-through text-slate-400" : "text-slate-900"}`}>{m.title}</div>
                        {isRealworld && (
                          <span className="rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[9px] font-extrabold">🌍 Real-world</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{m.description}</div>
                    </div>
                    <span className={`text-xs font-extrabold shrink-0 ${done ? "text-teal-500" : "text-slate-500"}`}>
                      {busy ? "..." : done ? "Done" : `+${m.xp_reward} XP`}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>

        {/* Heatmap */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Calendar size={15} className="text-cyan-500" />
            <span className="text-sm font-extrabold text-slate-900">Activity Heatmap</span>
            <span className="text-xs text-slate-400 ml-1">Last 12 weeks</span>
          </div>
          <div className="overflow-x-auto"><StreakHeatmap data={heatmapData} /></div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
            <span>Less</span>
            {["bg-slate-100", "bg-teal-200", "bg-teal-400", "bg-teal-600"].map(c => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span>More</span>
          </div>
        </section>

        

        {/* Journey Roadmap */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-cyan-500" />
            <span className="text-sm font-extrabold text-slate-900">Journey Roadmap</span>
          </div>
          <div className="space-y-0">
            {JOURNEY_STAGES.map((s, i) => {
              const unlocked = levelInfo.level >= s.unlockLevel;
              const isCurrent = s.stage === currentStage;
              return (
                <div key={s.stage} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={[
                      "h-4 w-4 rounded-full border-2 mt-3 shrink-0 transition-all",
                      unlocked && isCurrent ? "border-cyan-500 bg-white ring-2 ring-cyan-200"
                        : unlocked ? "border-slate-900 bg-slate-900"
                          : "border-slate-200 bg-white",
                    ].join(" ")} />
                    {i < JOURNEY_STAGES.length - 1 && (
                      <div className={`w-0.5 flex-1 ${unlocked ? "bg-slate-900" : "bg-slate-200"}`} style={{ minHeight: 24 }} />
                    )}
                  </div>
                  <div className="pb-4">
                    <div className={`text-sm font-extrabold flex items-center gap-2 ${unlocked ? "text-slate-900" : "text-slate-400"}`}>
                      {s.name}
                      {isCurrent && <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 border border-cyan-200 rounded-full px-2 py-0.5">Current</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {unlocked ? s.desc : <span className="flex items-center gap-1"><Lock size={10} /> Unlocks at Level {s.unlockLevel}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Badge Collection */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <Trophy size={15} className="text-amber-500" />
            <span className="text-sm font-extrabold text-slate-900">Badge Collection</span>
          </div>
          <p className="mb-4 text-xs text-slate-400">{unlockedBadges.size} of {BADGE_DEFINITIONS.length} unlocked</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {BADGE_DEFINITIONS.map(b => {
              const unlocked = unlockedBadges.has(b.key);
              return (
                <div key={b.key} className={[
                  "rounded-2xl border p-4 transition-all",
                  unlocked ? `border-slate-200 bg-white ${rarityGlow(b.rarity)}` : "border-slate-100 bg-slate-50 opacity-45 grayscale",
                ].join(" ")}>
                  <div className={[
                    "mb-3 grid h-10 w-10 place-items-center rounded-xl",
                    unlocked ? "bg-gradient-to-br from-teal-400 via-cyan-500 to-sky-500 text-white" : "bg-slate-200 text-slate-400",
                  ].join(" ")}>
                    {unlocked ? (BADGE_ICON_MAP[b.icon] ?? <Trophy size={18} />) : <Lock size={16} />}
                  </div>
                  <div className={`mb-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${rarityStyle(b.rarity)}`}>
                    {b.rarity}
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 mt-1">{b.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{b.cond}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

/* ─── Real-World Mission Submission Modal ──────────────────────────── */
function RealWorldMissionModal({ mission, onClose, onSubmitted }: {
  mission: MissionRow;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (reflection.trim().length < 20) {
      setErr("Please write at least 20 characters of reflection.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/gamification/submit-mission-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ mission_id: mission.id, reflection_text: reflection.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onSubmitted();
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-cyan-400 text-white shadow-sm">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-900">{mission.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">🌍 Real-world mission · Needs admin approval</div>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4">{mission.description}</p>

        <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-xs text-violet-800 leading-relaxed mb-4">
          ✏️ Complete the mission in real life, then write a short reflection below. Admin will review and award you +{mission.xp_reward} XP.
        </div>

        <div className="mb-4">
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
            Your Reflection <span className="text-rose-500">*</span>
          </label>
          <textarea value={reflection} onChange={e => setReflection(e.target.value)} rows={5}
            placeholder="What did you do? How did it feel? What did you learn?"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none" />
          <div className="text-[10px] text-slate-400 mt-1">{reflection.length}/20 minimum characters</div>
        </div>

        {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 mb-3">{err}</div>}

        <div className="flex gap-2">
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 shadow-sm">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}