import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ─── Must match the secret in setup-admin-page.tsx ─── */
const SETUP_SECRET = "brainup-admin-2026";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, setup_secret } = body;

    /* 1. Verify secret */
    if (!setup_secret || setup_secret !== SETUP_SECRET) {
      return NextResponse.json(
        { ok: false, message: "Unauthorised. Wrong setup secret." },
        { status: 401 }
      );
    }

    /* 2. Validate inputs */
    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { ok: false, message: "All fields are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    /* 3. Use service role key to bypass email confirmation */
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    /* 4. Create the user in Supabase Auth with ADMIN role */
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "Admin",
        role: "ADMIN",
      },
    });

    if (authError) {
      return NextResponse.json(
        { ok: false, message: authError.message },
        { status: 400 }
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "User created but no ID returned." },
        { status: 500 }
      );
    }

    /* 5. Insert into profiles table */
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: "Admin",
        role: "ADMIN",
        department: null,
        joined_at: new Date().toISOString(),
      });

    if (profileError) {
      // Auth user was created — just warn but don't fail
      console.warn("Profile insert warning:", profileError.message);
    }

    return NextResponse.json({
      ok: true,
      message: "Admin account created successfully.",
      userId,
    });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}