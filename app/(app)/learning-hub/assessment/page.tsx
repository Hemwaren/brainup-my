"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";

type Pillar = "KNOW_YOURSELF" | "CHOOSE_YOURSELF" | "GIVE_YOURSELF";

type Likert = 1 | 2 | 3 | 4 | 5;

type Question = {
  id: string;
  pillar: Pillar;
  skill: string; // within pillar
  text: string;
  reverse?: boolean; // reverse scoring for balance
};

type ResultSkill = {
  pillar: Pillar;
  skill: string;
  scorePct: number; // 0-100
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function scoreToPct(avgLikert: number) {
  // Likert 1..5 -> 0..100 (simple mapping)
  const pct = ((avgLikert - 1) / 4) * 100;
  return clamp(Math.round(pct), 0, 100);
}

function labelPillar(p: Pillar) {
  if (p === "KNOW_YOURSELF") return "Know Yourself";
  if (p === "CHOOSE_YOURSELF") return "Choose Yourself";
  return "Give Yourself";
}

function pillarDesc(p: Pillar) {
  if (p === "KNOW_YOURSELF")
    return "Awareness of emotions, triggers, and patterns.";
  if (p === "CHOOSE_YOURSELF")
    return "Managing reactions, motivation, and decisions.";
  return "Empathy, trust, and positive impact on others.";
}

function levelFromScore(overallPct: number) {
  if (overallPct >= 80) return { label: "Excellent", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (overallPct >= 65) return { label: "Strong", tone: "text-sky-700 bg-sky-50 border-sky-200" };
  if (overallPct >= 45) return { label: "Developing", tone: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Needs Attention", tone: "text-rose-700 bg-rose-50 border-rose-200" };
}

function bandLabel(pct: number) {
  if (pct >= 75) return "High";
  if (pct >= 50) return "Medium";
  return "Low";
}

function reverseLikert(v: Likert): Likert {
  // 1<->5, 2<->4, 3->3
  return (6 - v) as Likert;
}

const QUESTIONS: Question[] = [
  // KNOW YOURSELF (7)
  { id: "q1", pillar: "KNOW_YOURSELF", skill: "Emotional Awareness", text: "I can clearly name what I’m feeling in the moment." },
  { id: "q2", pillar: "KNOW_YOURSELF", skill: "Emotional Awareness", text: "I notice emotional changes in my body (e.g., tension, breathing) before I react." },
  { id: "q3", pillar: "KNOW_YOURSELF", skill: "Triggers & Patterns", text: "I know what situations or people tend to trigger my stress." },
  { id: "q4", pillar: "KNOW_YOURSELF", skill: "Triggers & Patterns", text: "I can spot repeating emotional patterns in my behavior over time." },
  { id: "q5", pillar: "KNOW_YOURSELF", skill: "Self-Understanding", text: "I understand why I feel the way I feel, not just what I feel." },
  { id: "q6", pillar: "KNOW_YOURSELF", skill: "Self-Understanding", text: "When I’m upset, I can usually identify the real cause." },
  { id: "q7", pillar: "KNOW_YOURSELF", skill: "Confidence & Clarity", text: "I often feel confused about my emotions.", reverse: true },

  // CHOOSE YOURSELF (7)
  { id: "q8", pillar: "CHOOSE_YOURSELF", skill: "Emotional Control", text: "When things go wrong, I can pause before reacting." },
  { id: "q9", pillar: "CHOOSE_YOURSELF", skill: "Emotional Control", text: "I can stay calm during disagreements." },
  { id: "q10", pillar: "CHOOSE_YOURSELF", skill: "Stress Handling", text: "Stress quickly overwhelms me.", reverse: true },
  { id: "q11", pillar: "CHOOSE_YOURSELF", skill: "Stress Handling", text: "Even under pressure, I can still think clearly." },
  { id: "q12", pillar: "CHOOSE_YOURSELF", skill: "Motivation", text: "I stay motivated even when progress feels slow." },
  { id: "q13", pillar: "CHOOSE_YOURSELF", skill: "Decision-Making", text: "I make better decisions when I consider both facts and feelings." },
  { id: "q14", pillar: "CHOOSE_YOURSELF", skill: "Optimism", text: "I tend to assume things will go badly.", reverse: true },

  // GIVE YOURSELF (6)
  { id: "q15", pillar: "GIVE_YOURSELF", skill: "Empathy", text: "I can usually sense how others feel, even if they don’t say it." },
  { id: "q16", pillar: "GIVE_YOURSELF", skill: "Empathy", text: "I consider others’ feelings before I speak or act." },
  { id: "q17", pillar: "GIVE_YOURSELF", skill: "Trust & Relationships", text: "People often feel comfortable opening up to me." },
  { id: "q18", pillar: "GIVE_YOURSELF", skill: "Trust & Relationships", text: "I struggle to see things from another person’s perspective.", reverse: true },
  { id: "q19", pillar: "GIVE_YOURSELF", skill: "Purpose & Impact", text: "I care about contributing positively to the people around me." },
  { id: "q20", pillar: "GIVE_YOURSELF", skill: "Purpose & Impact", text: "My actions usually align with my values." },
];

const OPTIONS: { label: string; value: Likert }[] = [
  { label: "Strongly disagree", value: 1 },
  { label: "Disagree", value: 2 },
  { label: "Neutral", value: 3 },
  { label: "Agree", value: 4 },
  { label: "Strongly agree", value: 5 },
];

export default function AssessmentPage() {
  const router = useRouter();

  const [loadingUser, setLoadingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [step, setStep] = useState<"INTRO" | "TEST" | "RESULTS">("INTRO");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Likert>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadUser() {
      setLoadingUser(true);
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;

      if (error || !data?.user) {
        setLoadingUser(false);
        router.push("/auth");
        return;
      }

      setUserId(data.user.id);
      setLoadingUser(false);
    }
    loadUser();
    return () => {
      alive = false;
    };
  }, [router]);

  const total = QUESTIONS.length;
  const current = QUESTIONS[idx];

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progressPct = useMemo(() => {
    if (total === 0) return 0;
    return clamp(Math.round((answeredCount / total) * 100), 0, 100);
  }, [answeredCount, total]);

  const canNext = !!answers[current?.id];

  function start() {
    setStep("TEST");
    setIdx(0);
    setSaveMsg(null);
  }

  function setAnswer(qid: string, v: Likert) {
    setAnswers((prev) => ({ ...prev, [qid]: v }));
  }

  function next() {
    if (idx < total - 1) setIdx((v) => v + 1);
    else setStep("RESULTS");
  }

  function back() {
    if (idx > 0) setIdx((v) => v - 1);
  }

  function restart() {
    setAnswers({});
    setIdx(0);
    setStep("INTRO");
    setSaveMsg(null);
  }

  const computed = useMemo(() => {
    // collect scored answers
    const scored = QUESTIONS.map((q) => {
      const raw = answers[q.id];
      if (!raw) return null;
      const v = q.reverse ? reverseLikert(raw) : raw;
      return { ...q, value: v };
    }).filter(Boolean) as Array<Question & { value: Likert }>;

    // overall avg
    const overallAvg =
      scored.length === 0
        ? 0
        : scored.reduce((sum, s) => sum + s.value, 0) / scored.length;
    const overallPct = scoreToPct(overallAvg);

    // pillar avgs
    const pillars: Record<Pillar, number> = {
      KNOW_YOURSELF: 0,
      CHOOSE_YOURSELF: 0,
      GIVE_YOURSELF: 0,
    };
    const pillarCounts: Record<Pillar, number> = {
      KNOW_YOURSELF: 0,
      CHOOSE_YOURSELF: 0,
      GIVE_YOURSELF: 0,
    };

    for (const s of scored) {
      pillars[s.pillar] += s.value;
      pillarCounts[s.pillar] += 1;
    }

    const pillarPct: Record<Pillar, number> = {
      KNOW_YOURSELF: pillarCounts.KNOW_YOURSELF
        ? scoreToPct(pillars.KNOW_YOURSELF / pillarCounts.KNOW_YOURSELF)
        : 0,
      CHOOSE_YOURSELF: pillarCounts.CHOOSE_YOURSELF
        ? scoreToPct(pillars.CHOOSE_YOURSELF / pillarCounts.CHOOSE_YOURSELF)
        : 0,
      GIVE_YOURSELF: pillarCounts.GIVE_YOURSELF
        ? scoreToPct(pillars.GIVE_YOURSELF / pillarCounts.GIVE_YOURSELF)
        : 0,
    };

    // skill avgs
    const skillMap = new Map<string, { pillar: Pillar; sum: number; count: number }>();
    for (const s of scored) {
      const key = `${s.pillar}__${s.skill}`;
      const prev = skillMap.get(key) ?? { pillar: s.pillar, sum: 0, count: 0 };
      skillMap.set(key, { pillar: s.pillar, sum: prev.sum + s.value, count: prev.count + 1 });
    }

    const skills: ResultSkill[] = Array.from(skillMap.entries()).map(([key, v]) => {
      const skill = key.split("__")[1] ?? "Skill";
      const avg = v.count ? v.sum / v.count : 0;
      return { pillar: v.pillar, skill, scorePct: scoreToPct(avg) };
    });

    skills.sort((a, b) => b.scorePct - a.scorePct);

    const top2 = skills.slice(0, 2);
    const bottom2 = [...skills].reverse().slice(0, 2);

    const lvl = levelFromScore(overallPct);

    return { overallPct, pillarPct, skills, top2, bottom2, level: lvl };
  }, [answers]);

  async function saveResults() {
    if (!userId) return;
    setSaving(true);
    setSaveMsg(null);

    // best-effort insert (won't crash if table doesn't exist)
    try {
      await supabase.from("ei_assessment_results").insert({
        user_id: userId,
        overall_score: computed.overallPct,
        know_yourself: computed.pillarPct.KNOW_YOURSELF,
        choose_yourself: computed.pillarPct.CHOOSE_YOURSELF,
        give_yourself: computed.pillarPct.GIVE_YOURSELF,
        answers_json: answers,
        created_at: new Date().toISOString(),
      });
      setSaveMsg("Saved! Your results are stored.");
    } catch {
      setSaveMsg("Couldn’t save (table not set yet). Results still shown on screen.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#f7fbff]">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                <Brain size={18} />
              </div>
              <div className="text-base font-extrabold text-slate-900">BrainUp</div>
            </div>
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/2 bg-slate-700" />
            </div>
            <p className="mt-3 text-sm text-slate-600">Loading assessment…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7fbff]">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                <ClipboardList size={18} />
              </span>
              <h1 className="text-xl font-extrabold text-slate-900">EI Assessment</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              A short 20-question self-assessment based on 3 EI pillars: Know, Choose, Give.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/post-login")}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        {step === "INTRO" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white">
                <Sparkles size={18} />
              </div>
              <div className="flex-1">
                <div className="text-base font-extrabold text-slate-900">
                  Before you start
                </div>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  <li>• No right or wrong answers — respond honestly.</li>
                  <li>• Takes about 3–5 minutes.</li>
                  <li>• You’ll get an overall EI score + breakdown by pillars and skills.</li>
                </ul>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={start}
                    className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95"
                  >
                    Start Assessment
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/learning-hub/resources")}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                  >
                    View Resources
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === "TEST" && current && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Progress */}
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">
                Question {idx + 1} / {total}
              </div>
              <div className="text-xs font-bold text-slate-500">{progressPct}% completed</div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Pillar tag */}
            <div className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700">
              {labelPillar(current.pillar)} • {current.skill}
            </div>

            {/* Question */}
            <div className="mt-3 text-lg font-extrabold text-slate-900">{current.text}</div>
            <div className="mt-1 text-sm text-slate-600">
              Select the option that best describes you.
            </div>

            {/* Options */}
            <div className="mt-4 space-y-2">
              {OPTIONS.map((o) => {
                const selected = answers[current.id] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setAnswer(current.id, o.value)}
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition",
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="text-sm font-semibold">{o.label}</span>
                    <span
                      className={[
                        "grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold",
                        selected ? "bg-white text-slate-900" : "bg-slate-100 text-slate-700",
                      ].join(" ")}
                    >
                      {o.value}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Nav */}
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={back}
                disabled={idx === 0}
                className={[
                  "rounded-2xl border px-4 py-2 text-sm font-extrabold transition",
                  idx === 0
                    ? "border-slate-200 bg-slate-50 text-slate-400"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                ].join(" ")}
              >
                Back
              </button>

              <button
                type="button"
                onClick={next}
                disabled={!canNext}
                className={[
                  "inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-sm font-extrabold transition",
                  canNext ? "bg-slate-900 text-white hover:opacity-95" : "bg-slate-200 text-slate-500",
                ].join(" ")}
              >
                {idx < total - 1 ? "Next" : "Finish"}
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {step === "RESULTS" && (
          <section className="space-y-4">
            {/* Overall summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold text-slate-900">Your Results</div>
                  <div className="mt-1 text-sm text-slate-600">
                    This is a self-assessment snapshot — skills can improve with practice.
                  </div>
                </div>

                <div className={["inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold", computed.level.tone].join(" ")}>
                  <CheckCircle2 size={14} />
                  {computed.level.label}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <ScoreCard title="Overall EI Score" value={`${computed.overallPct}%`} hint={bandLabel(computed.overallPct)} />
                <ScoreCard title="Know Yourself" value={`${computed.pillarPct.KNOW_YOURSELF}%`} hint={bandLabel(computed.pillarPct.KNOW_YOURSELF)} />
                <ScoreCard title="Choose Yourself" value={`${computed.pillarPct.CHOOSE_YOURSELF}%`} hint={bandLabel(computed.pillarPct.CHOOSE_YOURSELF)} />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <ScoreCard title="Give Yourself" value={`${computed.pillarPct.GIVE_YOURSELF}%`} hint={bandLabel(computed.pillarPct.GIVE_YOURSELF)} />
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">Interpretation</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Your strongest growth comes from building habits in your lowest skills.
                    Aim for small daily improvements (5–10 minutes) for 2 weeks.
                  </div>
                </div>
              </div>
            </div>

            {/* Pillars chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-base font-extrabold text-slate-900">Pillars Breakdown</div>
              <div className="mt-1 text-sm text-slate-600">
                Know → awareness • Choose → regulation • Give → empathy & impact
              </div>

              <div className="mt-4 space-y-3">
                <BarRow label="Know Yourself" desc={pillarDesc("KNOW_YOURSELF")} pct={computed.pillarPct.KNOW_YOURSELF} />
                <BarRow label="Choose Yourself" desc={pillarDesc("CHOOSE_YOURSELF")} pct={computed.pillarPct.CHOOSE_YOURSELF} />
                <BarRow label="Give Yourself" desc={pillarDesc("GIVE_YOURSELF")} pct={computed.pillarPct.GIVE_YOURSELF} />
              </div>
            </div>

            {/* Skills */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-base font-extrabold text-slate-900">Skill Breakdown</div>
              <div className="mt-1 text-sm text-slate-600">
                These are smaller skills inside the 3 pillars.
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {computed.skills.map((s) => (
                  <SkillCard
                    key={`${s.pillar}-${s.skill}`}
                    pillar={labelPillar(s.pillar)}
                    skill={s.skill}
                    pct={s.scorePct}
                  />
                ))}
              </div>
            </div>

            {/* Strengths + Growth */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-base font-extrabold text-slate-900">Your Strengths</div>
                <div className="mt-1 text-sm text-slate-600">
                  Skills you can leverage immediately.
                </div>
                <div className="mt-4 space-y-3">
                  {computed.top2.map((s) => (
                    <MiniSkill key={`top-${s.pillar}-${s.skill}`} title={s.skill} pct={s.scorePct} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-base font-extrabold text-slate-900">Growth Areas</div>
                <div className="mt-1 text-sm text-slate-600">
                  Focus here for the biggest improvement.
                </div>
                <div className="mt-4 space-y-3">
                  {computed.bottom2.map((s) => (
                    <MiniSkill key={`bot-${s.pillar}-${s.skill}`} title={s.skill} pct={s.scorePct} />
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={saveResults}
                  disabled={saving}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-extrabold transition",
                    saving ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:opacity-95",
                  ].join(" ")}
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Results"}
                </button>

                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                >
                  <RotateCcw size={16} />
                  Retake
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/learning-hub/resources")}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                >
                  Go to Resources
                </button>
              </div>

              {saveMsg && <div className="mt-3 text-sm text-slate-600">{saveMsg}</div>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-bold text-slate-500">{hint}</div>
    </div>
  );
}

function BarRow({ label, desc, pct }: { label: string; desc: string; pct: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-slate-900">{label}</div>
          <div className="mt-1 text-sm text-slate-600">{desc}</div>
        </div>
        <div className="text-sm font-extrabold text-slate-900">{pct}%</div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SkillCard({
  pillar,
  skill,
  pct,
}: {
  pillar: string;
  skill: string;
  pct: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-bold text-slate-500">{pillar}</div>
      <div className="mt-1 text-sm font-extrabold text-slate-900">{skill}</div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-500">{bandLabel(pct)}</span>
        <span className="font-extrabold text-slate-900">{pct}%</span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MiniSkill({ title, pct }: { title: string; pct: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <div className="text-sm font-extrabold text-slate-900">{pct}%</div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 text-xs font-bold text-slate-500">{bandLabel(pct)}</div>
    </div>
  );
}