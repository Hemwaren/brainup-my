import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const HF_URL = "https://hemwaren-brainup-ei-predictor.hf.space";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";

// ── Rule-based BEIS scoring ───────────────────────────────────────
function calculateScores(answers: number[]) {
  const [ea1,ea2,ea3,ea4,ea5,eu1,eu2,eu3,eu4,eu5,eus1,eus2,eus3,eus4,eus5,ec1,ec2,ec3] = answers;

  const ea  = ((ea1+ea2+ea3+ea4+ea5) / 5) * 20;
  const eu  = ((eu1+eu2+eu3+eu4+eu5) / 5) * 20;
  const eus = ((eus1+eus2+eus3+eus4+eus5) / 5) * 20;
  const ec  = ((ec1+ec2+ec3) / 3) * 20;
  const overall = (ea + eu + eus + ec) / 4;

  return { ea, eu, eus, ec, overall };
}

// ── Brain Style determination ─────────────────────────────────────
function getBrainStyle(ea: number, eu: number, eus: number, ec: number) {
  const focus     = eus > 65 ? "Emotional" : "Analytical";
  const decisions = ec  > 70 ? "Innovate"  : "Protect";
  const drive     = ea  > 75 ? "Idealistic": "Practical";

  const styleMap: Record<string, string> = {
    "Emotional-Protect-Idealistic":  "Sage",
    "Emotional-Innovate-Practical":  "Energizer",
    "Emotional-Protect-Practical":   "Guardian",
    "Emotional-Innovate-Idealistic": "Visionary",
    "Analytical-Protect-Practical":  "Deliverer",
    "Analytical-Protect-Idealistic": "Strategist",
    "Analytical-Innovate-Idealistic":"Inventor",
    "Analytical-Innovate-Practical": "Scientist",
  };

  const key = `${focus}-${decisions}-${drive}`;
  return { focus, decisions, drive, style: styleMap[key] ?? "Visionary" };
}

// ── Groq feedback ─────────────────────────────────────────────────
async function getGroqFeedback(ea: number, eu: number, eus: number, ec: number, overall: number) {
  const prompt = `You are an emotional intelligence coach. A user completed an EI assessment with these scores (0-100):
- Emotional Awareness (EA): ${ea.toFixed(1)}
- Emotion Usage (EU): ${eu.toFixed(1)}  
- Emotional Understanding (EUS): ${eus.toFixed(1)}
- Emotional Controlling (EC): ${ec.toFixed(1)}
- Overall EI Score: ${overall.toFixed(1)}

Write personalised feedback for each dimension in 2 sentences each. Be empathetic and specific. Return as JSON:
{
  "ea_feedback": "...",
  "eu_feedback": "...",
  "eus_feedback": "...",
  "ec_feedback": "...",
  "overall_feedback": "..."
}
Return only the JSON, no other text.`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    }),
  });

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(text); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { answers, ml_predicted_ei } = await req.json();
    if (!answers || answers.length !== 18) {
      return NextResponse.json({ error: "Need 18 answers" }, { status: 400 });
    }

    // Calculate scores
    const { ea, eu, eus, ec, overall } = calculateScores(answers);
    const { focus, decisions, drive, style } = getBrainStyle(ea, eu, eus, ec);
    const feedback = await getGroqFeedback(ea, eu, eus, ec, overall);

    // Save to Supabase
    await supabaseAdmin.from("ei_assessment_results").insert({
      user_id: user.id,
      overall_score: overall,
      ea_score: ea,
      eu_score: eu,
      eus_score: eus,
      ec_score: ec,
      ml_predicted_ei: ml_predicted_ei ?? null,
      brain_style: style,
      brain_focus: focus,
      brain_decisions: decisions,
      brain_drive: drive,
      groq_feedback: feedback,
      answers_json: answers,
    });

    return NextResponse.json({
      overall, ea, eu, eus, ec,
      brain_style: style,
      brain_focus: focus,
      brain_decisions: decisions,
      brain_drive: drive,
      groq_feedback: feedback,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}