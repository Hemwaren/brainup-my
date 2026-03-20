"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, X, Bookmark, BookOpenText, ArrowLeft, Star, Filter,
  CheckCircle2, Clock, FileText, Video, Sparkles, FileSpreadsheet,
  Flame, ShieldAlert, Angry, Users, Handshake, Heart, Timer, Baby,
  Loader2, RefreshCw, Link2, GraduationCap, Brain, ChevronRight,
  Trophy, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "LIBRARY" | "BOOKMARK";

type EIResource = {
  id: string;
  title: string;
  description: string;
  content: string | null;
  category: string;
  pillar: string;
  type: string;
  status: string;
  publish_date: string;
  view_count: number;
  bookmark_count: number;
  resource_url: string | null;
  created_at: string;
};

type MCQQuestion = {
  question: string;
  options: string[];
  correct: string;
};

type WorksheetScene = {
  scene: string;
  choices: { label: string; next: number | "end" }[];
};

type WorksheetStory = {
  scenes: WorksheetScene[];
  feedback: string;
  eiInsight: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const BRAND_BG = "bg-cyan-600";

const UNIFIED = {
  bar:  "from-teal-400 via-cyan-500 to-sky-500",
  pill: "bg-cyan-100 text-cyan-800",
};

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  ARTICLE:          { label: "Article",         icon: <FileText        size={13} /> },
  VIDEO:            { label: "Video",           icon: <Video           size={13} /> },
  GUIDED_EXERCISE:  { label: "Guided Exercise", icon: <Sparkles        size={13} /> },
  WORKSHEET:        { label: "Worksheet",       icon: <FileSpreadsheet size={13} /> },
  LESSON:           { label: "Lesson",          icon: <GraduationCap   size={13} /> },
  QUIZ:             { label: "Quiz",            icon: <Sparkles        size={13} /> },
};

function getTypeMeta(type: string) {
  return TYPE_META[type?.toUpperCase()] ?? { label: "Resource", icon: <BookOpenText size={13} /> };
}

type Topic = { id: string; title: string; icon: React.ReactNode };

const TOPICS: Topic[] = [
  { id: "productivity",  title: "Productivity",    icon: <Timer       size={15} /> },
  { id: "confidence",    title: "Confidence",      icon: <Flame       size={15} /> },
  { id: "anger",         title: "Anger",           icon: <Angry       size={15} /> },
  { id: "anxiety",       title: "Anxiety",         icon: <ShieldAlert size={15} /> },
  { id: "people",        title: "People-pleasing", icon: <Users       size={15} /> },
  { id: "relationships", title: "Relationships",   icon: <Handshake   size={15} /> },
  { id: "selflove",      title: "Self-love",       icon: <Heart       size={15} /> },
  { id: "parenting",     title: "Parenting",       icon: <Baby        size={15} /> },
];

// ─── Groq via API route ────────────────────────────────────────────────────
async function callGroq(prompt: string): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Groq API error.");
  return data.text ?? "";
}

