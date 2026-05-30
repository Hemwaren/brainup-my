import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchCalendarSignals, fetchGmailSignals,
} from "@/lib/googleSignals";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";

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

function riskLevel(score: number) {
  if (score >= 75) return "THRIVING";
  if (score >= 50) return "MONITOR";
  if (score >= 25) return "NEEDS ATTENTION";
  return "CRITICAL";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const hrUser = await authoriseHR(req);
    if (!hrUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const skipGroq = new URL(req.url).searchParams.get("skipAI") === "1";
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    // 1. All data in parallel
    const [
      profileRes,
      checkinsTW, checkinsLW,
      journalsTW, journalsLW,
      eiResults, gamRes,
      xpTW, xpLW,
      missionsTW,
      supportTickets,
      consultations,
      hrActions,
      wbTW, wbLW,
      integrationRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles")
        .select("id, full_name, department, avatar_url, gender, age")
        .eq("id", userId).single(),

      supabaseAdmin.from("emotion_checkins")
        .select("emotion_level, emotion_tag, checked_in_at")
        .eq("user_id", userId).gte("checked_in_at", sevenDaysAgo),

      supabaseAdmin.from("emotion_checkins")
        .select("emotion_level")
        .eq("user_id", userId)
        .gte("checked_in_at", fourteenDaysAgo)
        .lt("checked_in_at", sevenDaysAgo),

      supabaseAdmin.from("journal_entries")
        .select("content, ai_emotion, created_at")
        .eq("user_id", userId).gte("created_at", sevenDaysAgo),

      supabaseAdmin.from("journal_entries")
        .select("id").eq("user_id", userId)
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo),

      supabaseAdmin.from("ei_assessment_results")
        .select("overall_score, ea_score, eu_score, eus_score, ec_score, brain_style, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(2),

      supabaseAdmin.from("user_gamification")
        .select("total_xp, level, current_streak, longest_streak, last_active_date")
        .eq("user_id", userId).single(),

      supabaseAdmin.from("xp_transactions")
        .select("xp_awarded").eq("user_id", userId).gte("created_at", sevenDaysAgo),

      supabaseAdmin.from("xp_transactions")
        .select("xp_awarded").eq("user_id", userId)
        .gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo),

      supabaseAdmin.from("user_mission_completions")
        .select("status").eq("user_id", userId).gte("completed_at", sevenDaysAgo),

      supabaseAdmin.from("support_tickets")
        .select("status, created_at").eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo),

      supabaseAdmin.from("consultations")
        .select("status, scheduled_at").eq("employee_id", userId)
        .gte("created_at", thirtyDaysAgo),

      supabaseAdmin.from("wellbeing_actions")
        .select("action_type, notes, created_at")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false }).limit(5),

      supabaseAdmin.from("work_behaviour_logs")
        .select("active_minutes, idle_minutes, idle_spikes, after_hours, date")
        .eq("user_id", userId).gte("date", sevenDaysAgo.slice(0, 10)),

      supabaseAdmin.from("work_behaviour_logs")
        .select("active_minutes")
        .eq("user_id", userId)
        .gte("date", fourteenDaysAgo.slice(0, 10))
        .lt("date", sevenDaysAgo.slice(0, 10)),

      supabaseAdmin.from("user_integrations")
        .select("user_id").eq("user_id", userId)
        .eq("provider", "google").maybeSingle(),
    ]);

    const profile = profileRes.data;
    if (!profile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const googleConnected = !!integrationRes.data;

    // 2. Google signals
    const [cal, gmail] = await Promise.all([
      googleConnected
        ? fetchCalendarSignals(userId)
        : Promise.resolve({
            meeting_hours_this_week: 0,
            meeting_hours_last_week: 0,
            after_hours_meetings: 0,
            back_to_back_meetings: 0,
            focus_time_ratio: 1,
            signal: "NO_DATA" as const,
            score: 50,
          }),
      googleConnected
        ? fetchGmailSignals(userId)
        : Promise.resolve({
            emails_sent_this_week: 0,
            emails_sent_last_week: 0,
            after_hours_emails: 0,
            avg_response_time_hours: 0,
            volume_delta: 0,
            signal: "NO_DATA" as const,
            score: 50,
          }),
    ]);

    // 3. BrainUp in-app signals
    const twC = checkinsTW.data ?? [];
    const lwC = checkinsLW.data ?? [];
    const avgTW = twC.length
      ? twC.reduce((s, c) => s + c.emotion_level, 0) / twC.length : 0;
    const avgLW = lwC.length
      ? lwC.reduce((s, c) => s + c.emotion_level, 0) / lwC.length : 0;
    const moodDelta = Math.round((avgTW - avgLW) * 10) / 10;
    const lowMoodDays = twC.filter(c => c.emotion_level <= 2).length;
    const moodSignal =
      avgTW === 0 ? "NO_DATA"
      : avgTW >= 3.5 ? "GOOD"
      : avgTW >= 2.5 ? "WARNING"
      : "AT_RISK";
    const recentEmotions = twC.map(c => c.emotion_tag).filter(Boolean).slice(0, 5);

    let moodS = (avgTW / 5) * 100;
    if (moodDelta < 0) moodS -= Math.abs(moodDelta) * 8;
    moodS -= lowMoodDays * 5;
    moodS = Math.max(0, Math.min(100, moodS || 50));

    const twJ = journalsTW.data ?? [];
    const journalDelta = twJ.length - (journalsLW.data?.length ?? 0);
    const journalSignal =
      twJ.length >= 3 ? "ACTIVE"
      : twJ.length >= 1 ? "DECLINING"
      : "DISENGAGED";
    const aiEmotions = twJ.map(j => j.ai_emotion).filter(Boolean);
    const journalTone =
      aiEmotions.length === 0 ? "NEUTRAL"
      : aiEmotions.filter(e =>
          ["sad", "anxious", "angry", "stressed"]
          .includes(String(e).toLowerCase())
        ).length > aiEmotions.length / 2
        ? "NEGATIVE_TRENDING"
        : "POSITIVE";

    let journalS = Math.min(twJ.length / 5, 1) * 100;
    if (journalDelta < 0) journalS -= Math.abs(journalDelta) * 10;
    journalS = Math.max(0, Math.min(100, journalS));

    const eiData = eiResults.data ?? [];
    const latestEI = eiData[0];
    const prevEI = eiData[1];
    const eiDelta = latestEI && prevEI
      ? latestEI.overall_score - prevEI.overall_score : 0;
    const eiSignal =
      !latestEI ? "NO_DATA"
      : eiDelta > 0 ? "GROWING"
      : eiDelta === 0 ? "STABLE"
      : "DECLINING";
    const dimLabels: Record<string, number | null> = {
      EA: latestEI?.ea_score ?? null,
      EU: latestEI?.eu_score ?? null,
      EUS: latestEI?.eus_score ?? null,
      EC: latestEI?.ec_score ?? null,
    };
    const weakestDim = latestEI
      ? Object.entries(dimLabels)
          .filter(([, v]) => v !== null)
          .reduce((a, b) => (b[1]! < a[1]! ? b : a))[0]
      : "N/A";

    let eiS = latestEI ? (latestEI.overall_score / 100) * 100 : 50;
    if (eiDelta > 0) eiS = Math.min(100, eiS + 5);
    if (eiDelta < 0) eiS = Math.max(0, eiS - 10);

    const gam = gamRes.data;
    const lastLoginDays = gam?.last_active_date
      ? daysBetween(gam.last_active_date, now) : 99;
    const xpTWTotal = (xpTW.data ?? []).reduce((s, x) => s + x.xp_awarded, 0);
    const xpLWTotal = (xpLW.data ?? []).reduce((s, x) => s + x.xp_awarded, 0);
    const xpDelta = xpTWTotal - xpLWTotal;
    const streak = gam?.current_streak ?? 0;
    const missions = missionsTW.data ?? [];
    const missionRate = missions.length > 0
      ? Math.round(
          missions.filter(m => m.status === "APPROVED").length /
          missions.length * 100
        )
      : 0;
    const engSignal =
      lastLoginDays <= 2 ? "HIGH"
      : lastLoginDays <= 7 ? "MEDIUM"
      : "LOW";

    let engS = 100;
    if (lastLoginDays > 14) engS -= 40;
    else if (lastLoginDays > 7) engS -= 20;
    else if (lastLoginDays > 3) engS -= 10;
    if (xpDelta < 0) engS -= 15;
    if (xpDelta === 0) engS -= 8;
    engS += Math.min(streak * 2, 20);
    engS = Math.max(0, Math.min(100, Math.round(engS)));

    const inAppAvg = Math.round((moodS + journalS + eiS + engS) / 4);

    // 4. Work behaviour signals
    const wbRows = wbTW.data ?? [];
    const wbLWRows = wbLW.data ?? [];
    const activeMinutes = wbRows.reduce((s, r) => s + r.active_minutes, 0);
    const idleMinutes = wbRows.reduce((s, r) => s + r.idle_minutes, 0);
    const idleSpikes = wbRows.reduce((s, r) => s + r.idle_spikes, 0);
    const afterHoursCount = wbRows.filter(r => r.after_hours).length;
    const activeMinutesLW = wbLWRows.reduce((s, r) => s + r.active_minutes, 0);
    const deltaActive = activeMinutes - activeMinutesLW;

    const total = activeMinutes + idleMinutes;
    const activeRatio = total > 0 ? activeMinutes / total : 0.5;
    let wbScore = activeRatio * 100;
    wbScore -= idleSpikes * 5;
    wbScore -= afterHoursCount * 3;
    if (deltaActive < 0) wbScore -= 10;
    wbScore = Math.max(0, Math.min(100, Math.round(wbScore)));
    const wbSignal =
      wbScore >= 70 ? "HIGH"
      : wbScore >= 45 ? "MEDIUM"
      : total === 0 ? "NO_DATA"
      : "LOW";

    // 5. Final risk score — 4 sources × 25%
    const riskScore = Math.round(
      cal.score * 0.25 +
      gmail.score * 0.25 +
      inAppAvg * 0.25 +
      wbScore * 0.25
    );
    const risk = riskLevel(riskScore);

    // 6. Groq narrative
    let groqResult = null;
    if (GROQ_KEY && !skipGroq) {
      const prompt = `You are a compassionate workplace wellbeing analyst for a Malaysian SME.
Analyse these signals for an employee and produce a wellbeing report.

CALENDAR SIGNALS: { meeting_hours: ${cal.meeting_hours_this_week}, after_hours_meetings: ${cal.after_hours_meetings}, back_to_back: ${cal.back_to_back_meetings}, focus_ratio: ${cal.focus_time_ratio}, signal: "${cal.signal}" }
GMAIL SIGNALS: { sent_this_week: ${gmail.emails_sent_this_week}, after_hours_emails: ${gmail.after_hours_emails}, volume_delta: ${gmail.volume_delta}, signal: "${gmail.signal}" }
IN-APP SIGNALS: { mood_avg: ${Math.round(avgTW * 10) / 10}, mood_delta: ${moodDelta}, journal_count: ${twJ.length}, journal_tone: "${journalTone}", ei_score: ${latestEI?.overall_score ?? "N/A"}, ei_delta: ${eiDelta}, last_login_days: ${lastLoginDays}, streak: ${streak}, signal_summary: "mood=${moodSignal}, journal=${journalSignal}, ei=${eiSignal}, engagement=${engSignal}" }
WORK BEHAVIOUR: { active_minutes: ${activeMinutes}, idle_minutes: ${idleMinutes}, idle_spikes: ${idleSpikes}, after_hours_days: ${afterHoursCount}, active_delta: ${deltaActive}, signal: "${wbSignal}" }
OVERALL RISK SCORE: ${riskScore}/100

Step 1: What do calendar signals suggest about workload?
Step 2: What do Gmail signals suggest about communication stress?
Step 3: What do in-app signals suggest about emotional state?
Step 4: What do work behaviour signals suggest about engagement?
Step 5: Are these signals correlated or contradictory?
Step 6: Final risk assessment.

Return ONLY valid JSON:
{
  "risk_level": "${risk}",
  "narrative": "2-3 sentence human readable summary",
  "calendar_insight": "one sentence",
  "gmail_insight": "one sentence",
  "inapp_insight": "one sentence",
  "workbehaviour_insight": "one sentence",
  "recommendations": ["action 1", "action 2", "action 3"]
}`;

      try {
        const groqRes = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "You are a workplace EI wellbeing analyst. Respond only with valid JSON.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 700,
            response_format: { type: "json_object" },
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const raw = groqData?.choices?.[0]?.message?.content ?? "{}";
          groqResult = JSON.parse(raw);
        } else {
          const errText = await groqRes.text();
          console.error("Groq failed:", groqRes.status, errText);
        }
      } catch (e) { 
        console.error("Groq exception:", e);
      }
    }

    return NextResponse.json({
      employee: {
        id: profile.id,
        name: profile.full_name,
        department: profile.department,
        avatar_url: profile.avatar_url,
        google_connected: googleConnected,
      },
      risk_score: riskScore,
      risk_level: risk,
      signals: {
        calendar: {
          meeting_hours_this_week: cal.meeting_hours_this_week,
          meeting_hours_last_week: cal.meeting_hours_last_week,
          after_hours_meetings: cal.after_hours_meetings,
          back_to_back_meetings: cal.back_to_back_meetings,
          focus_time_ratio: cal.focus_time_ratio,
          signal: cal.signal,
          score: cal.score,
          is_mock: !googleConnected,
        },
        gmail: {
          emails_sent_this_week: gmail.emails_sent_this_week,
          emails_sent_last_week: gmail.emails_sent_last_week,
          after_hours_emails: gmail.after_hours_emails,
          volume_delta: gmail.volume_delta,
          signal: gmail.signal,
          score: gmail.score,
          is_mock: !googleConnected,
        },
        inapp: {
          mood: {
            avg: Math.round(avgTW * 10) / 10,
            delta: moodDelta,
            low_mood_days: lowMoodDays,
            checkin_count: twC.length,
            recent_emotions: recentEmotions,
            signal: moodSignal,
          },
          journal: {
            count: twJ.length,
            delta: journalDelta,
            tone: journalTone,
            signal: journalSignal,
          },
          ei: {
            latest_score: latestEI?.overall_score ?? null,
            delta: eiDelta,
            weakest_dimension: weakestDim,
            brain_style: latestEI?.brain_style ?? null,
            ea: latestEI?.ea_score ?? null,
            eu: latestEI?.eu_score ?? null,
            eus: latestEI?.eus_score ?? null,
            ec: latestEI?.ec_score ?? null,
            signal: eiSignal,
          },
          engagement: {
            last_login_days: lastLoginDays,
            xp_delta: xpDelta,
            streak,
            level: gam?.level ?? 1,
            mission_rate: missionRate,
            signal: engSignal,
          },
          score: inAppAvg,
        },
        work_behaviour: {
          active_minutes: activeMinutes,
          idle_minutes: idleMinutes,
          idle_spikes: idleSpikes,
          after_hours_days: afterHoursCount,
          active_delta: deltaActive,
          signal: wbSignal,
          score: wbScore,
        },
      },
      support: {
        tickets_30d: (supportTickets.data ?? []).length,
        consultations_30d: (consultations.data ?? []).length,
      },
      ai_narrative: groqResult,
      hr_actions: (hrActions.data ?? []).map(a => ({
        action_type: a.action_type,
        notes: a.notes,
        created_at: a.created_at,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}