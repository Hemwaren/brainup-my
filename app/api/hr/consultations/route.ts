import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

async function getProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, department")
    .eq("id", userId)
    .single();
  return data;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromToken(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getProfile(user.id);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const role = String(profile.role || "").toUpperCase();
    const isHR = role === "HR" || role === "ADMIN";

    let query = supabaseAdmin
      .from("consultations")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isHR) {
      query = query.eq("employee_id", user.id);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, consultations: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromToken(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getProfile(user.id);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const body = await req.json();
    const { reason, requested_date, requested_time } = body;

    if (!reason?.trim() || !requested_date || !requested_time) {
      return NextResponse.json(
        { error: "reason, requested_date and requested_time are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("consultations")
      .insert({
        employee_id: user.id,
        employee_name: profile.full_name || "Employee",
        department: profile.department,
        requested_date,
        requested_time,
        reason: reason.trim(),
        status: "PENDING",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, consultation: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}