async function generateMCQ(resource: EIResource): Promise<MCQQuestion[]> {
  const context = `Title: ${resource.title}\nDescription: ${resource.description}\nContent: ${resource.content ?? "No body content provided."}`;
  const prompt = `You are an EI (Emotional Intelligence) educator. Based on this resource, generate exactly 2 multiple choice questions to test understanding.

Resource:
${context}

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Only one option is correct
- Questions should test comprehension and EI application
- Keep questions clear and concise
- Return ONLY valid JSON, no markdown, no explanation

Format:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": "Option A"
  },
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": "Option B"
  }
]`;

  const raw = await callGroq(prompt);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

async function generateSummary(resource: EIResource): Promise<string[]> {
  const context = `Title: ${resource.title}\nDescription: ${resource.description}\nContent: ${resource.content ?? "No body content — summarise based on title and description only."}`;
  const prompt = `You are an EI (Emotional Intelligence) educator. Summarise this resource into exactly 3 clear, actionable key takeaways for an employee.

Resource:
${context}

Rules:
- Each takeaway must be 1-2 sentences max
- Start each with an action verb or insight
- Be practical and relatable to workplace context
- Return ONLY valid JSON array of 3 strings, no markdown

Format:
["Takeaway 1 here.", "Takeaway 2 here.", "Takeaway 3 here."]`;

  const raw = await callGroq(prompt);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

async function generateWorksheetStory(prompt: string, title: string): Promise<WorksheetStory> {
  const groqPrompt = `You are an EI (Emotional Intelligence) game designer. Create an interactive branching scenario game based on this workplace situation.

Scenario prompt: "${prompt}"
Resource title: "${title}"

Rules:
- Create exactly 3 scenes (scene 0, 1, 2)
- Scene 0: Opening situation with 4 choices
- Scene 1: Follow-up situation with 4 choices
- Scene 2: Final situation with 4 choices, all lead to "end"
- Each choice label must be max 12 words
- Scene text must be engaging and realistic
- Feedback must summarise the EI lesson learned (2-3 sentences)
- EI insight must give a practical EI tip (1-2 sentences)
- Return ONLY valid JSON, no markdown

Format:
{
  "scenes": [
    {
      "scene": "Scene description here.",
      "choices": [
        {"label": "Choice A text", "next": 1},
        {"label": "Choice B text", "next": 1},
        {"label": "Choice C text", "next": 1},
        {"label": "Choice D text", "next": 1}
      ]
    },
    {
      "scene": "Scene description here.",
      "choices": [
        {"label": "Choice A text", "next": 2},
        {"label": "Choice B text", "next": 2},
        {"label": "Choice C text", "next": 2},
        {"label": "Choice D text", "next": 2}
      ]
    },
    {
      "scene": "Final scene description here.",
      "choices": [
        {"label": "Choice A text", "next": "end"},
        {"label": "Choice B text", "next": "end"},
        {"label": "Choice C text", "next": "end"},
        {"label": "Choice D text", "next": "end"}
      ]
    }
  ],
  "feedback": "Summary of the EI lesson here.",
  "eiInsight": "A practical EI tip the employee can apply today."
}`;

  const raw = await callGroq(groqPrompt);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ─── Knowledge Checkup Modal ──────────────────────────────────────────────────
function KnowledgeCheckup({
  resource, onComplete, onClose,
}: {
  resource: EIResource;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentQ,  setCurrentQ]  = useState(0);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correct,   setCorrect]   = useState(false);
  const [score,     setScore]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [allDone,   setAllDone]   = useState(false);
  const [shuffled,  setShuffled]  = useState<string[]>([]);

  // Small delay before calling Groq to avoid burst with other calls
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const qs = await generateMCQ(resource);
        setQuestions(qs);
        setShuffled([...qs[0].options].sort(() => Math.random() - 0.5));
      } catch (e: any) {
        setError(e.message?.includes("429") || e.message?.includes("rate limit")
          ? "Rate limit reached. Please wait 30 seconds and try again."
          : "Failed to generate questions. Please try again.");
      } finally {
        setLoading(false);
      }
    }, 1000); // 1s delay
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    const isCorrect = selected === questions[currentQ].correct;
    setCorrect(isCorrect);
    if (isCorrect) setScore((s) => s + 1);
  }

  function handleNext() {
    const isCorrect = selected === questions[currentQ].correct;
    if (!isCorrect) {
      setShuffled([...questions[currentQ].options].sort(() => Math.random() - 0.5));
      setSelected(null); setSubmitted(false); setCorrect(false);
      return;
    }
    if (currentQ + 1 >= questions.length) { setAllDone(true); return; }
    const nextQ = currentQ + 1;
    setCurrentQ(nextQ);
    setShuffled([...questions[nextQ].options].sort(() => Math.random() - 0.5));
    setSelected(null); setSubmitted(false); setCorrect(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden"
      >
        <div className={`bg-gradient-to-r ${UNIFIED.bar} p-5`}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-white/70 uppercase tracking-widest">AI Knowledge Check</div>
              <div className="text-base font-extrabold text-white">Quick Knowledge Checkup</div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 size={32} className="animate-spin text-cyan-500" />
              <p className="text-sm text-slate-500 font-semibold">Groq is generating your questions…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex flex-col items-center py-8 gap-4">
              <AlertCircle size={32} className="text-rose-400" />
              <p className="text-sm text-rose-600 font-semibold text-center">{error}</p>
              <button type="button" onClick={onClose}
                className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
                Close
              </button>
            </div>
          )}

          {/* All done */}
          {allDone && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8 gap-4 text-center">
              <div className={`grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br ${UNIFIED.bar} shadow-lg`}>
                <Trophy size={36} className="text-white" />
              </div>
              <div className="text-xl font-extrabold text-slate-900">You did it! 🎉</div>
              <p className="text-sm text-slate-500 max-w-xs">
                You have successfully completed this resource. Your understanding of this EI topic has been verified!
              </p>
              <div className="flex items-center gap-2 rounded-2xl bg-cyan-50 border border-cyan-200 px-4 py-2">
                <CheckCircle2 size={16} className="text-cyan-600" />
                <span className="text-sm font-extrabold text-cyan-700">Resource Completed!</span>
              </div>
              <button type="button" onClick={onComplete}
                className={`mt-2 inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-extrabold text-white hover:opacity-90 transition ${BRAND_BG}`}>
                Continue → Earn XP
              </button>
            </motion.div>
          )}

          {/* Questions */}
          {!loading && !error && !allDone && questions.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold">Question {currentQ + 1} of {questions.length}</span>
                <span className="font-bold text-cyan-600">{score} correct</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${UNIFIED.bar} transition-all`}
                  style={{ width: `${(currentQ / questions.length) * 100}%` }} />
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-extrabold text-slate-900 leading-relaxed">
                  {questions[currentQ].question}
                </p>
              </div>

              <div className="space-y-2.5">
                {shuffled.map((opt, i) => {
                  const isSelected   = selected === opt;
                  const isCorrectOpt = opt === questions[currentQ].correct;
                  let cls = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
                  if (submitted && isCorrectOpt && correct) cls = "border-emerald-400 bg-emerald-50 text-emerald-800";
                  else if (submitted && isSelected && !isCorrectOpt) cls = "border-rose-400 bg-rose-50 text-rose-800";
                  else if (isSelected) cls = "border-cyan-400 bg-cyan-50 text-cyan-800";

                  return (
                    <button key={i} type="button" disabled={submitted} onClick={() => setSelected(opt)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${cls}`}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold border ${isSelected ? "border-current" : "border-slate-300"}`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                      {submitted && isCorrectOpt && correct && (
                        <CheckCircle2 size={15} className="ml-auto text-emerald-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold ${correct ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                  {correct ? "✅ Correct! Great understanding." : "❌ Not quite right. Let's try again with shuffled options."}
                </motion.div>
              )}

              <div className="flex gap-3 pt-1">
                {!submitted ? (
                  <button type="button" onClick={handleSubmit} disabled={!selected}
                    className={`flex-1 rounded-2xl py-2.5 text-sm font-extrabold text-white transition ${selected ? `${BRAND_BG} hover:opacity-90` : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
                    Submit Answer
                  </button>
                ) : (
                  <button type="button" onClick={handleNext}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-extrabold text-white transition ${BRAND_BG} hover:opacity-90`}>
                    {correct ? (currentQ + 1 >= questions.length ? "See Results" : "Next Question →") : "Try Again →"}
                  </button>
                )}
                <button type="button" onClick={onClose}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-50 transition">
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── AI Summary Panel ─────────────────────────────────────────────────────────
function AISummaryPanel({ resource, onClose }: { resource: EIResource; onClose: () => void }) {
  const [takeaways, setTakeaways] = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [fetched,   setFetched]   = useState(false);

  // Only call Groq when user explicitly opens the panel and hasn't fetched yet
  useEffect(() => {
    if (fetched) return;
    setFetched(true);
    setLoading(true);
    setError(null);
    generateSummary(resource)
      .then((result) => setTakeaways(result))
      .catch((e) => setError(
        e.message?.includes("429") || e.message?.includes("rate limit")
          ? "Rate limit reached. Please wait a moment, then close and reopen the summary."
          : "Failed to generate summary. Please try again."
      ))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
      className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-teal-50 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${UNIFIED.bar}`}>
            <Brain size={15} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-900">AI Key Takeaways</div>
            <div className="text-[11px] text-slate-500">Powered by Groq</div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
          <X size={16} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-4">
          <Loader2 size={18} className="animate-spin text-cyan-500 shrink-0" />
          <span className="text-sm text-slate-500 font-semibold">Groq is reading this resource…</span>
        </div>
      )}

      {error && <p className="text-sm text-rose-600 font-semibold">{error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {takeaways.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3">
              <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br ${UNIFIED.bar} text-white text-[10px] font-extrabold mt-0.5`}>
                {i + 1}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{t}</p>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Worksheet Game ───────────────────────────────────────────────────────────
function WorksheetGame({ resource, onFinish }: { resource: EIResource; onFinish: () => void }) {
  const [story,         setStory]         = useState<WorksheetStory | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [sceneIdx,      setSceneIdx]      = useState(0);
  const [gameOver,      setGameOver]      = useState(false);
  const [choiceHistory, setChoiceHistory] = useState<string[]>([]);
  const [started,       setStarted]       = useState(false);

  async function startGame() {
    setStarted(true);
    setLoading(true);
    setError(null);
    try {
      const prompt = resource.content ?? resource.description ?? resource.title;
      const result = await generateWorksheetStory(prompt, resource.title);
      setStory(result);
    } catch (e: any) {
      setError(e.message?.includes("429") || e.message?.includes("rate limit")
        ? "Rate limit reached. Please wait a moment and click Start again."
        : "Failed to generate the scenario. Please try again.");
      setStarted(false);
    } finally {
      setLoading(false);
    }
  }

  function handleChoice(choice: { label: string; next: number | "end" }) {
    setChoiceHistory((prev) => [...prev, choice.label]);
    if (choice.next === "end") { setGameOver(true); }
    else { setSceneIdx(choice.next as number); }
  }

  if (!started) {
    return (
      <div className="flex flex-col items-center py-10 gap-5 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-500 to-sky-500 shadow-md">
          <Sparkles size={28} className="text-white" />
        </div>
        <div>
          <div className="text-lg font-extrabold text-slate-900 mb-1">Ready for your scenario?</div>
          <p className="text-sm text-slate-500 max-w-sm">Groq will generate a unique workplace situation for you to navigate using emotional intelligence. Each playthrough is different!</p>
        </div>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-5 py-3 text-xs text-cyan-700 font-semibold max-w-sm">
          💡 You will make choices across 3 scenes. There are no wrong answers — your EI skills are what matter.
        </div>
        <button type="button" onClick={startGame}
          className="inline-flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-extrabold text-white transition bg-cyan-600 hover:opacity-90 shadow-sm">
          <Brain size={16} /> Generate My Scenario →
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <Loader2 size={36} className="animate-spin text-cyan-500" />
        <p className="text-sm text-slate-500 font-semibold text-center">
          Groq is crafting your scenario…<br />
          <span className="text-xs text-slate-400">This may take a few seconds</span>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-12 gap-4 text-center">
        <AlertCircle size={36} className="text-rose-400" />
        <p className="text-sm text-rose-600 font-semibold">{error}</p>
        <button type="button" onClick={onFinish}
          className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
          Go Back
        </button>
      </div>
    );
  }

  if (!story) return null;

  // Game over
  if (gameOver) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className={`rounded-2xl bg-gradient-to-r ${UNIFIED.bar} p-5 text-white text-center`}>
          <div className="text-lg font-extrabold mb-1">Scenario Complete! 🎯</div>
          <div className="text-xs text-white/70">Here's how your choices played out</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-extrabold text-slate-900 mb-3">Your Journey</div>
          <div className="space-y-2">
            {choiceHistory.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br ${UNIFIED.bar} text-white text-[9px] font-extrabold`}>
                  {i + 1}
                </div>
                {c}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={16} className="text-cyan-600" />
            <div className="text-sm font-extrabold text-cyan-900">Scenario Feedback</div>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{story.feedback}</p>
        </div>

        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-teal-600" />
            <div className="text-sm font-extrabold text-teal-900">EI Insight</div>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{story.eiInsight}</p>
        </div>

        <button type="button" onClick={onFinish}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white transition ${BRAND_BG} hover:opacity-90`}>
          <Star size={16} /> Rate & Complete Resource
        </button>
      </motion.div>
    );
  }

  const currentScene = story.scenes[sceneIdx];

  return (
    <motion.div key={sceneIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span className="font-bold">Scene {sceneIdx + 1} of {story.scenes.length}</span>
          <span className="font-bold text-cyan-600">Choose your response</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full bg-gradient-to-r ${UNIFIED.bar} transition-all duration-500`}
            style={{ width: `${((sceneIdx + 1) / story.scenes.length) * 100}%` }} />
        </div>
      </div>

      <div className={`rounded-2xl bg-gradient-to-br ${UNIFIED.bar} p-5 text-white shadow-md`}>
        <div className="text-[10px] font-extrabold text-white/60 uppercase tracking-widest mb-2">Scene {sceneIdx + 1}</div>
        <p className="text-sm font-semibold leading-relaxed">{currentScene.scene}</p>
      </div>

      <div className="space-y-2.5">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">What do you do?</div>
        {currentScene.choices.map((choice, i) => (
          <motion.button key={i} type="button" whileTap={{ scale: 0.98 }} onClick={() => handleChoice(choice)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-semibold text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 transition">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-300 text-xs font-extrabold text-slate-500">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1">{choice.label}</span>
            <ChevronRight size={15} className="shrink-0 text-slate-300" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Flip Card ────────────────────────────────────────────────────────────────
function FlipCard({ resource, bookmarked, onBookmark, onRead }: {
  resource: EIResource; bookmarked: boolean; onBookmark: () => void; onRead: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const meta  = getTypeMeta(resource.type);
  const topic = TOPICS.find((t) => t.id === resource.category);

  return (
    <div className="relative h-52" style={{ perspective: "1000px" }}
      onMouseEnter={() => setFlipped(true)} onMouseLeave={() => setFlipped(false)}>
      <motion.div className="relative w-full h-full"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformStyle: "preserve-3d" }}>

        {/* FRONT */}
        <div className="absolute inset-0 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
          <div className={`h-1 w-full bg-gradient-to-r flex-shrink-0 ${UNIFIED.bar}`} />
          <div className="flex flex-col flex-1 p-5">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${UNIFIED.pill}`}>
                {meta.icon} {meta.label}
              </span>
              {topic && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  {topic.icon} {topic.title}
                </span>
              )}
            </div>
            <div className="text-base font-extrabold text-slate-900 leading-snug flex-1 line-clamp-2">{resource.title}</div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-slate-400" />
                  {new Date(resource.publish_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className="flex items-center gap-1"><Bookmark size={12} className="text-slate-400" /> {resource.bookmark_count}</span>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); onBookmark(); }}
                className={`grid h-8 w-8 place-items-center rounded-xl border transition ${bookmarked ? "border-cyan-200 bg-cyan-50 text-cyan-600" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"}`}>
                <Bookmark size={13} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className={`absolute inset-0 rounded-3xl overflow-hidden flex flex-col bg-gradient-to-br ${UNIFIED.bar} shadow-lg`}
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative z-10 flex flex-col flex-1 p-5 text-white">
            <div className="text-[10px] font-extrabold text-white/60 uppercase tracking-widest mb-2">
              {meta.label}{topic ? ` · ${topic.title}` : ""}
            </div>
            <div className="text-base font-extrabold leading-snug mb-2 flex-1 line-clamp-3">{resource.description || resource.title}</div>
            <div className="flex items-center gap-2 text-[11px] text-white/70 mb-4">
              <BookOpenText size={11} /> {resource.view_count} views · <Bookmark size={11} /> {resource.bookmark_count} saves
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onRead}
                className="flex-1 rounded-2xl bg-white py-2.5 text-xs font-extrabold text-slate-900 hover:bg-white/90 transition shadow-sm">
                Read now →
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onBookmark(); }}
                className={`grid h-10 w-10 place-items-center rounded-2xl border transition ${bookmarked ? "bg-white/30 border-white/50 text-white" : "bg-white/15 border-white/30 text-white/70 hover:bg-white/25"}`}>
                <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="h-52 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-pulse">
      <div className={`h-1 w-full bg-gradient-to-r ${UNIFIED.bar} opacity-30`} />
      <div className="p-5 flex flex-col h-full gap-3">
        <div className="flex gap-2"><div className="h-5 w-20 rounded-full bg-slate-200" /><div className="h-5 w-24 rounded-full bg-slate-200" /></div>
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-3/4 rounded bg-slate-200" />
        <div className="flex-1" />
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="h-3 w-24 rounded bg-slate-200" /><div className="h-8 w-8 rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────
function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={["relative rounded-full px-4 py-2 text-xs font-extrabold transition", active ? "text-white" : "text-white/60 hover:text-white"].join(" ")}>
      {label}
      {active && <motion.span layoutId="tab-underline" className="absolute left-1/2 top-full mt-1.5 h-0.5 w-10 -translate-x-1/2 rounded-full bg-white/80" />}
    </button>
  );
}

function FilterChip({ active, label, icon, onClick }: { active: boolean; label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.96 }}
      className={["inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
        active ? "bg-white text-cyan-700 shadow-sm" : "bg-white/15 text-white/80 hover:bg-white/25 hover:text-white"].join(" ")}>
      {icon}{label}
    </motion.button>
  );
}

