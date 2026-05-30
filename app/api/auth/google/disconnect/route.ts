import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function authoriseUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user ?? null;
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await authoriseUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await supabaseAdmin
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "google");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}