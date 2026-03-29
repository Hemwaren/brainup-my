import { NextRequest, NextResponse } from "next/server";

const HF_API   = "https://router.huggingface.co/hf-inference/models";
const HF_KEY   = process.env.HUGGINGFACE_API_KEY ?? process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY ?? "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY ?? process.env.NEXT_PUBLIC_GROQ_API_KEY ?? "";

// ─── HuggingFace: Emotion Detection ──────────────────────────────────────────
async function detectEmotion(text: string): Promise<{ emotion: string; confidence: number }> {
  const res = await fetch(
    `${HF_API}/j-hartmann/emotion-english-distilroberta-base`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text.slice(0, 512) }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("HF Emotion error:", err);
    throw new Error("Emotion detection failed.");
  }

  const data = await res.json();
  const results = Array.isArray(data[0]) ? data[0] : data;
  const top = results.sort((a: any, b: any) => b.score - a.score)[0];
  return {
    emotion:    top.label.toLowerCase(),
    confidence: Math.round(top.score * 100),
  };
}

// ─── Groq LLM: Key Point Extraction (replaces broken BART) ───────────────────
// BART on HuggingFace is unreliable and frequently rate-limited.
// Groq is already used for vision/audio — use it for key points too.
async function extractKeyPoints(text: string): Promise<string[]> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You are a concise journal assistant. Extract exactly 3 key points from the journal entry. Respond ONLY with a JSON array of 3 strings. No explanation, no markdown, no extra text. Example: [\"Point one.\", \"Point two.\", \"Point three.\"]",
        },
        {
          role: "user",
          content: text.slice(0, 1024),
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Groq key points error:", err);
    // Graceful fallback — return first sentence as single point
    const fallback = text.split(/[.!?]/)[0]?.trim();
    return fallback ? [fallback] : ["No key points extracted."];
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "[]";

  try {
    // Strip any accidental markdown code fences
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s: string) => String(s).trim()).filter(Boolean).slice(0, 3);
    }
  } catch {
    console.error("Failed to parse key points JSON:", content);
  }

  // Last resort fallback
  const fallback = text.split(/[.!?]/)[0]?.trim();
  return fallback ? [fallback] : ["No key points extracted."];
}

// ─── Groq Vision: Image → description ────────────────────────────────────────
async function describeImage(base64: string, mimeType: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: "text",
              text: "Describe this image in 2-3 sentences. Focus on the mood, emotions, and what is happening. Be concise and empathetic.",
            },
          ],
        },
      ],
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Groq Vision error:", err);
    return "";
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ─── Groq Whisper: Video → transcript ────────────────────────────────────────
async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  console.log("🎤 Whisper: Starting transcription, mimeType:", mimeType, "base64 length:", audioBase64.length);

  const binaryStr = atob(audioBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  const formData = new FormData();
  formData.append("file", blob, `audio.${mimeType.split("/")[1] || "mp4"}`);
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "text");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Whisper error:", err);
    return "";
  }

  const transcript = await res.text();
  console.log("🎤 Whisper raw transcript:", transcript?.substring(0, 200));

  const cleaned = transcript.trim();
  const words = cleaned.split(" ").filter(Boolean);
  const isMusicOnly = /^[\s♪\[\]()music]+$/i.test(cleaned) || words.length < 5;
  console.log("🎤 Whisper cleaned:", cleaned?.substring(0, 200), "| isMusicOnly:", isMusicOnly);
  return isMusicOnly ? "" : cleaned;
}

// ─── Main Route ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, text, imageBase64, imageMimeType, videoBase64, videoMimeType } = body;

    if (!type) {
      return NextResponse.json({ error: "Entry type is required." }, { status: 400 });
    }

    let analyzedText = "";

    if (type === "TEXT") {
      analyzedText = text ?? "";
    }

    if (type === "IMAGE") {
      const userText   = text ?? "";
      const visionDesc = imageBase64
        ? await describeImage(imageBase64, imageMimeType ?? "image/jpeg")
        : "";
      analyzedText = [userText, visionDesc].filter(Boolean).join(". ");
    }

    if (type === "VIDEO") {
      console.log("🎥 VIDEO entry — videoBase64 present:", !!videoBase64, "| imageBase64 present:", !!imageBase64);
      const userText = text ?? "";

      const [transcript, visionDesc] = await Promise.all([
        videoBase64
          ? transcribeAudio(videoBase64, videoMimeType ?? "video/mp4")
          : Promise.resolve(""),
        imageBase64
          ? describeImage(imageBase64, imageMimeType ?? "image/jpeg")
          : Promise.resolve(""),
      ]);

      console.log("🎥 Transcript:", transcript?.substring(0, 200));
      console.log("🎥 Vision:", visionDesc?.substring(0, 200));

      const parts = [];
      if (transcript || visionDesc) {
        if (transcript) parts.push(`Speech: ${transcript}`);
        if (visionDesc) parts.push(`Visual: ${visionDesc}`);
        if (userText)   parts.push(`Context: ${userText}`);
      } else {
        if (userText) parts.push(userText);
      }

      analyzedText = parts.join(". ");
      console.log("🎥 Final analyzedText:", analyzedText?.substring(0, 300));
    }

    if (!analyzedText.trim()) {
      return NextResponse.json({ error: "Not enough content to analyse." }, { status: 400 });
    }

    const [emotionResult, keyPoints] = await Promise.all([
      detectEmotion(analyzedText),
      extractKeyPoints(analyzedText),
    ]);

    return NextResponse.json({
      emotion:      emotionResult.emotion,
      confidence:   emotionResult.confidence,
      keyPoints,
      analyzedText: analyzedText.slice(0, 500),
    });

  } catch (err: any) {
    console.error("Journal AI route error:", err);
    return NextResponse.json({ error: err.message ?? "AI analysis failed." }, { status: 500 });
  }
}