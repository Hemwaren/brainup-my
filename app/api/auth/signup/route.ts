// app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashInvite, isAllowedDomain } from "@/lib/inviteHash";

type ReqBody = {
  full_name: string;
  department?: string;
  email: string;
  password: string;
  role: "EMPLOYEE" | "HR";
  inviteCode?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;

    const full_name = (body.full_name || "").trim();
    const department = (body.department || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const role = body.role;
    const inviteCode = (body.inviteCode || "").trim();

    // basic validation
    if (!full_name || !email || !password || !role) {
      return NextResponse.json(
        { ok: false, message: "Kindly complete all fields before continuing." },
        { status: 400 }
      );
    }

    // domain check (for BOTH employee and HR)
    if (!isAllowedDomain(email)) {
      return NextResponse.json(
        { ok: false, message: "Please use an allowed email domain." },
        { status: 400 }
      );
    }

    // HR invite code check
    if (role === "HR") {
      if (!inviteCode) {
        return NextResponse.json(
          { ok: false, message: "HR Invite Code is required." },
          { status: 400 }
        );
      }

      const expected = (process.env.HR_INVITE_HASH || "").trim();
      if (!expected) {
        return NextResponse.json(
          { ok: false, message: "HR invite configuration missing on server." },
          { status: 500 }
        );
      }

      const hashed = hashInvite(inviteCode);
      if (hashed !== expected) {
        return NextResponse.json(
          { ok: false, message: "Wrong HR Invite Code" },
          { status: 400 }
        );
      }
    }

    // Employee must have department, HR should not require it
    if (role === "EMPLOYEE" && !department) {
      return NextResponse.json(
        { ok: false, message: "Department is required for Employee." },
        { status: 400 }
      );
    }

    // ✅ Use ANON signUp so Supabase sends verification email automatically
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, anon);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // store extra fields inside auth.user_metadata
        data: {
          full_name,
          role,
          department: role === "EMPLOYEE" ? department : null,
        },
      },
    });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    // If email confirmations are ON, user must verify via email before login works fully.
    return NextResponse.json(
      {
        ok: true,
        message: "Account created! Please check your email to verify your account.",
        userId: data.user?.id ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

