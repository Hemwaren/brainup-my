"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Brain, ChevronRight, ClipboardList, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";

// ── 18 Mendeley Questions ─────────────────────────────────────────
const QUESTIONS = [
  { id: 1,  dim: "EA",  label: "😤 Emotional Awareness",     text: "I am aware of my personal feelings when meeting someone." },
  { id: 2,  dim: "EU",  label: "🔥 Emotion Usage",           text: "I always evaluate the importance of work and events to myself." },
  { id: 3,  dim: "EUS", label: "❤️ Emotional Understanding",  text: "I know when to share my own problems with others." },
  { id: 4,  dim: "EC",  label: "🧭 Emotional Controlling",    text: "I know how to maintain positive emotions." },
  { id: 5,  dim: "EA",  label: "😤 Emotional Awareness",     text: "I know the content I want to convey to others when working in a team." },
  { id: 6,  dim: "EU",  label: "🔥 Emotion Usage",           text: "My ability to come up with new ideas is affected by my mood." },
  { id: 7,  dim: "EUS", label: "❤️ Emotional Understanding",  text: "When communicating, I know how to arrange content so listeners feel comfortable." },
  { id: 8,  dim: "EC",  label: "🧭 Emotional Controlling",    text: "I always create positive motivation when taking on a job." },
  { id: 9,  dim: "EA",  label: "😤 Emotional Awareness",     text: "I can feel and capture the emotions of other team members." },
  { id: 10, dim: "EU",  label: "🔥 Emotion Usage",           text: "My problem-solving ability is affected by mood." },
  { id: 11, dim: "EUS", label: "❤️ Emotional Understanding",  text: "When I need to express myself, I always know how to make an impression." },
  { id: 12, dim: "EC",  label: "🧭 Emotional Controlling",    text: "I always control my emotions in every situation." },
  { id: 13, dim: "EA",  label: "😤 Emotional Awareness",     text: "When my emotions change at work, I know clearly why." },
  { id: 14, dim: "EU",  label: "🔥 Emotion Usage",           text: "My responsibilities and enthusiasm for work are influenced by mood." },
  { id: 15, dim: "EUS", label: "❤️ Emotional Understanding",  text: "I empathize with the stories others share with me." },
  { id: 16, dim: "EA",  label: "😤 Emotional Awareness",     text: "I feel the evaluation through hidden meanings of group members." },
  { id: 17, dim: "EU",  label: "🔥 Emotion Usage",           text: "Emotions are one of the most meaningful things in my life." },
  { id: 18, dim: "EUS", label: "❤️ Emotional Understanding",  text: "I always believe in myself to do a good job." },
];

const OPTIONS = [
  { label: "Strongly Disagree", value: 1 },
  { label: "Disagree", value: 2 },
  { label: "Neutral", value: 3 },
  { label: "Agree", value: 4 },
  { label: "Strongly Agree", value: 5 },
];

