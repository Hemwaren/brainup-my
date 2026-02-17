import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashInvite, getEmailDomain, isAllowedDomain } from "@/lib/inviteHash";
import { createClient } from "@supabase/supabase-js";

type ReqBody = {
  full_name: string;
  department?: string;
  email: string;
  password: string;
  role: "EMPLOYEE" | "HR";
  inviteCode?: string;
};

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;

    const full_name = (body.full_name || "").trim();
    const department = (body.department || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const role = body.role || "EMPLOYEE";
    const inviteCode = (body.inviteCode || "").trim();

    if (!full_name || !email || !password) {
      return NextResponse.json({ ok: false, message: "Missing fields." }, { status: 400 });
    }

    const domain = getEmailDomain(email);
    if (!isAllowedDomain(domain)) {
      return NextResponse.json({ ok: false, message: "Use your company email." }, { status: 400 });
    }

    let finalRole: "EMPLOYEE" | "HR" = "EMPLOYEE";
    let inviteId: string | null = null;

    if (role === "HR") {
      if (!inviteCode) {
        return NextResponse.json({ ok: false, message: "HR invite code required." }, { status: 400 });
      }

      const code_hash = hashInvite(inviteCode);

      const { data: invite, error: invErr } = await supabaseAdmin
        .from("invite_codes")
        .select("id, active, allowed_domain, max_uses, used_count, expires_at")
        .eq("code_hash", code_hash)
        .maybeSingle();

      if (invErr || !invite) {
        return NextResponse.json({ ok: false, message: "Invalid invite code." }, { status: 400 });
      }

      if (!invite.active) {
        return NextResponse.json({ ok: false, message: "Invite code inactive." }, { status: 400 });
      }

      if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ ok: false, message: "Invite code expired." }, { status: 400 });
      }

      if (invite.allowed_domain && invite.allowed_domain.toLowerCase() !== domain) {
        return NextResponse.json({ ok: false, message: "Invite not valid for this company." }, { status: 400 });
      }

      if (invite.used_count >= invite.max_uses) {
        return NextResponse.json({ ok: false, message: "Invite code already used." }, { status: 400 });
      }

      await supabaseAdmin
        .from("invite_codes")
        .update({ used_count: invite.used_count + 1 })
        .eq("id", invite.id);

      finalRole = "HR";
      inviteId = invite.id;
    }

    const origin = new URL(req.url).origin;

    const { data: signUpData, error: signUpErr } =
      await supabaseAnon.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

    if (signUpErr || !signUpData.user) {
      return NextResponse.json({ ok: false, message: signUpErr?.message || "Signup failed." }, { status: 400 });
    }

    const userId = signUpData.user.id;

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        full_name,
        work_email: email,
        department,
        role: finalRole,
      });

    if (profErr) {
      return NextResponse.json({ ok: false, message: "Profile creation failed." }, { status: 500 });
    }

    if (inviteId) {
      await supabaseAdmin.from("invite_redemptions").insert({
        invite_id: inviteId,
        user_id: userId,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Account created. Please verify your email to continue.",
    });

  } catch (error) {
    return NextResponse.json({ ok: false, message: "Server error." }, { status: 500 });
  }
}
