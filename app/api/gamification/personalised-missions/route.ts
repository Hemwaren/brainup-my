import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";

const DIM_LABELS: Record<string, string> = {
  EA: "Emotional Awareness",
  EU: "Emotion Usage",
  EUS: "Emotional Understanding",
  EC: "Emotional Controlling",
};

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ─── RAG Phase 1: Gather user context ──────────────────
    const [
      { data: assessment },
      { data: recentJournals },
      { data: recentCheckins },
      { data: activeMissions },
      { data: completedToday },
    ] = await Promise.all([
      supabaseAdmin
        .from("ei_assessment_results")
        .select("overall_score, ea_score, eu_score, eus_score, ec_score, brain_style")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("journal_entries")
        .select("ai_emotion, created_at")
        .eq("user_id", user.id)
        .not("ai_emotion", "is", null)
        .order("created_at", { ascending: false })
        .limit(7),
      supabaseAdmin
        .from("emotion_checkins")
        .select("emotion_level, emotion_tag, checked_in_at")
        .eq("user_id", user.id)
        .order("checked_in_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("daily_missions")
        .select("id, title, description, activity_key, xp_reward, verification_type, requires_reflection")
        .eq("is_active", true),
      supabaseAdmin
        .from("user_mission_completions")
        .select("mission_id")
        .eq("user_id", user.id)
        .gte("completed_at", new Date().toISOString().slice(0, 10)),
    ]);

    const completedIds = new Set((completedToday ?? []).map((c: any) => c.mission_id));
    const available = (activeMissions ?? []).filter((m: any) => !completedIds.has(m.id));

    // No missions or no assessment → return whatever's available
    if (available.length === 0) {
      return NextResponse.json({ ok: true, missions: [], reasoning: "All missions completed today!" });
    }

    if (!assessment || !GROQ_KEY) {
      return NextResponse.json({ ok: true, missions: available.slice(0, 5), reasoning: null });
    }

    // ─── Find lowest EI dimension ──────────────────────────
    const dimScores = [
      { key: "EA", score: assessment.ea_score ?? 0 },
      { key: "EU", score: assessment.eu_score ?? 0 },
      { key: "EUS", score: assessment.eus_score ?? 0 },
      { key: "EC", score: assessment.ec_score ?? 0 },
    ];
    const lowestDim = dimScores.reduce((min, d) => d.score < min.score ? d : min);

    // ─── Recent emotional patterns ─────────────────────────
    const recentEmotions = (recentJournals ?? []).map((j: any) => j.ai_emotion).filter(Boolean);
    const lowMoodCount = (recentCheckins ?? []).filter((c: any) => c.emotion_level <= 2).length;

    // ─── RAG Phase 2: Ask Groq to recommend ───────────────
    const userContext = `Employee EI Profile:
- Overall EI Score: ${assessment.overall_score?.toFixed(1) ?? "N/A"}/5
- Lowest dimension: ${DIM_LABELS[lowestDim.key]} (score: ${lowestDim.score.toFixed(1)}/5)
- Brain style: ${assessment.brain_style ?? "Unknown"}
- Recent journal emotions: ${recentEmotions.join(", ") || "no recent entries"}
- Recent check-ins below 'neutral': ${lowMoodCount} out of ${recentCheckins?.length ?? 0}

Available Missions (with IDs):
${available.map((m: any, i: number) => `${i + 1}. [${m.id}] ${m.title} — ${m.description} (${m.verification_type})`).join("\n")}`;

    const prompt = `${userContext}

Pick 5 missions most relevant for this employee based on:
1. Their lowest EI dimension (${DIM_LABELS[lowestDim.key]})
2. Recent emotional patterns (if they had low moods, prioritise grounding/calming missions)
3. Mix platform and real-world missions for balance

Output strict JSON:
{
  "mission_ids": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5"],
  "reasoning": "1-2 sentence explanation of why these missions suit this employee"
}

Pick EXACTLY 5 mission IDs from the list above. Respond with ONLY the JSON.`;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You personalise EI training missions based on user data. Respond only with valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      return NextResponse.json({ ok: true, missions: available.slice(0, 5), reasoning: null });
    }

    const groqData = await groqRes.json();
    const raw = groqData?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch {
      return NextResponse.json({ ok: true, missions: available.slice(0, 5), reasoning: null });
    }

    const selectedIds: string[] = parsed.mission_ids ?? [];
    const personalised = selectedIds
      .map(id => available.find((m: any) => m.id === id))
      .filter(Boolean)
      .slice(0, 5);

    // Fallback if Groq picked invalid IDs
    const final = personalised.length > 0 ? personalised : available.slice(0, 5);

    return NextResponse.json({
      ok: true,
      missions: final,
      reasoning: parsed.reasoning ?? null,
      lowest_dimension: DIM_LABELS[lowestDim.key],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}