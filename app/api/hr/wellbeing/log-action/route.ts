import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

const VALID_ACTIONS = [
  "consultation_opened",
  "resource_sent",
  "noted",
  "nudge_sent",
];

export async function POST(req: NextRequest) {
  try {
    const hrUser = await authoriseHR(req);
    if (!hrUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { employee_id, action_type, notes } = body;

    if (!employee_id) {
      return NextResponse.json(
        { error: "employee_id required" },
        { status: 400 }
      );
    }

    if (!action_type || !VALID_ACTIONS.includes(action_type)) {
      return NextResponse.json(
        { error: `action_type must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("wellbeing_actions")
      .insert({
        employee_id,
        hr_id: hrUser.id,
        action_type,
        notes: notes?.trim() ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}