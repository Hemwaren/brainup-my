import { NextRequest, NextResponse } from "next/server";

const HF_URL = "https://hemwaren-brainup-ei-predictor.hf.space";

export async function POST(req: NextRequest) {
  try {
    const { answers } = await req.json();

    if (!answers || answers.length < 9) {
      return NextResponse.json({ error: "Need at least 9 answers" }, { status: 400 });
    }

    const res = await fetch(`${HF_URL}/gradio_api/call/predict_early`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: answers.slice(0, 9) }),
    });

    const { event_id } = await res.json();

    const resultRes = await fetch(`${HF_URL}/gradio_api/call/predict_early/${event_id}`);
    const text = await resultRes.text();
    const lines = text.split("\n").filter(l => l.startsWith("data:"));
    const data = JSON.parse(lines[lines.length - 1].replace("data: ", ""));

    return NextResponse.json({ predicted_ei: data[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}