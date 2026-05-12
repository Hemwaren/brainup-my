import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET ?? "";

function dateNDaysAgoIso(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

async function generateReport() {
  const now = new Date();
  const sevenAgo = dateNDaysAgoIso(7);
  const fourteenAgo = dateNDaysAgoIso(14);

  const { data: currentWeek } = await supabaseAdmin
    .from("emotion_checkins")
    .select("user_id, emotion_level, emotion_tag, department, checked_in_at")
    .gte("checked_in_at", sevenAgo);

  const { data: prevWeek } = await supabaseAdmin
    .from("emotion_checkins")
    .select("emotion_level, department, checked_in_at")
    .gte("checked_in_at", fourteenAgo)
    .lt("checked_in_at", sevenAgo);

  const current = currentWeek ?? [];
  const prev = prevWeek ?? [];

  const orgAvg = current.length > 0
    ? Math.round((current.reduce((a, c) => a + c.emotion_level, 0) / current.length) * 10) / 10
    : 0;

  const orgPrevAvg = prev.length > 0
    ? Math.round((prev.reduce((a, c) => a + c.emotion_level, 0) / prev.length) * 10) / 10
    : 0;

  const lowCountByUser = new Map<string, number>();
  for (const c of current) {
    if (c.emotion_level === 1) {
      lowCountByUser.set(c.user_id, (lowCountByUser.get(c.user_id) ?? 0) + 1);
    }
  }
  const flaggedUsers = Array.from(lowCountByUser.values()).filter((n) => n >= 3).length;

  const deptCurrent = new Map<string, { sum: number; n: number; low: number }>();
  for (const c of current) {
    const d = c.department || "Unknown";
    const e = deptCurrent.get(d) ?? { sum: 0, n: 0, low: 0 };
    e.sum += c.emotion_level;
    e.n += 1;
    if (c.emotion_level <= 2) e.low += 1;
    deptCurrent.set(d, e);
  }

  const deptPrev = new Map<string, { sum: number; n: number }>();
  for (const c of prev) {
    const d = c.department || "Unknown";
    const e = deptPrev.get(d) ?? { sum: 0, n: 0 };
    e.sum += c.emotion_level;
    e.n += 1;
    deptPrev.set(d, e);
  }

  const deptStats = Array.from(deptCurrent.entries()).map(([dept, v]) => {
    const cAvg = Math.round((v.sum / v.n) * 10) / 10;
    const pVal = deptPrev.get(dept);
    const pAvg = pVal && pVal.n > 0 ? Math.round((pVal.sum / pVal.n) * 10) / 10 : cAvg;
    return {
      department: dept,
      current_avg: cAvg,
      prev_avg: pAvg,
      delta: Math.round((cAvg - pAvg) * 10) / 10,
      checkins: v.n,
      low_mood_count: v.low,
    };
  });
  deptStats.sort((a, b) => a.delta - b.delta);

  let narrative = "Weekly team health overview generated.";
  let recommendations: string[] = [];

  if (GROQ_KEY) {
    try {
      const prompt = `Generate a brief executive HR report from these stats.
Org avg mood: ${orgAvg}/5 (prev: ${orgPrevAvg}/5)
Total check-ins: ${current.length}
Flagged employees: ${flaggedUsers}
Departments: ${deptStats.map((d) => `${d.department}: ${d.current_avg} (Δ${d.delta})`).join(", ")}

Return JSON: { "narrative": "3-4 sentence summary", "recommendations": ["3-5 action items"] }`;

      const groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You produce concise HR briefings. Respond only with valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 500,
          response_format: { type: "json_object" },
        }),
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const obj = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
        narrative = String(obj.narrative || narrative);
        recommendations = Array.isArray(obj.recommendations) ? obj.recommendations : [];
      }
    } catch (e) {
      console.error("Groq narrative failed:", e);
    }
  }

  return {
    week_of: now.toISOString().slice(0, 10),
    org_avg: orgAvg,
    org_prev_avg: orgPrevAvg,
    total_checkins: current.length,
    flagged_users: flaggedUsers,
    dept_stats: deptStats,
    narrative,
    recommendations,
    generated_at: now.toISOString(),
  };
}

