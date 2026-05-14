import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { mission_id, reflection_text, proof_url } = body;
    if (!mission_id) return NextResponse.json({ error: "mission_id required" }, { status: 400 });
    if (!reflection_text?.trim() || reflection_text.length < 20) {
      return NextResponse.json({ error: "Reflection must be at least 20 characters" }, { status: 400 });
    }

    // Get mission details
    const { data: mission } = await supabaseAdmin
      .from("daily_missions")
      .select("xp_reward, verification_type")
      .eq("id", mission_id)
      .single();

    if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

    // Insert as pending — admin will approve
    const { error } = await supabaseAdmin
      .from("user_mission_completions")
      .insert({
        user_id: user.id,
        mission_id,
        reflection_text: reflection_text.trim(),
        proof_url: proof_url || null,
        status: "pending",
        xp_awarded: 0, // XP only awarded on approval
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, message: "Submitted for admin approval" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}