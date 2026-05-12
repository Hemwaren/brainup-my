import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";

function dateNDaysAgoIso(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";

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
      return NextResponse.json({ error: "Forbidden — HR only" }, { status: 403 });
    }

    const { data: consult, error: cErr } = await supabaseAdmin
      .from("consultations")
      .select("*")
      .eq("id", id)
      .single();

    if (cErr || !consult) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }
    if (consult.status === "CANCELLED") {
      return NextResponse.json({ error: "Cannot prepare a brief for a cancelled consultation" }, { status: 400 });
    }

    if (!forceRefresh && consult.ai_brief_cache && consult.ai_brief_at) {
      const ageMs = Date.now() - new Date(consult.ai_brief_at).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        return NextResponse.json({ ok: true, brief: consult.ai_brief_cache, cached: true });
      }
    }

    const since = dateNDaysAgoIso(14);
    const employeeId = consult.employee_id;

    const [journalsRes, checkinsRes, eiRes] = await Promise.all([
      supabaseAdmin
        .from("journal_entries")
        .select("title, description, emotion, key_points, created_at")
        .eq("user_id", employeeId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("emotion_checkins")
        .select("emotion_level, emotion_tag, checked_in_at")
        .eq("user_id", employeeId)
        .gte("checked_in_at", since)
        .order("checked_in_at", { ascending: false }),
      supabaseAdmin
        .from("ei_assessment_results")
        .select("*")
        .eq("user_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const journals = journalsRes.data ?? [];
    const checkins = checkinsRes.data ?? [];
    const ei = eiRes.data?.[0] ?? null;

    const avgEmotion = checkins.length > 0
      ? Math.round((checkins.reduce((a, c) => a + (c.emotion_level || 0), 0) / checkins.length) * 10) / 10
      : null;

    const lowEmotionCount = checkins.filter((c) => c.emotion_level <= 2).length;

    const journalSummary = journals.slice(0, 8).map((j, i) => ({
      idx: i + 1,
      emotion: j.emotion,
      title: j.title?.slice(0, 80),
      keyPoints: Array.isArray(j.key_points) ? j.key_points.slice(0, 3) : [],
    }));

    const eiBlock = ei ? {
      overall: Math.round(ei.overall_score),
      ea: Math.round(ei.ea_score),
      eu: Math.round(ei.eu_score),
      eus: Math.round(ei.eus_score),
      ec: Math.round(ei.ec_score),
      brain_style: ei.brain_style,
    } : null;

    const systemPrompt = `You are an HR consultation prep assistant for BrainUp, an emotional intelligence platform.
You produce ONE-PAGE briefs that help HR enter consultations prepared and empathetic.
You write in professional, balanced, non-judgmental language.
You NEVER diagnose mental health conditions or recommend medications.
You respond ONLY with valid JSON in the exact schema requested. No markdown, no preamble.`;

    const userPrompt = `Generate a consultation prep brief for HR.

Consultation reason: "${consult.reason}"

Employee data (last 14 days):
- Total check-ins: ${checkins.length}
- Average emotion level (1-5): ${avgEmotion ?? "no data"}
- Low-mood check-ins (level 1-2): ${lowEmotionCount}
- Recent tags: ${checkins.slice(0, 10).map((c) => c.emotion_tag).filter(Boolean).join(", ") || "none"}

Journal entries (most recent ${journalSummary.length}):
${journalSummary.map((j) => `${j.idx}. [${j.emotion ?? "?"}] "${j.title ?? ""}" — key points: ${j.keyPoints.join(" | ") || "—"}`).join("\n") || "No recent journal entries."}

Latest EI assessment:
${eiBlock ? `- Overall: ${eiBlock.overall}/100
- EA: ${eiBlock.ea}/100, EU: ${eiBlock.eu}/100, EUS: ${eiBlock.eus}/100, EC: ${eiBlock.ec}/100
- Brain style: ${eiBlock.brain_style ?? "—"}` : "No EI assessment on record."}

Return this exact JSON:
{
  "summary": "2-3 sentence balanced overview",
  "emotional_themes": ["3-5 recurring themes"],
  "ei_gaps": [{ "dimension": "EA|EU|EUS|EC", "score": 0, "note": "one sentence" }],
  "risk_flags": ["0-3 sensitivity flags or empty array"],
  "talking_points": ["4-6 open-ended questions for HR"]
}

Only include EI dimensions below 60 in ei_gaps. If none below 60, return empty array.`;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return NextResponse.json({ error: "AI generation failed", detail: errText.slice(0, 200) }, { status: 502 });
    }

    const groqData = await groqRes.json();
    const raw = groqData?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      const obj = JSON.parse(raw);
      parsed = {
        summary: String(obj.summary || "No summary generated."),
        emotional_themes: Array.isArray(obj.emotional_themes) ? obj.emotional_themes : [],
        ei_gaps: Array.isArray(obj.ei_gaps) ? obj.ei_gaps : [],
        risk_flags: Array.isArray(obj.risk_flags) ? obj.risk_flags : [],
        talking_points: Array.isArray(obj.talking_points) ? obj.talking_points : [],
        generated_at: new Date().toISOString(),
      };
    } catch {
      return NextResponse.json({ error: "AI response was not valid JSON" }, { status: 502 });
    }

    await supabaseAdmin
      .from("consultations")
      .update({ ai_brief_cache: parsed, ai_brief_at: parsed.generated_at })
      .eq("id", id);

    return NextResponse.json({
      ok: true,
      brief: parsed,
      cached: false,
      meta: {
        journals_count: journals.length,
        checkins_count: checkins.length,
        has_ei: !!ei,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}