import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY =
  process.env.GROQ_API_KEY ?? process.env.NEXT_PUBLIC_GROQ_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const { question, answerLabel, answerValue } = await req.json();

    if (!question || !answerLabel || !answerValue) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 90,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: `EI question: "${question}"\nAnswer: "${answerLabel}" (${answerValue}/5)\n\nWrite exactly 2 sentences: a specific workplace scenario illustrating this answer level. Start with "Eg:". Be direct and concise.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq API error:", errText);
      return NextResponse.json(
        { error: "Groq API failed", detail: errText },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ scenario: text || "No scenario generated." });
  } catch (e: any) {
    console.error("Scenario route error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}