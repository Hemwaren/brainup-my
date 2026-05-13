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
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (String(profile?.role || "").toUpperCase() !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    if (!GROQ_KEY) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });

    const body = await req.json();
    const { topic, content_type, category } = body;

    if (!topic?.trim()) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

    // ─── RAG: fetch existing resources for duplicate avoidance ───
    const firstWord = topic.split(" ")[0];
    const { data: existing } = await supabaseAdmin
      .from("ei_resources")
      .select("title, description, category, type")
      .or(`title.ilike.%${firstWord}%,category.eq.${category || "productivity"}`)
      .limit(5);

    const existingContext = existing && existing.length > 0
      ? `\n\n--- EXISTING RESOURCES (avoid duplicating these angles) ---\n${existing.map((r, i) => `${i + 1}. "${r.title}" (${r.type}) — ${r.description?.slice(0, 100) || ""}`).join("\n")}\n--- END EXISTING ---`
      : "";

    // ─── Type-specific prompts matching BrainUp content format ───
    let typeSpecificPrompt = "";
    let resourceType = "ARTICLE";
    let needsUrl = false;

    if (content_type === "article") {
      resourceType = "ARTICLE";
      needsUrl = true;
      typeSpecificPrompt = `Generate an EI article in BrainUp's exact format. Structure:
- Open with 1-2 sentences naming the problem (workplace anxiety, stress, conflict, etc.) — make it relatable, mention it shows up as specific behaviours.
- Explain the underlying mechanism in 2-3 sentences (e.g., uncertainty triggers fight-or-flight).
- Provide exactly 3 numbered, actionable tips with this structure:
  "1. [Short action verb headline]. [2-3 sentence explanation with concrete workplace example]"
- Keep total length ~250-350 words.
- Use second person ("you")
- Conversational, warm tone — NOT academic.
- For the resource_url field, suggest a credible reference URL (helpguide.org, mindful.org, hbr.org, psychologytoday.com).`;
    } else if (content_type === "video") {
      resourceType = "VIDEO";
      needsUrl = true;
      typeSpecificPrompt = `Generate a VIDEO resource description in BrainUp's exact format. Structure:
- 1 sentence: "This video walks you through [what it teaches]..."
- "You'll learn:" header followed by exactly 3 bullet points (use "- " prefix), each 1 sentence.
- End with: "Watch time: [X] minutes. No equipment needed." or similar practical note.
- Keep total ~80-120 words.
- For resource_url, suggest a relevant YouTube search URL based on topic (format: https://www.youtube.com/results?search_query=...).`;
    } else if (content_type === "guide" || content_type === "exercise") {
      resourceType = "GUIDED_EXERCISE";
      needsUrl = false;
      typeSpecificPrompt = `Generate a GUIDED EXERCISE in BrainUp's exact format. Structure:
- 1 opening sentence: "Use this exercise the moment you [trigger situation]..."
- Then exactly 5 steps with this exact format:
  "STEP 1 — [VERB] ([duration like "30 seconds" or "1 minute"])
  [1-2 sentence instruction]"
  "STEP 2 — [VERB] ([duration])
  [1-2 sentence instruction]"
  ...continue to STEP 5
- Final STEP should be "ACT" or similar action step without time.
- Keep practical, actionable, workplace-safe (no closed eyes for too long, etc.)
- ~180-250 words total.
- No URL needed.`;
    } else if (content_type === "worksheet") {
      resourceType = "WORKSHEET";
      needsUrl = false;
      typeSpecificPrompt = `Generate a WORKSHEET PROMPT in BrainUp's exact format. 

CRITICAL: For worksheets, the "content" field is NOT the worksheet itself — it's a PROMPT that will later be fed to Groq to generate a branching scenario game for employees.

Structure the content as a single paragraph prompt that:
- Starts with "Generate a realistic workplace [situation type] scenario involving..."
- Describes the scenario setup (who, what, where)
- Asks for the reader to make 3 emotional intelligence choices
- Specifies each choice should have 3-4 options ranging from low EI to high EI
- Ends with "End with a brief reflection on what high EI looks like in this situation."
- Keep it 80-120 words — it's a generator prompt, not a finished worksheet.
- No URL needed.

Example format:
"Generate a realistic workplace conflict scenario involving two colleagues who disagree over a project deadline. The scenario should put the reader in the middle of the conflict and ask them to make 3 emotional intelligence choices — how to respond, how to manage their own emotions, and how to repair the relationship afterwards. Each choice should have 3 options ranging from low EI to high EI response. End with a brief reflection on what high EI looks like in this situation."`;
    }

    const prompt = `You are an Emotional Intelligence content specialist creating material for Malaysian SME workplaces (platform: BrainUp).

Topic: "${topic}"
Category: ${category || "general EI"}
Content Type: ${content_type}

${typeSpecificPrompt}
${existingContext}

Requirements:
- Use second person ("you") for direct engagement
- Warm, practical, NOT academic
- Culturally aware for Malaysian SME audiences
- Avoid duplicating existing resources listed above

Output STRICT JSON with these exact fields:
{
  "title": "string - engaging specific title, max 80 chars",
  "description": "string - 1 sentence summary, max 150 chars",
  "content": "string - the full content matching the format described above",
  "resource_url": ${needsUrl ? '"string - credible reference URL"' : '""'},
  "read_time_minutes": number,
  "tags": ["array", "of", "3-5", "tags"]
}

Respond with ONLY the JSON object, no markdown fences, no commentary.`;

    // ─── Groq generation ───
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You produce high-quality EI training content for the BrainUp platform. Follow the exact format requested. Respond only with valid JSON, no markdown fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2500,
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
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      generated: {
        title: parsed.title || `Untitled — ${topic}`,
        description: parsed.description || "",
        content: parsed.content || "",
        resource_url: needsUrl ? (parsed.resource_url || "") : "",
        read_time_minutes: parsed.read_time_minutes || 5,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        category: category || "productivity",
        type: resourceType,
        needs_url: needsUrl,
      },
      similar_count: existing?.length || 0,
      rag_used: (existing?.length ?? 0) > 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}