function TopicChip({ active, label, icon, onClick }: { active: boolean; label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.97 }}
      className={["inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-extrabold w-full transition",
        active ? "border-cyan-500 bg-cyan-600 text-white shadow-md shadow-cyan-100" : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50"].join(" ")}>
      {icon}{label}
    </motion.button>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="rounded-lg p-1.5 transition hover:scale-110">
          <Star size={20} className={value >= n ? "text-amber-400" : "text-slate-300"} fill={value >= n ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResourcesPage() {
  const [tab,            setTab]            = useState<Tab>("LIBRARY");
  const [query,          setQuery]          = useState("");
  const [selectedTypes,  setSelectedTypes]  = useState<Set<string>>(new Set());
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [mode,           setMode]           = useState<"LIST" | "READ" | "WORKSHEET">("LIST");
  const [activeId,       setActiveId]       = useState<string | null>(null);
  const [bookmarks,      setBookmarks]      = useState<Record<string, boolean>>({});
  const [ratings,        setRatings]        = useState<Record<string, number>>({});
  const [showCheckup,    setShowCheckup]    = useState(false);
  const [showSummary,    setShowSummary]    = useState(false);
  const [justCompleted,  setJustCompleted]  = useState(false);
  const [resources,      setResources]      = useState<EIResource[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [fetchError,     setFetchError]     = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const { data, error } = await supabase.from("ei_resources").select("*").eq("status", "PUBLISHED").order("created_at", { ascending: false });
      if (error) throw error;
      setResources(data ?? []);
      setBookmarks((prev) => {
        const next = { ...prev };
        for (const r of data ?? []) { if (!(r.id in next)) next[r.id] = false; }
        return next;
      });
    } catch (err: any) {
      setFetchError(err?.message ?? "Failed to load resources.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  useEffect(() => {
    const channel = supabase.channel("ei_resources_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ei_resources" }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload as any;
        if (eventType === "INSERT" && newRow.status === "PUBLISHED") {
          setResources((prev) => prev.some((r) => r.id === newRow.id) ? prev : [newRow, ...prev]);
          setBookmarks((prev) => ({ ...prev, [newRow.id]: false }));
        }
        if (eventType === "UPDATE") {
          if (newRow.status === "PUBLISHED") {
            setResources((prev) => {
              const exists = prev.some((r) => r.id === newRow.id);
              return exists ? prev.map((r) => r.id === newRow.id ? newRow : r) : [newRow, ...prev];
            });
          } else {
            setResources((prev) => prev.filter((r) => r.id !== newRow.id));
          }
        }
        if (eventType === "DELETE") setResources((prev) => prev.filter((r) => r.id !== oldRow.id));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const availableTypes  = useMemo(() => Array.from(new Set(resources.map((r) => r.type?.toUpperCase()).filter(Boolean))), [resources]);
  const filtered        = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      const topicTitle = TOPICS.find((t) => t.id === r.category)?.title ?? "";
      return (!q || r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || topicTitle.toLowerCase().includes(q))
        && (selectedTypes.size === 0 || selectedTypes.has(r.type?.toUpperCase()))
        && (selectedTopics.size === 0 || selectedTopics.has(r.category));
    });
  }, [resources, query, selectedTypes, selectedTopics]);

  const bookmarkedFiltered = filtered.filter((r) => bookmarks[r.id]);
  const displayList        = tab === "LIBRARY" ? filtered : bookmarkedFiltered;
  const bookmarkCount      = Object.values(bookmarks).filter(Boolean).length;
  const activeResource     = useMemo(() => resources.find((r) => r.id === activeId) ?? null, [resources, activeId]);
  const activeMeta         = activeResource ? getTypeMeta(activeResource.type) : null;
  const hasActiveFilters   = query || selectedTypes.size > 0 || selectedTopics.size > 0;

  function toggleType(t: string) { setSelectedTypes((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; }); }
  function toggleTopic(id: string) { setSelectedTopics((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function clearAll() { setQuery(""); setSelectedTypes(new Set()); setSelectedTopics(new Set()); }

  async function onToggleBookmark(id: string) {
    const was = bookmarks[id];
    const resource = resources.find((r) => r.id === id);
    setBookmarks((p) => ({ ...p, [id]: !p[id] }));
    if (resource) {
      const next = resource.bookmark_count + (was ? -1 : 1);
      await supabase.from("ei_resources").update({ bookmark_count: next }).eq("id", id);
      setResources((prev) => prev.map((r) => r.id === id ? { ...r, bookmark_count: next } : r));
    }
    if (!was) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) fetch("/api/gamification/award-xp", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ activityKey: "bookmark_resource" }),
      }).catch(() => {});
    }
  }

  async function openReader(id: string) {
    setShowSummary(false); setShowCheckup(false); setActiveId(id);
    const resource = resources.find((r) => r.id === id);
    setMode(resource?.type?.toUpperCase() === "WORKSHEET" ? "WORKSHEET" : "READ");
    if (resource) {
      const next = resource.view_count + 1;
      await supabase.from("ei_resources").update({ view_count: next }).eq("id", id);
      setResources((prev) => prev.map((r) => r.id === id ? { ...r, view_count: next } : r));
    }
  }

  function closeReader() { setMode("LIST"); setActiveId(null); setShowSummary(false); setShowCheckup(false); }
  function handleFinishRating() {
    const r = activeId ? ratings[activeId] ?? 0 : 0;
    if (!activeId || r < 1) return;
    setShowCheckup(true);
  }
  function handleWorksheetFinish() { setMode("READ"); }

  async function handleCheckupComplete() {
    setShowCheckup(false); setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 3000);
    closeReader();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) fetch("/api/gamification/award-xp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ activityKey: "read_ei_resource" }),
    }).catch(() => {});
  }

  return (
    <div className="mx-auto w-full max-w-6xl">

      {/* Knowledge Checkup Modal */}
      <AnimatePresence>
        {showCheckup && activeResource && (
          <KnowledgeCheckup resource={activeResource} onComplete={handleCheckupComplete}
            onClose={() => { setShowCheckup(false); closeReader(); }} />
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className={`rounded-3xl p-6 text-white shadow-lg ${BRAND_BG}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <BookOpenText size={20} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-white/60 uppercase tracking-widest">Learning Hub</div>
              <div className="text-2xl font-black tracking-tight">Resources</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={fetchResources} disabled={loading}
              className="grid h-9 w-9 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
            <Link href="/learning-hub/assessment"
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white hover:bg-white/20 transition">
              ← Assessment
            </Link>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-1">
          <TabBtn active={tab === "LIBRARY"}  label="Library"                        onClick={() => setTab("LIBRARY")}  />
          <TabBtn active={tab === "BOOKMARK"} label={`Bookmarks (${bookmarkCount})`} onClick={() => setTab("BOOKMARK")} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <Search className="shrink-0 text-slate-400" size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resources..."
              className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none" />
            {query && <button type="button" onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 transition"><X size={15} /></button>}
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearAll}
              className="rounded-2xl bg-white/20 px-4 py-3 text-xs font-extrabold text-white hover:bg-white/30 transition">Clear</button>
          )}
        </div>

        {availableTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/50"><Filter size={12} /> Filter</span>
            {availableTypes.map((t) => {
              const m = getTypeMeta(t);
              return <FilterChip key={t} label={m.label} icon={m.icon} active={selectedTypes.has(t)} onClick={() => toggleType(t)} />;
            })}
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="mt-6">
        <AnimatePresence mode="wait">

          {/* LIST */}
          {mode === "LIST" && (
            <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.25 }} className="space-y-6">
              <AnimatePresence>
                {justCompleted && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                    <Trophy size={17} className="text-emerald-500" /> Resource completed! XP earned. Great work! 🎉
                  </motion.div>
                )}
              </AnimatePresence>

              {fetchError && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  <span>⚠ {fetchError}</span>
                  <button type="button" onClick={fetchResources} className="text-xs font-extrabold underline">Retry</button>
                </div>
              )}

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-extrabold text-slate-900">Browse by Topic</div>
                  {selectedTopics.size > 0 && (
                    <button type="button" onClick={() => setSelectedTopics(new Set())}
                      className="text-xs font-bold text-slate-400 hover:text-slate-700 transition">Clear</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  {TOPICS.map((t, i) => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <TopicChip active={selectedTopics.has(t.id)} label={t.title} icon={t.icon} onClick={() => toggleTopic(t.id)} />
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-lg font-extrabold text-slate-900">{tab === "LIBRARY" ? "All Resources" : "Saved Resources"}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {loading ? "Loading…" : `${displayList.length} item${displayList.length !== 1 ? "s" : ""} · hover a card to flip it`}
                </div>
              </div>

              {loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              )}

              {!loading && displayList.length === 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
                    {tab === "BOOKMARK" ? <Bookmark size={22} className="text-slate-400" /> : <BookOpenText size={22} className="text-slate-400" />}
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {tab === "BOOKMARK" ? "No bookmarks yet" : resources.length === 0 ? "No published resources yet" : "Nothing matches your filters"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {tab === "BOOKMARK" ? "Flip a card and tap the bookmark to save it here."
                      : resources.length === 0 ? "Your admin hasn't published any resources yet."
                      : "Try a different search, type or topic filter."}
                  </div>
                  {tab === "BOOKMARK" && (
                    <button type="button" onClick={() => setTab("LIBRARY")}
                      className={`mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 transition ${BRAND_BG}`}>
                      <BookOpenText size={16} /> Browse Library
                    </button>
                  )}
                  {tab === "LIBRARY" && hasActiveFilters && (
                    <button type="button" onClick={clearAll}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
                      <X size={14} /> Clear filters
                    </button>
                  )}
                </div>
              )}

              {!loading && displayList.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {displayList.map((r, i) => (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <FlipCard resource={r} bookmarked={!!bookmarks[r.id]} onBookmark={() => onToggleBookmark(r.id)} onRead={() => openReader(r.id)} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* WORKSHEET GAME */}
          {mode === "WORKSHEET" && activeResource && (
            <motion.div key="worksheet" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className={`h-1.5 w-full bg-gradient-to-r ${UNIFIED.bar}`} />
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <button type="button" onClick={closeReader}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
                    <ArrowLeft size={15} /> Back
                  </button>
                  <div className="flex items-center gap-2">
                    <div className={`grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br ${UNIFIED.bar}`}>
                      <Sparkles size={13} className="text-white" />
                    </div>
                    <div className="text-sm font-extrabold text-slate-900">{activeResource.title}</div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 mb-5">
                  <Brain size={12} /> AI-Generated Scenario · Powered by Groq
                </div>
                <WorksheetGame resource={activeResource} onFinish={handleWorksheetFinish} />
              </div>
            </motion.div>
          )}

          {/* READER */}
          {mode === "READ" && activeResource && (
            <motion.div key="read" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className={`h-1.5 w-full bg-gradient-to-r ${UNIFIED.bar}`} />
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <button type="button" onClick={closeReader}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
                    <ArrowLeft size={15} /> Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowSummary((v) => !v)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold transition ${showSummary ? "border-cyan-300 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      <Brain size={15} /> {showSummary ? "Hide Summary" : "AI Summary"}
                    </button>
                    <button type="button" onClick={() => onToggleBookmark(activeResource.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold transition ${bookmarks[activeResource.id] ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      <Bookmark size={15} fill={bookmarks[activeResource.id] ? "currentColor" : "none"} />
                      {bookmarks[activeResource.id] ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-3">{activeResource.title}</h1>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {activeMeta && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${UNIFIED.pill}`}>
                      {activeMeta.icon} {activeMeta.label}
                    </span>
                  )}
                  {(() => { const t = TOPICS.find((t) => t.id === activeResource.category); return t ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{t.icon} {t.title}</span>
                  ) : null; })()}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    <BookOpenText size={12} /> {activeResource.view_count} views
                  </span>
                </div>

                {activeResource.description && (
                  <p className="text-sm text-slate-500 italic border-l-4 border-cyan-200 pl-4 mb-5 leading-relaxed">{activeResource.description}</p>
                )}

                <AnimatePresence>
                  {showSummary && <AISummaryPanel resource={activeResource} onClose={() => setShowSummary(false)} />}
                </AnimatePresence>

                {activeResource.resource_url && (
                  <a href={activeResource.resource_url} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold text-white mb-5 hover:opacity-90 transition ${BRAND_BG}`}>
                    <Link2 size={15} /> {activeResource.type === "VIDEO" ? "Watch Video" : "Read Full Article"} →
                  </a>
                )}

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700 whitespace-pre-line mb-6 min-h-20">
                  {activeResource.content || <span className="text-slate-400 italic">No additional content for this resource.</span>}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-extrabold text-slate-900 mb-0.5">Rate this content</div>
                  <div className="text-xs text-slate-500 mb-4">Pick 1–5 stars, then click Finish. A quick AI knowledge check will follow!</div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <StarRating
                      value={activeId ? ratings[activeId] ?? 0 : 0}
                      onChange={(v) => { if (activeId) setRatings((p) => ({ ...p, [activeId]: v })); }}
                    />
                    <button type="button" onClick={handleFinishRating}
                      disabled={!activeId || (ratings[activeId] ?? 0) < 1}
                      className={["inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-extrabold text-white transition",
                        !activeId || (ratings[activeId] ?? 0) < 1 ? "bg-slate-200 text-slate-400 cursor-not-allowed" : `${BRAND_BG} hover:opacity-90 shadow-sm`].join(" ")}>
                      <Brain size={16} /> Finish & Knowledge Check
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}