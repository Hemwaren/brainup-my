import { NextRequest, NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: NextRequest) {
  // Try all possible env var names
  const GROQ_KEY = 
    process.env.GROQ_API_KEY ?? 
    process.env.NEXT_PUBLIC_GROQ_API_KEY ?? 
    "";

  // Debug log to see what key is being read
  console.log("GROQ_KEY present:", !!GROQ_KEY);
  console.log("GROQ_KEY prefix:", GROQ_KEY?.substring(0, 7));
  console.log("All env keys with GROQ:", Object.keys(process.env).filter(k => k.includes("GROQ")));

  if (!GROQ_KEY) {
    return NextResponse.json({ error: "Groq API key not found in environment." }, { status: 500 });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY.trim()}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Groq error:", err);
      return NextResponse.json(
        { error: err?.error?.message ?? "Groq API error." },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ text });

  } catch (err: any) {
    console.error("AI route error:", err);
    return NextResponse.json({ error: err.message ?? "Server error." }, { status: 500 });
  }
}