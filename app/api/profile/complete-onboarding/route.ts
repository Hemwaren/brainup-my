// app/api/profile/complete-onboarding/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      console.log("=== ONBOARDING DEBUG === NO TOKEN");
      return NextResponse.json({ ok: false, message: "Missing auth token" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.log("=== ONBOARDING DEBUG === AUTH FAILED:", authError?.message);
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { nickname, age, gender, ei_identify_level, one_word_self } = body;

    console.log("=== ONBOARDING DEBUG ===");
    console.log("User ID:", user.id);
    console.log("Body received:", { nickname, age, gender, ei_identify_level, one_word_self });

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        nickname: nickname?.trim() ?? null,
        age: Number(age),
        gender,
        ei_identify_level,
        one_word_self: one_word_self?.trim() ?? null,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    console.log("Update error:", error);
    console.log("========================");

    if (error) {
      console.error("Onboarding update error:", error.message);
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.log("=== ONBOARDING DEBUG === CATCH ERROR:", err?.message);
    return NextResponse.json({ ok: false, message: err?.message ?? "Server error" }, { status: 500 });
  }
}