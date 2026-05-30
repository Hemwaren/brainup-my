import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect(`${APP_URL}/settings?google=error`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error);

    const expiry = new Date(Date.now() + tokens.expires_in * 1000);

    await supabaseAdmin
      .from("user_integrations")
      .upsert({
        user_id: userId,
        provider: "google",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expiry: expiry.toISOString(),
        connected_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });

    return NextResponse.redirect(`${APP_URL}/settings?google=success`);

  } catch (e: any) {
    console.error("Google OAuth callback error:", e);
    return NextResponse.redirect(`${APP_URL}/settings?google=error`);
  }
}