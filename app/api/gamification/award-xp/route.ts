import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  XP_TABLE,
  DAILY_XP_CAP,
  getLevelFromXP,
  getStarsFromXP,
  type ActivityKey,
} from "@/lib/gamification";
import { checkAndAwardBadges } from "@/lib/badges";

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayUTC() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Missing auth token" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const activityKey = body?.activityKey as ActivityKey | undefined;
    const metadata = body?.metadata ?? null;

    if (!activityKey || !(activityKey in XP_TABLE)) {
      return NextResponse.json(
        { ok: false, message: "Invalid activity key" },
        { status: 400 }
      );
    }

    const xpForActivity = XP_TABLE[activityKey];

    const { data: gRow, error: gError } = await supabaseAdmin
      .from("user_gamification")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (gError) {
      return NextResponse.json(
        { ok: false, message: gError.message },
        { status: 500 }
      );
    }

    const today = getTodayUTC();
    const yesterday = getYesterdayUTC();

    const lastActiveDate = gRow?.last_active_date ?? null;
    const earnedToday =
      lastActiveDate === today ? (gRow?.xp_earned_today ?? 0) : 0;

    const canAward = Math.max(
      0,
      Math.min(xpForActivity, DAILY_XP_CAP - earnedToday)
    );

    if (canAward <= 0) {
      return NextResponse.json({
        ok: true,
        xpAwarded: 0,
        message: "Daily XP cap reached",
        totalXP: gRow?.total_xp ?? 0,
        level: gRow?.level ?? 1,
        stars: gRow?.stars ?? 0,
        currentStreak: gRow?.current_streak ?? 0,
        longestStreak: gRow?.longest_streak ?? 0,
      });
    }

    let currentStreak = 1;

    if (lastActiveDate === today) {
      currentStreak = gRow?.current_streak ?? 1;
    } else if (lastActiveDate === yesterday) {
      currentStreak = (gRow?.current_streak ?? 0) + 1;
    } else {
      currentStreak = 1;
    }

    const longestStreak = Math.max(gRow?.longest_streak ?? 0, currentStreak);

    const oldTotalXP = gRow?.total_xp ?? 0;
    const newTotalXP = oldTotalXP + canAward;
    const newLevel = getLevelFromXP(newTotalXP);
    const newStars = getStarsFromXP(newTotalXP);

    const { error: upsertError } = await supabaseAdmin
      .from("user_gamification")
      .upsert(
        {
          user_id: user.id,
          total_xp: newTotalXP,
          level: newLevel.level,
          stars: newStars,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          last_active_date: today,
          xp_earned_today: earnedToday + canAward,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return NextResponse.json(
        { ok: false, message: upsertError.message },
        { status: 500 }
      );
    }

    const { error: txError } = await supabaseAdmin
      .from("xp_transactions")
      .insert({
        user_id: user.id,
        activity_key: activityKey,
        xp_awarded: canAward,
        metadata,
      });

    if (txError) {
      return NextResponse.json(
        { ok: false, message: txError.message },
        { status: 500 }
      );
    }

    // Check and award badges (fire and forget)
    checkAndAwardBadges({
      userId: user.id,
      currentStreak,
      totalXP: newTotalXP,
      level: newLevel.level,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      xpAwarded: canAward,
      totalXP: newTotalXP,
      level: newLevel.level,
      levelTitle: newLevel.title,
      progressPct: newLevel.progressPct,
      stars: newStars,
      currentStreak,
      longestStreak,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}