const BRAIN_STYLE_DESC: Record<string, { emoji: string; traits: string; desc: string }> = {
  Sage:      { emoji: "🧙", traits: "Wise · Empathetic · Thoughtful",    desc: "You process emotions deeply and guide others with wisdom." },
  Energizer: { emoji: "⚡", traits: "Dynamic · Creative · Practical",    desc: "You use emotions to fuel action and inspire those around you." },
  Guardian:  { emoji: "🛡️", traits: "Loyal · Caring · Stable",          desc: "You protect team harmony and provide emotional stability." },
  Visionary: { emoji: "🔭", traits: "Passionate · Transformative · Bold",desc: "You channel emotions into big ideas and long-term change." },
  Deliverer: { emoji: "🎯", traits: "Focused · Reliable · Efficient",    desc: "You use logic and emotion to consistently deliver results." },
  Strategist:{ emoji: "♟️", traits: "Precise · Careful · Future-focused",desc: "You plan with both heart and mind to achieve lasting goals." },
  Inventor:  { emoji: "💡", traits: "Curious · Analytical · Creative",   desc: "You combine logic with imagination to create new solutions." },
  Scientist: { emoji: "🔬", traits: "Methodical · Objective · Sharp",    desc: "You analyse emotions with precision to optimise performance." },
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="font-extrabold text-slate-900">{score.toFixed(1)}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
          style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function AssessmentPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<"INTRO" | "PHASE1" | "ML_INTERSTITIAL" | "PHASE2" | "PROCESSING" | "RESULTS">("INTRO");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [mlPrediction, setMlPrediction] = useState<number | null>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/auth"); return; }
      setUserId(session.user.id);
      setToken(session.access_token);
    });
  }, [router]);

  const current = QUESTIONS[idx];
  const totalAnswered = Object.keys(answers).length;
  const progressPct = Math.round((totalAnswered / 18) * 100);

  function selectAnswer(value: number) {
    setAnswers(prev => ({ ...prev, [current.id]: value }));
  }

  function next() {
    if (idx < 8) {
      // Phase 1: Q1-Q9
      setIdx(idx + 1);
    } else if (idx === 8) {
      // After Q9 → ML prediction
      callMLPrediction();
    } else if (idx < 17) {
      // Phase 2: Q10-Q17
      setIdx(idx + 1);
    } else {
      // After Q18 → submit
      submitAssessment();
    }
  }

  function back() {
    if (idx > 0) setIdx(idx - 1);
  }

  async function callMLPrediction() {
    setStep("ML_INTERSTITIAL");
    setLoading(true);
    try {
      const first9 = Array.from({ length: 9 }, (_, i) => answers[i + 1] ?? 3);
      const res = await fetch("/api/assessment/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: first9 }),
      });
      const data = await res.json();
      setMlPrediction(data.predicted_ei ?? null);
    } catch {
      setMlPrediction(null);
    }
    setLoading(false);
  }

  function continueToPhase2() {
    setIdx(9);
    setStep("PHASE2");
  }

  async function submitAssessment() {
    setStep("PROCESSING");
    try {
      const allAnswers = Array.from({ length: 18 }, (_, i) => answers[i + 1] ?? 3);
      const res = await fetch("/api/assessment/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: allAnswers, ml_predicted_ei: mlPrediction }),
      });
      const data = await res.json();
      setResults(data);

      // Award XP
      if (token) {
        fetch("/api/gamification/award-xp", {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
          body: JSON.stringify({ activityKey: "full_ei_assessment" }),
        }).catch(() => {});
      }

      setStep("RESULTS");
    } catch {
      setStep("RESULTS");
    }
  }

  function restart() {
    setAnswers({});
    setIdx(0);
    setMlPrediction(null);
    setResults(null);
    setStep("INTRO");
  }

  // ── INTRO ──────────────────────────────────────────────────────
  if (step === "INTRO") return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
            <ClipboardList size={18} />
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">EI Assessment Engine</h1>
        </div>
        <button onClick={() => router.push("/post-login")}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Discover Your EI Profile</h2>
            <p className="mt-1 text-sm text-slate-500">Based on the validated BEIS psychometric framework</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[["18", "Questions"], ["4", "Dimensions"], ["~4 mins", "Duration"]].map(([val, lab]) => (
                <div key={lab} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <div className="text-lg font-extrabold text-cyan-600">{val}</div>
                  <div className="text-xs text-slate-500">{lab}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-sm text-slate-600">
              <div>✅ ML-powered early prediction at Q9</div>
              <div>✅ Personalised AI feedback via Groq</div>
              <div>✅ Brain Style determination</div>
              <div>✅ No right or wrong answers — be honest!</div>
            </div>
            <button onClick={() => setStep("PHASE1")}
              className="mt-5 rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-6 py-3 text-sm font-extrabold text-white hover:opacity-95">
              Begin Assessment →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── QUESTION SCREEN ────────────────────────────────────────────
  if (step === "PHASE1" || step === "PHASE2") return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Phase indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className={`rounded-full px-3 py-1 ${step === "PHASE1" ? "bg-cyan-500 text-white" : "bg-slate-200 text-slate-500"}`}>Phase 1</span>
            <span className="text-slate-300">→</span>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-500">ML Prediction</span>
            <span className="text-slate-300">→</span>
            <span className={`rounded-full px-3 py-1 ${step === "PHASE2" ? "bg-cyan-500 text-white" : "bg-slate-200 text-slate-500"}`}>Phase 2</span>
          </div>
          <span className="text-xs text-slate-400 font-bold">{progressPct}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 mb-4">
          <div className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
            style={{ width: `${progressPct}%` }} />
        </div>

        {/* Question */}
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 mb-3">
          {current.label} · Q{current.id} of 18
        </div>
        <p className="text-lg font-extrabold text-slate-900 mb-1">{current.text}</p>
        <p className="text-sm text-slate-500 mb-4">Select the option that best describes you.</p>

        {/* Options */}
        <div className="space-y-2 mb-5">
          {OPTIONS.map(o => {
            const selected = answers[current.id] === o.value;
            return (
              <button key={o.value} onClick={() => selectAnswer(o.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <span className="text-sm font-semibold text-slate-800">{o.label}</span>
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ${selected ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {o.value}
                </span>
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={back} disabled={idx === 0}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            Back
          </button>
          <button onClick={next} disabled={!answers[current.id]}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2 text-sm font-extrabold text-white disabled:opacity-40">
            {idx === 8 ? "Get ML Prediction" : idx === 17 ? "Finish" : "Next"}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  // ── ML INTERSTITIAL ────────────────────────────────────────────
  if (step === "ML_INTERSTITIAL") return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white mb-4">
          <Brain size={28} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">🤖 AI Early Prediction</h2>
        <p className="text-sm text-slate-500 mb-6">Based on your first 9 answers, our Random Forest model trained on 372 real university students predicts:</p>

        {loading ? (
          <div className="text-slate-400 text-sm animate-pulse">Analysing your responses...</div>
        ) : (
          <>
            <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-6 mb-6">
              <div className="text-5xl font-extrabold text-cyan-600 mb-1">
                {mlPrediction?.toFixed(1) ?? "—"}
              </div>
              <div className="text-sm font-bold text-cyan-500">Predicted EI Score / 100</div>
              <div className="text-xs text-slate-400 mt-2">Complete 9 more questions for your accurate score!</div>
            </div>
            <button onClick={continueToPhase2}
              className="rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-8 py-3 text-sm font-extrabold text-white hover:opacity-95">
              Continue to Phase 2 →
            </button>
          </>
        )}
      </div>
    </div>
  );

  // ── PROCESSING ─────────────────────────────────────────────────
  if (step === "PROCESSING") return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white mb-4 animate-pulse">
          <Brain size={28} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-6">Analysing Your Results...</h2>
        <div className="space-y-3 text-left max-w-xs mx-auto">
          {["Collecting all 18 responses", "Applying BEIS scoring algorithm", "Calculating 4 EI dimensions", "Determining your Brain Style", "Generating AI feedback with Groq"].map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── RESULTS ────────────────────────────────────────────────────
  if (step === "RESULTS" && results) {
    const brainInfo = BRAIN_STYLE_DESC[results.brain_style] ?? BRAIN_STYLE_DESC["Visionary"];
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-slate-900">Your EI Profile 🎉</h1>
          <button onClick={restart}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
            <RotateCcw size={14} /> Retake
          </button>
        </div>

        {/* Overall Score + ML comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center">
            <div className="text-xs font-bold text-slate-500 mb-1">Overall EI Score</div>
            <div className="text-5xl font-extrabold text-cyan-600">{results.overall?.toFixed(1)}</div>
            <div className="text-sm text-slate-400 mt-1">out of 100</div>
          </div>
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5 shadow-sm text-center">
            <div className="text-xs font-bold text-cyan-600 mb-1">🤖 ML Predicted at Q9</div>
            <div className="text-4xl font-extrabold text-cyan-700">{mlPrediction?.toFixed(1) ?? "—"}</div>
            <div className="text-xs text-cyan-500 mt-1">
              {mlPrediction ? `${Math.abs(results.overall - mlPrediction).toFixed(1)} pts difference` : ""}
            </div>
          </div>
        </div>

        {/* Brain Style */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold text-slate-500 mb-3">🧠 Your Brain Style</div>
          <div className="flex items-center gap-4">
            <div className="text-5xl">{brainInfo.emoji}</div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{results.brain_style}</div>
              <div className="text-xs text-slate-500 mt-0.5">{brainInfo.traits}</div>
              <p className="text-sm text-slate-600 mt-1">{brainInfo.desc}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {[["Focus", results.brain_focus], ["Decisions", results.brain_decisions], ["Drive", results.brain_drive]].map(([k, v]) => (
              <span key={k} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                {k}: {v}
              </span>
            ))}
          </div>
        </div>

        {/* Dimension scores */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="text-sm font-extrabold text-slate-900 mb-2">📊 4 EI Dimensions</div>
          <ScoreBar label="😤 Emotional Awareness" score={results.ea} />
          <ScoreBar label="🔥 Emotion Usage" score={results.eu} />
          <ScoreBar label="❤️ Emotional Understanding" score={results.eus} />
          <ScoreBar label="🧭 Emotional Controlling" score={results.ec} />
        </div>

        {/* Groq Feedback */}
        {results.groq_feedback && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-extrabold text-slate-900 mb-3">✍️ AI Personalised Feedback</div>
            <div className="space-y-3">
              {[
                ["😤 Emotional Awareness", results.groq_feedback.ea_feedback],
                ["🔥 Emotion Usage", results.groq_feedback.eu_feedback],
                ["❤️ Emotional Understanding", results.groq_feedback.eus_feedback],
                ["🧭 Emotional Controlling", results.groq_feedback.ec_feedback],
              ].map(([dim, text]) => text && (
                <div key={dim} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-extrabold text-slate-700 mb-1">{dim}</div>
                  <p className="text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => router.push("/learning-hub/resources")}
            className="flex-1 rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 py-3 text-sm font-extrabold text-white hover:opacity-95">
            📚 View Resources
          </button>
          <button onClick={restart}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}