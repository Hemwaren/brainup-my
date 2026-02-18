import { NextResponse } from "next/server";
import { hashInvite } from "@/lib/inviteHash";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inviteCode = String(body?.inviteCode || "").trim();

    if (!inviteCode) {
      return NextResponse.json(
        { ok: false, message: "Please enter HR Invite Code." },
        { status: 400 }
      );
    }

    const expected = (process.env.HR_INVITE_HASH || "").trim();
    if (!expected) {
      return NextResponse.json(
        { ok: false, message: "HR_INVITE_HASH is missing in env." },
        { status: 500 }
      );
    }

    const computed = hashInvite(inviteCode);

    if (computed !== expected) {
      return NextResponse.json(
        { ok: false, message: "Wrong HR Invite Code, Retry" },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not validate invite. Try again." },
      { status: 500 }
    );
  }
}
