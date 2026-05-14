import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", user.id).single();

    if (String(profile?.role || "").toUpperCase() !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    if (!GROQ_KEY) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });

    const body = await req.json();
    const { theme, mission_type } = body;
    if (!theme?.trim()) return NextResponse.json({ error: "Theme is required" }, { status: 400 });

    // RAG step: fetch existing missions to avoid duplicates
    const { data: existing } = await supabaseAdmin
      .from("daily_missions")
      .select("title, description")
      .limit(10);

    const existingContext = existing && existing.length > 0
      ? `\n\nEXISTING MISSIONS (avoid duplicating):\n${existing.map((m, i) => `${i + 1}. ${m.title}`).join("\n")}`
      : "";

    let typePrompt = "";
    if (mission_type === "platform") {
      typePrompt = `Generate a PLATFORM mission — must map to one of these actions:
- daily_emotion_checkin (logging an emotion)
- daily_journal_entry (writing a journal entry)
- read_ei_resource (reading a resource)
- breathing_exercise (doing a breathing exercise)
- reflection_worksheet (completing a worksheet)
- ei_mini_quiz (taking a quiz)

Set "activity_key" to one of the above. Set "requires_reflection" to false.`;
    } else {
      typePrompt = `Generate a REAL-WORLD mission — an activity done OUTSIDE the app at the workplace or in daily life.
Examples: "Have a 5-minute check-in conversation with a colleague", "Write 3 things you're grateful for", "Take a 10-minute walk between meetings".
Set "activity_key" to "realworld_mission". Set "requires_reflection" to true.`;
    }

    const prompt = `You are an Emotional Intelligence coach designing daily missions for Malaysian SME employees.

Theme: "${theme}"
Mission Type: ${mission_type}

${typePrompt}
${existingContext}

Generate ONE mission. Output strict JSON:
{
  "title": "Short engaging title (max 50 chars)",
  "description": "1 sentence describing the action (max 120 chars)",
  "activity_key": "appropriate key from above",
  "xp_reward": number between 3-10,
  "requires_reflection": true or false
}

Respond with ONLY the JSON object.`;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You design EI training missions. Respond only with valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return NextResponse.json({ error: `Groq failed: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const groqData = await groqRes.json();
    const raw = groqData?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch { return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 }); }

    return NextResponse.json({
      ok: true,
      generated: {
        title: parsed.title || "Untitled Mission",
        description: parsed.description || "",
        activity_key: parsed.activity_key || (mission_type === "platform" ? "daily_emotion_checkin" : "realworld_mission"),
        xp_reward: Math.max(3, Math.min(10, parsed.xp_reward || 5)),
        verification_type: mission_type,
        requires_reflection: mission_type === "realworld" ? true : (parsed.requires_reflection ?? false),
      },
      similar_count: existing?.length || 0,
      rag_used: (existing?.length ?? 0) > 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}