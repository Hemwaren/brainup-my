import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getUserAndProfile(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return { user, profile };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getUserAndProfile(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(ctx.profile.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";

    let query = supabaseAdmin
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("submitter_id", ctx.user.id);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, tickets: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUserAndProfile(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(ctx.profile.role || "").toUpperCase();
    if (role !== "HR" && role !== "EMPLOYEE" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { category, priority, subject, description } = body;

    if (!category || !subject?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: "category, subject and description are required" },
        { status: 400 }
      );
    }

    const validCategories = ["BUG", "ACCESS", "FEATURE", "DATA", "OTHER"];
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        submitter_id: ctx.user.id,
        submitter_name: ctx.profile.full_name || "User",
        submitter_role: role,
        category,
        priority: priority || "MEDIUM",
        subject: subject.trim(),
        description: description.trim(),
        status: "OPEN",
        attachment_url: body.attachment_url ?? null,
        attachment_name: body.attachment_name ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, ticket: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}