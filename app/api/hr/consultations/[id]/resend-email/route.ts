import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
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

    const { data: consult } = await supabaseAdmin
      .from("consultations")
      .select("*")
      .eq("id", id)
      .single();

    if (!consult) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (consult.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Can only resend for CONFIRMED consultations" }, { status: 400 });
    }

    const { data: empUser } = await supabaseAdmin.auth.admin.getUserById(consult.employee_id);
    const employeeEmail = empUser?.user?.email;
    if (!employeeEmail) {
      return NextResponse.json({ error: "Employee email not found" }, { status: 404 });
    }

    const resend = new (await import("resend")).Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "BrainUp <noreply@brainup.my>",
      to: employeeEmail,
      subject: `Consultation confirmed — ${consult.requested_date} at ${consult.requested_time}`,
      html: `<p>Hi ${consult.employee_name}, your consultation on ${consult.requested_date} at ${consult.requested_time} has been confirmed by ${profile?.full_name || "HR Team"}.</p><p>This session is private and confidential.</p>`,
    });

    await supabaseAdmin
      .from("consultations")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}