async function getHrEmails() {
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["HR", "ADMIN"]);

  const emails: string[] = [];
  for (const p of profiles ?? []) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(p.id);
    const email = data?.user?.email;
    if (email) emails.push(email);
  }
  return emails;
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-n8n-secret");
    if (!N8N_SECRET || secret !== N8N_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const report = await generateReport();
    const recipients = await getHrEmails();

    if (recipients.length > 0) {
      try {
        const resend = new (await import("resend")).Resend(process.env.RESEND_API_KEY);
        const orgDelta = Math.round((report.org_avg - report.org_prev_avg) * 10) / 10;
        const orgArrow = orgDelta > 0 ? "▲" : orgDelta < 0 ? "▼" : "→";

        const deptRows = report.dept_stats.map((d) => {
          const arrow = d.delta > 0 ? "▲" : d.delta < 0 ? "▼" : "→";
          const color = d.delta > 0 ? "#10b981" : d.delta < 0 ? "#ef4444" : "#64748b";
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${d.department}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${d.current_avg}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:${color};">${arrow} ${Math.abs(d.delta)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${d.checkins}</td>
          </tr>`;
        }).join("");

        const recoItems = report.recommendations.map((r) => `<li style="margin-bottom:6px;">${r}</li>`).join("");

        const html = `
          <body style="font-family:sans-serif;background:#f0fdfa;margin:0;padding:0;">
            <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);">
              <div style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:32px 40px;text-align:center;">
                <span style="color:#fff;font-size:22px;font-weight:900;">🧠 BrainUp</span>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Weekly Team Health Report · ${report.week_of}</p>
              </div>
              <div style="padding:32px 40px;">
                <h1 style="font-size:20px;font-weight:900;color:#0f172a;margin:0 0 8px;">This week at a glance</h1>
                <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px;">${report.narrative}</p>
                <div style="display:flex;gap:12px;margin:0 0 24px;flex-wrap:wrap;">
                  <div style="flex:1;min-width:130px;background:#f0fdfa;border-radius:14px;padding:16px;border-left:4px solid #14b8a6;">
                    <div style="font-size:11px;color:#0f766e;font-weight:800;text-transform:uppercase;">Org Avg Mood</div>
                    <div style="font-size:24px;font-weight:900;color:#0f172a;">${report.org_avg} / 5</div>
                    <div style="font-size:12px;color:#64748b;">${orgArrow} ${Math.abs(orgDelta)} vs prev week</div>
                  </div>
                  <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:14px;padding:16px;border-left:4px solid #0891b2;">
                    <div style="font-size:11px;color:#0e7490;font-weight:800;text-transform:uppercase;">Total Check-ins</div>
                    <div style="font-size:24px;font-weight:900;color:#0f172a;">${report.total_checkins}</div>
                  </div>
                  <div style="flex:1;min-width:130px;background:${report.flagged_users > 0 ? "#fff1f2" : "#f8fafc"};border-radius:14px;padding:16px;border-left:4px solid ${report.flagged_users > 0 ? "#ef4444" : "#94a3b8"};">
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:${report.flagged_users > 0 ? "#be123c" : "#475569"};">Flagged Users</div>
                    <div style="font-size:24px;font-weight:900;color:#0f172a;">${report.flagged_users}</div>
                  </div>
                </div>
                <h2 style="font-size:15px;font-weight:900;color:#0f172a;margin:0 0 12px;">By department</h2>
                <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                  <thead><tr style="background:#f8fafc;">
                    <th style="text-align:left;padding:8px 12px;font-size:11px;color:#64748b;">Dept</th>
                    <th style="text-align:right;padding:8px 12px;font-size:11px;color:#64748b;">Avg</th>
                    <th style="text-align:right;padding:8px 12px;font-size:11px;color:#64748b;">Δ</th>
                    <th style="text-align:right;padding:8px 12px;font-size:11px;color:#64748b;">Check-ins</th>
                  </tr></thead>
                  <tbody>${deptRows || `<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;">No check-in data this week.</td></tr>`}</tbody>
                </table>
                ${recoItems ? `<h2 style="font-size:15px;font-weight:900;color:#0f172a;margin:24px 0 12px;">Recommended next steps</h2><ul style="margin:0;padding-left:18px;">${recoItems}</ul>` : ""}
                <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">Auto-generated by BrainUp · AI powered by Groq · Triggered by n8n</p>
              </div>
            </div>
          </body>`;

        await resend.emails.send({
          from: "BrainUp <noreply@brainup.my>",
          to: recipients,
          subject: `BrainUp Weekly Report — ${report.week_of}`,
          html,
        });
      } catch (e) {
        console.error("Weekly report email failed:", e);
      }
    }

    return NextResponse.json({ ok: true, report, recipients_count: recipients.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = String(profile?.role || "").toUpperCase();
    if (role !== "HR" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const report = await generateReport();
    return NextResponse.json({ ok: true, report });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}