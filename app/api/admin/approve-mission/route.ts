import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { XP_TABLE, getLevelFromXP, getStarsFromXP } from "@/lib/gamification";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", user.id).single();
    if (String(profile?.role || "").toUpperCase() !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { completion_id, action } = body;
    if (!completion_id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Get the pending completion + mission title
    const { data: completion } = await supabaseAdmin
      .from("user_mission_completions")
      .select("id, user_id, mission_id, status, daily_missions(xp_reward, title)")
      .eq("id", completion_id)
      .single();

    if (!completion) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (completion.status !== "pending") {
      return NextResponse.json({ error: "Already processed" }, { status: 400 });
    }

    const missionTitle = (completion as any).daily_missions?.title ?? "Mission";
    const xpReward = (completion as any).daily_missions?.xp_reward ?? 5;
    const employeeId = completion.user_id;

    if (action === "reject") {
      // Update completion
      await supabaseAdmin
        .from("user_mission_completions")
        .update({ status: "rejected", approved_by: user.id, approved_at: new Date().toISOString() })
        .eq("id", completion_id);

      // Send notification to employee
      await supabaseAdmin.from("user_notifications").insert({
        user_id: employeeId,
        type: "mission_rejected",
        title: "Mission Not Approved",
        message: `Your submission for "${missionTitle}" was not approved. Try submitting a more detailed reflection next time.`,
        metadata: { mission_id: completion.mission_id, completion_id },
      });

      return NextResponse.json({ ok: true, action: "rejected" });
    }

    // ─── APPROVE ─────────────────────────────────────────────────────
    const { data: gRow } = await supabaseAdmin
      .from("user_gamification")
      .select("*")
      .eq("user_id", employeeId)
      .maybeSingle();

    const today = new Date().toISOString().slice(0, 10);
    const newTotalXP = (gRow?.total_xp ?? 0) + xpReward;
    const newLevel = getLevelFromXP(newTotalXP);
    const newStars = getStarsFromXP(newTotalXP);

    // Update gamification row
    await supabaseAdmin.from("user_gamification").upsert({
      user_id: employeeId,
      total_xp: newTotalXP,
      level: newLevel.level,
      stars: newStars,
      current_streak: gRow?.current_streak ?? 1,
      longest_streak: gRow?.longest_streak ?? 1,
      last_active_date: today,
      xp_earned_today: (gRow?.xp_earned_today ?? 0) + xpReward,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // Log XP transaction
    await supabaseAdmin.from("xp_transactions").insert({
      user_id: employeeId,
      activity_key: "complete_daily_mission",
      xp_awarded: xpReward,
      metadata: { mission_id: completion.mission_id, approved_by: user.id },
    });

    // Update completion status
    await supabaseAdmin
      .from("user_mission_completions")
      .update({
        status: "approved",
        xp_awarded: xpReward,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", completion_id);

    // Send notification to employee
    await supabaseAdmin.from("user_notifications").insert({
      user_id: employeeId,
      type: "mission_approved",
      title: "Mission Approved! 🎉",
      message: `Your submission for "${missionTitle}" was approved. You earned +${xpReward} XP!`,
      metadata: { mission_id: completion.mission_id, completion_id, xp_awarded: xpReward },
    });

    return NextResponse.json({ ok: true, action: "approved", xp_awarded: xpReward });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}