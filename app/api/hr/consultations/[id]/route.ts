import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromToken(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    const role = String(profile?.role || "").toUpperCase();
    if (role !== "HR" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden — HR only" }, { status: 403 });
    }

    const { data: existing, error: loadErr } = await supabaseAdmin
      .from("consultations")
      .select("*")
      .eq("id", id)
      .single();

    if (loadErr || !existing) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status, hr_note, requested_date, requested_time } = body;

    const update: Record<string, any> = { hr_id: user.id };
    if (status !== undefined) update.status = status;
    if (hr_note !== undefined) update.hr_note = hr_note;
    if (requested_date !== undefined) update.requested_date = requested_date;
    if (requested_time !== undefined) update.requested_time = requested_time;

    const newlyConfirmed =
      status === "CONFIRMED" &&
      existing.status !== "CONFIRMED" &&
      !existing.email_sent_at;

    if (newlyConfirmed) {
      update.email_sent_at = new Date().toISOString();
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("consultations")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    if (newlyConfirmed) {
      const { data: empUser } = await supabaseAdmin.auth.admin.getUserById(
        existing.employee_id
      );
      const employeeEmail = empUser?.user?.email;
      if (employeeEmail) {
  try {
    const resend = new (await import("resend")).Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "BrainUp <noreply@brainup.my>",
      to: employeeEmail,
      subject: `Consultation confirmed — ${updated.requested_date} at ${updated.requested_time}`,
      html: `<p>Hi ${existing.employee_name}, your consultation on ${updated.requested_date} at ${updated.requested_time} has been confirmed by ${profile?.full_name || "HR Team"}.</p>`,
    });
  } catch (mailErr) {
    console.error("Confirmation email failed:", mailErr);
  }
}
    }

    return NextResponse.json({ ok: true, consultation: updated, emailed: newlyConfirmed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromToken(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabaseAdmin
      .from("consultations")
      .update({ status: "CANCELLED" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}