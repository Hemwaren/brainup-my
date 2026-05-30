import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchCalendarSignals, fetchGmailSignals,
  getMockCalendarSignals, getMockGmailSignals,
} from "@/lib/googleSignals";

async function authoriseHR(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  const role = String(profile?.role ?? "").toUpperCase();
  if (!["HR", "ADMIN"].includes(role)) return null;
  return user;
}

function daysBetween(dateStr: string, now: Date) {
  return Math.max(0, Math.floor(
    (now.getTime() - new Date(dateStr).getTime()) / 86_400_000
  ));
}

// ─── BrainUp in-app signal computation ───────────────────────────────────────
function computeInAppScore(
  avgCheckin: number,
  checkinDelta: number,
  lowMoodDays: number,
  journalCount: number,
  journalDelta: number,
  latestEI: number,
  eiDelta: number,
  lastLoginDays: number,
  xpDelta: number,
  streak: number,
): { mood: number; journal: number; ei: number; engagement: number } {
  // Mood
  let moodS = (avgCheckin / 5) * 100;
  if (checkinDelta < 0) moodS -= Math.abs(checkinDelta) * 8;
  moodS -= lowMoodDays * 5;
  moodS = Math.max(0, Math.min(100, moodS || 50));

  // Journal
  let journalS = Math.min(journalCount / 5, 1) * 100;
  if (journalDelta < 0) journalS -= Math.abs(journalDelta) * 10;
  journalS = Math.max(0, Math.min(100, journalS));

  // EI
  let eiS = latestEI > 0 ? (latestEI / 100) * 100 : 50;
  if (eiDelta > 0) eiS = Math.min(100, eiS + 5);
  if (eiDelta < 0) eiS = Math.max(0, eiS - 10);

  // Engagement
  let engS = 100;
  if (lastLoginDays > 14) engS -= 40;
  else if (lastLoginDays > 7) engS -= 20;
  else if (lastLoginDays > 3) engS -= 10;
  if (xpDelta < 0) engS -= 15;
  if (xpDelta === 0) engS -= 8;
  engS += Math.min(streak * 2, 20);
  engS = Math.max(0, Math.min(100, Math.round(engS)));

  return {
    mood: Math.round(moodS),
    journal: Math.round(journalS),
    ei: Math.round(eiS),
    engagement: engS,
  };
}

// ─── Work behaviour signal ────────────────────────────────────────────────────
function computeWorkBehaviourScore(
  activeMinutes: number,
  idleMinutes: number,
  idleSpikes: number,
  afterHours: number,
  deltaActiveMinutes: number,
): { score: number; signal: string } {
  const total = activeMinutes + idleMinutes;
  if (total === 0) return { score: 50, signal: "NO_DATA" };

  const activeRatio = activeMinutes / total;
  let score = activeRatio * 100;
  score -= idleSpikes * 5;
  score -= afterHours * 3;
  if (deltaActiveMinutes < 0) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const signal =
    score >= 70 ? "HIGH"
    : score >= 45 ? "MEDIUM"
    : "LOW";

  return { score, signal };
}

// ─── Risk level ───────────────────────────────────────────────────────────────
function riskLevel(score: number) {
  if (score >= 75) return "THRIVING";
  if (score >= 50) return "MONITOR";
  if (score >= 25) return "NEEDS ATTENTION";
  return "CRITICAL";
}

function groupBy(arr: any[], key: string): Record<string, any[]> {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function groupSum(
  arr: any[], groupKey: string, sumKey: string
): Record<string, number> {
  return arr.reduce((acc, item) => {
    acc[item[groupKey]] = (acc[item[groupKey]] ?? 0) + (item[sumKey] ?? 0);
    return acc;
  }, {});
}

// ─── GET /api/hr/wellbeing/team-overview ──────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const hrUser = await authoriseHR(req);
    if (!hrUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();

    // 1. All employees
    const { data: employees } = await supabaseAdmin
  .from("profiles")
  .select("id, full_name, department, avatar_url")
  .eq("role", "EMPLOYEE");

// Fetch emails from auth.users
const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
const emailMap = Object.fromEntries(
  (authUsers?.users ?? []).map(u => [u.id, u.email ?? "—"])
);

    if (!employees || employees.length === 0) {
      return NextResponse.json({ employees: [] });
    }

    const ids = employees.map(e => e.id);

    // 2. Check which employees have Google connected
    const { data: integrations } = await supabaseAdmin
      .from("user_integrations")
      .select("user_id")
      .in("user_id", ids)
      .eq("provider", "google");

    const connectedIds = new Set((integrations ?? []).map(i => i.user_id));

    // 3. BrainUp in-app data — parallel fetch
    const [
      checkinsTW, checkinsLW,
      journalsTW, journalsLW,
      eiResults, gamData,
      xpTW, xpLW,
    ] = await Promise.all([
      supabaseAdmin.from("emotion_checkins")
        .select("user_id, emotion_level")
        .in("user_id", ids).gte("checked_in_at", sevenDaysAgo),

      supabaseAdmin.from("emotion_checkins")
        .select("user_id, emotion_level")
        .in("user_id", ids)
        .gte("checked_in_at", fourteenDaysAgo)
        .lt("checked_in_at", sevenDaysAgo),

      supabaseAdmin.from("journal_entries")
        .select("user_id")
        .in("user_id", ids).gte("created_at", sevenDaysAgo),

      supabaseAdmin.from("journal_entries")
        .select("user_id")
        .in("user_id", ids)
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo),

      supabaseAdmin.from("ei_assessment_results")
        .select("user_id, overall_score, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false }),

      supabaseAdmin.from("user_gamification")
        .select("user_id, current_streak, last_active_date")
        .in("user_id", ids),

      supabaseAdmin.from("xp_transactions")
        .select("user_id, xp_awarded")
        .in("user_id", ids).gte("created_at", sevenDaysAgo),

      supabaseAdmin.from("xp_transactions")
        .select("user_id, xp_awarded")
        .in("user_id", ids)
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo),
    ]);

    // 4. Work behaviour — this week + last week
    const [wbTW, wbLW] = await Promise.all([
      supabaseAdmin.from("work_behaviour_logs")
        .select("user_id, active_minutes, idle_minutes, idle_spikes, after_hours")
        .in("user_id", ids).gte("date", sevenDaysAgo.slice(0, 10)),

      supabaseAdmin.from("work_behaviour_logs")
        .select("user_id, active_minutes")
        .in("user_id", ids)
        .gte("date", fourteenDaysAgo.slice(0, 10))
        .lt("date", sevenDaysAgo.slice(0, 10)),
    ]);

    // 5. Index data
    const checkinsTWMap = groupBy(checkinsTW.data ?? [], "user_id");
    const checkinsLWMap = groupBy(checkinsLW.data ?? [], "user_id");
    const journalsTWMap = groupBy(journalsTW.data ?? [], "user_id");
    const journalsLWMap = groupBy(journalsLW.data ?? [], "user_id");
    const xpTWMap = groupSum(xpTW.data ?? [], "user_id", "xp_awarded");
    const xpLWMap = groupSum(xpLW.data ?? [], "user_id", "xp_awarded");
    const gamMap = Object.fromEntries(
      (gamData.data ?? []).map(g => [g.user_id, g])
    );
    const wbTWMap = groupBy(wbTW.data ?? [], "user_id");
    const wbLWMap = groupBy(wbLW.data ?? [], "user_id");

    // Latest EI per user
    const eiLatest: Record<string, number> = {};
    const eiPrev: Record<string, number> = {};
    for (const r of (eiResults.data ?? [])) {
      if (!(r.user_id in eiLatest)) eiLatest[r.user_id] = r.overall_score;
      else if (!(r.user_id in eiPrev)) eiPrev[r.user_id] = r.overall_score;
    }

    // 6. Fetch Google signals per employee in parallel
    const googleSignals = await Promise.all(
      employees.map(async emp => {
        if (connectedIds.has(emp.id)) {
          const [cal, gmail] = await Promise.all([
            fetchCalendarSignals(emp.id),
            fetchGmailSignals(emp.id),
          ]);
          return { userId: emp.id, cal, gmail };
        } else {
          return {
            userId: emp.id,
            cal: getMockCalendarSignals(emp.id),
            gmail: getMockGmailSignals(emp.id),
          };
        }
      })
    );

    const googleMap = Object.fromEntries(
      googleSignals.map(g => [g.userId, g])
    );

    // 7. Compute per employee
    const results = employees.map(emp => {
      // In-app signals
      const twC = checkinsTWMap[emp.id] ?? [];
      const lwC = checkinsLWMap[emp.id] ?? [];
      const avgTW = twC.length
        ? twC.reduce((s: number, c: any) => s + c.emotion_level, 0) / twC.length
        : 0;
      const avgLW = lwC.length
        ? lwC.reduce((s: number, c: any) => s + c.emotion_level, 0) / lwC.length
        : 0;
      const moodDelta = avgTW - avgLW;
      const lowMoodDays = twC.filter((c: any) => c.emotion_level <= 2).length;
      const journalTW = journalsTWMap[emp.id]?.length ?? 0;
      const journalLW = journalsLWMap[emp.id]?.length ?? 0;
      const journalDelta = journalTW - journalLW;
      const latestEI = eiLatest[emp.id] ?? 0;
      const prevEI = eiPrev[emp.id] ?? latestEI;
      const eiDelta = latestEI - prevEI;
      const gam = gamMap[emp.id];
      const lastLoginDays = gam?.last_active_date
        ? daysBetween(gam.last_active_date, now) : 99;
      const xpDelta = (xpTWMap[emp.id] ?? 0) - (xpLWMap[emp.id] ?? 0);
      const streak = gam?.current_streak ?? 0;

      const inApp = computeInAppScore(
        avgTW, moodDelta, lowMoodDays,
        journalTW, journalDelta,
        latestEI, eiDelta,
        lastLoginDays, xpDelta, streak,
      );

      // Work behaviour signals
      const wbRows = wbTWMap[emp.id] ?? [];
      const wbLWRows = wbLWMap[emp.id] ?? [];
      const activeMinutes = wbRows.reduce((s: number, r: any) => s + r.active_minutes, 0);
      const idleMinutes = wbRows.reduce((s: number, r: any) => s + r.idle_minutes, 0);
      const idleSpikes = wbRows.reduce((s: number, r: any) => s + r.idle_spikes, 0);
      const afterHoursCount = wbRows.filter((r: any) => r.after_hours).length;
      const activeMinutesLW = wbLWRows.reduce((s: number, r: any) => s + r.active_minutes, 0);
      const deltaActive = activeMinutes - activeMinutesLW;

      const wb = computeWorkBehaviourScore(
        activeMinutes, idleMinutes, idleSpikes, afterHoursCount, deltaActive
      );

      // Google signals
      const { cal, gmail } = googleMap[emp.id];

      // Combined in-app score (average of 4 in-app sub-signals)
      const inAppAvg = Math.round(
        (inApp.mood + inApp.journal + inApp.ei + inApp.engagement) / 4
      );

      // Final risk score — 4 sources × 25% each
      const riskScore = Math.round(
        cal.score * 0.25 +
        gmail.score * 0.25 +
        inAppAvg * 0.25 +
        wb.score * 0.25
      );

      // Mood signal label
      const moodSignal =
        avgTW === 0 ? "NO_DATA"
        : avgTW >= 3.5 ? "GOOD"
        : avgTW >= 2.5 ? "WARNING"
        : "AT_RISK";

      return {
        id: emp.id,
        name: emp.full_name ?? "Unknown",
        email: emailMap[emp.id] ?? "—",
        department: emp.department ?? "—",
        avatar_url: emp.avatar_url,
        google_connected: connectedIds.has(emp.id),
        risk_score: riskScore,
        risk_level: riskLevel(riskScore),
        signals: {
          calendar: {
            meeting_hours: cal.meeting_hours_this_week,
            after_hours: cal.after_hours_meetings,
            back_to_back: cal.back_to_back_meetings,
            focus_ratio: cal.focus_time_ratio,
            signal: cal.signal,
            score: cal.score,
          },
          gmail: {
            sent_this_week: gmail.emails_sent_this_week,
            after_hours_emails: gmail.after_hours_emails,
            volume_delta: gmail.volume_delta,
            signal: gmail.signal,
            score: gmail.score,
          },
          inapp: {
            mood_avg: Math.round(avgTW * 10) / 10,
            mood_signal: moodSignal,
            journal_count: journalTW,
            ei_score: latestEI,
            last_login_days: lastLoginDays,
            score: inAppAvg,
          },
          work_behaviour: {
            active_minutes: activeMinutes,
            idle_minutes: idleMinutes,
            idle_spikes: idleSpikes,
            after_hours: afterHoursCount,
            signal: wb.signal,
            score: wb.score,
          },
        },
      };
    });

    // Sort most at-risk first
    results.sort((a, b) => a.risk_score - b.risk_score);

    return NextResponse.json({ employees: results });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}