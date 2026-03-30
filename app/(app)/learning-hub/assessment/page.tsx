"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft, Brain, ChevronRight, ClipboardList,
  Sparkles, RotateCcw, Info,
} from "lucide-react";

const QUESTIONS = [
  { id: 1,  dim: "EA",  text: "I am aware of my personal feelings when meeting someone." },
  { id: 2,  dim: "EU",  text: "I always evaluate the importance of work and events to myself." },
  { id: 3,  dim: "EUS", text: "I know when to share my own problems with others." },
  { id: 4,  dim: "EC",  text: "I know how to maintain positive emotions." },
  { id: 5,  dim: "EA",  text: "I know the content I want to convey to others when working in a team." },
  { id: 6,  dim: "EU",  text: "My ability to come up with new ideas is affected by my mood." },
  { id: 7,  dim: "EUS", text: "When communicating, I know how to arrange content so listeners feel comfortable." },
  { id: 8,  dim: "EC",  text: "I always create positive motivation when taking on a job." },
  { id: 9,  dim: "EA",  text: "I can feel and capture the emotions of other team members." },
  { id: 10, dim: "EU",  text: "My problem-solving ability is affected by mood." },
  { id: 11, dim: "EUS", text: "When I need to express myself, I always know how to make an impression." },
  { id: 12, dim: "EC",  text: "I always control my emotions in every situation." },
  { id: 13, dim: "EA",  text: "When my emotions change at work, I know clearly why." },
  { id: 14, dim: "EU",  text: "My responsibilities and enthusiasm for work are influenced by mood." },
  { id: 15, dim: "EUS", text: "I empathize with the stories others share with me." },
  { id: 16, dim: "EA",  text: "I feel the evaluation through hidden meanings of group members." },
  { id: 17, dim: "EU",  text: "Emotions are one of the most meaningful things in my life." },
  { id: 18, dim: "EUS", text: "I always believe in myself to do a good job." },
];

const DIM_META: Record<string, { icon: string; label: string; color: string; accent: string }> = {
  EA:  { icon: "😤", label: "Emotional Awareness",     color: "#0891b2", accent: "#ecfeff" },
  EU:  { icon: "🔥", label: "Emotion Usage",           color: "#0d9488", accent: "#f0fdfa" },
  EUS: { icon: "❤️", label: "Emotional Understanding", color: "#0e7490", accent: "#cffafe" },
  EC:  { icon: "🧭", label: "Emotional Controlling",   color: "#14b8a6", accent: "#ccfbf1" },
};

const OPTIONS = [
  { label: "Strongly Disagree", short: "Strongly\nDisagree", value: 1, img: "/emotions/veryunpleasant.png" },
  { label: "Disagree",          short: "Disagree",           value: 2, img: "/emotions/unpleasant.png"     },
  { label: "Neutral",           short: "Neutral",            value: 3, img: "/emotions/neutral.png"        },
  { label: "Agree",             short: "Agree",              value: 4, img: "/emotions/pleasant.png"       },
  { label: "Strongly Agree",    short: "Strongly\nAgree",    value: 5, img: "/emotions/verypleasant.png"   },
];

const BRAIN_STYLE_DESC: Record<string, {
  emoji: string; traits: string; desc: string; color: string; tips: string[];
}> = {
  Sage:      { emoji: "🧙",  color: "#7c3aed", traits: "Wise · Empathetic · Thoughtful",     desc: "You process emotions deeply and guide others with wisdom.",                    tips: ["Dedicate 10 minutes daily to reflective journaling on emotional patterns.", "Offer structured mentorship to colleagues navigating difficult interpersonal situations.", "Share emotional insights during team retrospectives to elevate group self-awareness."] },
  Energizer: { emoji: "⚡",  color: "#d97706", traits: "Dynamic · Creative · Practical",     desc: "You use emotions to fuel action and inspire those around you.",                tips: ["Channel high-energy states into focused creative sprints with deliberate time-boxing.", "Develop a personal pause protocol for high-tension moments before you respond.", "Use your natural enthusiasm deliberately to re-engage disengaged teammates."] },
  Guardian:  { emoji: "🛡️", color: "#059669", traits: "Loyal · Caring · Stable",            desc: "You protect team harmony and provide emotional stability.",                     tips: ["Establish clear personal boundaries to sustain your caregiving capacity long-term.", "Practice articulating your own needs directly rather than accommodating by default.", "Facilitate structured team check-ins to build consistent psychological safety."] },
  Visionary: { emoji: "🔭",  color: "#7c3aed", traits: "Passionate · Transformative · Bold", desc: "You channel emotions into big ideas and long-term change.",                    tips: ["Translate bold emotional visions into concrete 30-day milestones with accountability.", "Lead with active listening before pivoting to solutions in team conversations.", "Document emotional momentum from wins to sustain energy during long-horizon projects."] },
  Deliverer: { emoji: "🎯",  color: "#0891b2", traits: "Focused · Reliable · Efficient",     desc: "You use logic and emotion to consistently deliver results.",                    tips: ["Build deliberate space for emotional processing alongside task completion rituals.", "Verbally acknowledge team emotional states during high-pressure delivery cycles.", "Shift recognition from output metrics to effort and resilience to deepen trust."] },
  Strategist:{ emoji: "♟️",  color: "#1d4ed8", traits: "Precise · Careful · Future-focused", desc: "You plan with both heart and mind to achieve lasting goals.",                  tips: ["Integrate emotional intuition checkpoints alongside your analytical decision frameworks.", "Invest time in rapport-building before launching into strategy or planning sessions.", "Practise structured vulnerability sharing to accelerate deep team trust."] },
  Inventor:  { emoji: "💡",  color: "#b45309", traits: "Curious · Analytical · Creative",    desc: "You combine logic with imagination to create new solutions.",                  tips: ["Use emotional signals as qualitative data inputs alongside quantitative research.", "Conduct brief empathy interviews with users or teammates before prototyping solutions.", "Solicit emotional reactions to your ideas early and integrate them as design criteria."] },
  Scientist: { emoji: "🔬",  color: "#0f766e", traits: "Methodical · Objective · Sharp",     desc: "You analyse emotions with precision to optimise performance.",                 tips: ["Maintain a weekly emotional pattern log to surface trends across different contexts.", "Translate your emotional analysis into plain, accessible language for broader audiences.", "Add emotional context and narrative when presenting data-driven findings to stakeholders."] },
};

// ── Animated counter ──────────────────────────────────────────────
function AnimatedNumber({ target, duration = 1600 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{display.toFixed(1)}</>;
}

// ── Radar / Spider chart ──────────────────────────────────────────
function RadarChart({ scores }: { scores: { label: string; value: number; color: string; icon: string }[] }) {
  const size = 200;
  const cx = size / 2, cy = size / 2, r = 70;
  const n = scores.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, radius: number) => ({ x: cx + radius * Math.cos(angle(i)), y: cy + radius * Math.sin(angle(i)) });
  const dataPoints = scores.map((s, i) => pt(i, (s.value / 100) * r));
  const polyline   = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[190px] mx-auto">
      {[0.25, 0.5, 0.75, 1].map(ring => (
        <polygon key={ring}
          points={scores.map((_, i) => { const p = pt(i, r * ring); return `${p.x},${p.y}`; }).join(" ")}
          fill={ring === 1 ? "rgba(6,182,212,0.04)" : "none"}
          stroke={ring === 1 ? "#06b6d4" : "#e2e8f0"}
          strokeWidth={ring === 1 ? "1.5" : "1"}
          strokeDasharray={ring < 1 ? "3,3" : undefined}
        />
      ))}
      {scores.map((_, i) => { const end = pt(i, r); return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#e2e8f0" strokeWidth="1" />; })}
      <polygon points={polyline} fill="rgba(6,182,212,0.1)" stroke="#06b6d4" strokeWidth="2" strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="white" stroke={scores[i].color} strokeWidth="2.5" />
      ))}
      {scores.map((s, i) => {
        const lp = pt(i, r + 18);
        return <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#64748b">{s.icon}</text>;
      })}
    </svg>
  );
}

// ── Score Bar ─────────────────────────────────────────────────────
function ScoreBar({ label, score, color, delay = 0 }: { label: string; score: number; color: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(score), 400 + delay);
    return () => clearTimeout(t);
  }, [score, delay]);
  const grade = score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Moderate" : "Developing";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: color + "14", color }}>{grade}</span>
          <span className="text-xs font-bold tabular-nums" style={{ color }}>{score.toFixed(1)}</span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all duration-[1100ms]"
          style={{ width: `${w}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
    </div>
  );
}

// ── InfoTooltip — calls /api/assessment/scenario (server-side proxy) ──
function InfoTooltip({ question, selectedValue }: { question: string; selectedValue: number | null }) {
  const [open, setOpen]         = useState(false);
  const [scenario, setScenario] = useState("");
  const [loading, setLoading]   = useState(false);
  const fetchedKeyRef           = useRef<string>("");
  const tooltipRef              = useRef<HTMLDivElement>(null);
  const abortRef                = useRef<AbortController | null>(null);

  const currentOpt = OPTIONS.find(o => o.value === (selectedValue ?? 3));

  // ── Calls our own Next.js API route (no CORS issues, key stays server-side) ──
  const doFetch = useCallback(async (q: string, val: number) => {
    const key = `${q}|||${val}`;
    if (fetchedKeyRef.current === key) return; // already cached for this combo

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setScenario("");

    try {
      const opt = OPTIONS.find(o => o.value === val);
      const res = await fetch("/api/assessment/scenario", {
        method: "POST",
        signal: abortRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          answerLabel: opt?.label ?? "Neutral",
          answerValue: val,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Scenario API error:", errData);
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      setScenario(data.scenario || "Could not generate a scenario.");
      fetchedKeyRef.current = key;
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setScenario("⚠️ Could not load scenario. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever tooltip opens or the selected answer changes
  useEffect(() => {
    if (!open) return;
    const val = selectedValue ?? 3;
    const timer = setTimeout(() => doFetch(question, val), 280);
    return () => clearTimeout(timer);
  }, [open, question, selectedValue, doFetch]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    if (!open) {
      fetchedKeyRef.current = ""; // force fresh fetch on every open
      setScenario("");
    }
    setOpen(v => !v);
  };

  return (
    <div ref={tooltipRef} className="relative inline-flex shrink-0" style={{ zIndex: 9999 }}>
      <button
        onClick={handleToggle}
        className={`rounded-full p-1.5 transition-all duration-150 ${open ? "bg-cyan-50 text-cyan-600" : "text-slate-300 hover:text-cyan-400 hover:bg-cyan-50"}`}
        aria-label="Show example scenario"
      >
        <Info size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 w-[500px] rounded-2xl border border-slate-200 bg-white"
          style={{
            bottom: "calc(100% + 10px)",
            zIndex: 9999,
            boxShadow: "0 16px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(6,182,212,0.08)",
            animation: "tooltipPop 0.18s cubic-bezier(0.34,1.4,0.64,1)",
          }}
        >
          {/* Arrow */}
          <div className="absolute -top-[5px] right-3.5 w-2.5 h-2.5 bg-white border-t border-l border-slate-200 rotate-45" />

          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-3 border-b border-slate-100">
            {currentOpt && (
              <img src={currentOpt.img} alt={currentOpt.label} className="w-7 h-7 object-contain"
                style={{ animation: "wiggle 0.5s ease" }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-bold text-cyan-700 uppercase tracking-wide truncate">
                {selectedValue ? currentOpt?.label : "Select a response"}
              </p>
              <p className="text-[9.5px] text-slate-400">AI-generated scenario</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition text-xs shrink-0">
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3.5">
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 max-h-[80px] overflow-y-auto flex items-start">
              {loading ? (
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: `${i * 0.14}s` }} />
                  ))}
                  <span className="text-[11px] text-slate-400 ml-1">Generating…</span>
                </div>
              ) : scenario ? (
                <p className="text-[12.5px] text-slate-600 leading-relaxed">{scenario}</p>
              ) : (
                <p className="text-[12px] text-slate-400 italic text-center">
                  {selectedValue ? "Loading scenario…" : "Select an answer card to see a scenario"}
                </p>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Select a different card to update this scenario
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Emotion Option Card ───────────────────────────────────────────
function EmotionCard({ opt, isSelected, isHovered, onClick, onEnter, onLeave }: {
  opt: typeof OPTIONS[0]; isSelected: boolean; isHovered: boolean;
  onClick: () => void; onEnter: () => void; onLeave: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="relative flex flex-col items-center justify-end focus:outline-none select-none transition-all duration-200"
      style={{
        flex: isSelected ? "1.65" : "1",
        padding: isSelected ? "14px 10px 12px" : "10px 6px 10px",
        borderRadius: "14px",
        background: isSelected ? "linear-gradient(145deg, #ecfeff, #f0fdfa)" : isHovered ? "#f8fafc" : "#ffffff",
        border: isSelected ? "2px solid #06b6d4" : isHovered ? "2px solid #a5f3fc" : "2px solid #f1f5f9",
        boxShadow: isSelected ? "0 4px 14px rgba(6,182,212,0.18)" : isHovered ? "0 2px 6px rgba(6,182,212,0.08)" : "none",
        transform: isSelected ? "translateY(-3px)" : isHovered ? "translateY(-1px)" : "none",
      }}
      aria-pressed={isSelected}
    >
      {isSelected && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center text-white text-[9px] font-bold shadow-sm"
          style={{ animation: "popIn 0.18s cubic-bezier(0.34,1.5,0.64,1)" }}>
          ✓
        </span>
      )}
      <img src={opt.img} alt={opt.label} className="object-contain"
        style={{
          width: isSelected ? "50px" : isHovered ? "42px" : "36px",
          height: isSelected ? "50px" : isHovered ? "42px" : "36px",
          transition: "all 0.22s cubic-bezier(0.34,1.3,0.64,1)",
          animation: isSelected ? "liveFace 2.5s ease-in-out infinite" : isHovered ? "wiggle 0.4s ease" : "none",
        }}
      />
      <span className="mt-2 font-medium leading-tight text-center whitespace-pre-line"
        style={{ fontSize: isSelected ? "10px" : "9px", color: isSelected ? "#0e7490" : isHovered ? "#0891b2" : "#94a3b8" }}>
        {opt.short}
      </span>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function AssessmentPage() {
  const router = useRouter();
  const [token, setToken]               = useState<string | null>(null);
  const [step, setStep]                 = useState<"INTRO"|"PHASE1"|"ML_INTERSTITIAL"|"PHASE2"|"PROCESSING"|"RESULTS">("INTRO");
  const [idx, setIdx]                   = useState(0);
  const [answers, setAnswers]           = useState<Record<number, number>>({});
  const [mlPrediction, setMlPrediction] = useState<number | null>(null);
  const [results, setResults]           = useState<any>(null);
  const [loading, setLoading]           = useState(false);
  const [hoveredOpt, setHoveredOpt]     = useState<number | null>(null);
  const [cardKey, setCardKey]           = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/auth"); return; }
      setToken(session.access_token);
    });
  }, [router]);

  const current       = QUESTIONS[idx];
  const totalAnswered = Object.keys(answers).length;
  const progressPct   = Math.round((totalAnswered / 18) * 100);
  const dimMeta       = DIM_META[current?.dim ?? "EA"];
  const selectedVal   = answers[current?.id] ?? null;

  function selectAnswer(val: number) { setAnswers(prev => ({ ...prev, [current.id]: val })); }
  function navigateTo(newIdx: number) { setCardKey(k => k + 1); setHoveredOpt(null); setTimeout(() => setIdx(newIdx), 10); }
  function goBack() { if (idx > 0) navigateTo(idx - 1); }
  function goNext() {
    if (idx < 8)        navigateTo(idx + 1);
    else if (idx === 8) callMLPrediction();
    else if (idx < 17)  navigateTo(idx + 1);
    else                submitAssessment();
  }

  async function callMLPrediction() {
    setStep("ML_INTERSTITIAL"); setLoading(true);
    try {
      const first9 = Array.from({ length: 9 }, (_, i) => answers[i + 1] ?? 3);
      const res    = await fetch("/api/assessment/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: first9 }) });
      const data   = await res.json();
      setMlPrediction(data.predicted_ei ?? null);
    } catch { setMlPrediction(null); }
    setLoading(false);
  }

  async function submitAssessment() {
    setStep("PROCESSING");
    try {
      const all = Array.from({ length: 18 }, (_, i) => answers[i + 1] ?? 3);
      const res = await fetch("/api/assessment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ answers: all, ml_predicted_ei: mlPrediction }),
      });
      const data = await res.json();
      setResults(data);
      if (token) fetch("/api/gamification/award-xp", { method: "POST", headers: { "content-type": "application/json", "authorization": `Bearer ${token}` }, body: JSON.stringify({ activityKey: "full_ei_assessment" }) }).catch(() => {});
      setStep("RESULTS");
    } catch { setStep("RESULTS"); }
  }

  function restart() { setAnswers({}); setIdx(0); setMlPrediction(null); setResults(null); setStep("INTRO"); setCardKey(0); setHoveredOpt(null); }

  const keyframes = `
    @keyframes tooltipPop  { from{opacity:0;transform:scale(0.94) translateY(4px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes wiggle      { 0%,100%{transform:rotate(0deg) scale(1)} 25%{transform:rotate(-7deg) scale(1.07)} 75%{transform:rotate(7deg) scale(1.07)} }
    @keyframes liveFace    { 0%,100%{transform:translateY(0) rotate(0)} 35%{transform:translateY(-2.5px) rotate(-3deg)} 65%{transform:translateY(-1.5px) rotate(2.5deg)} }
    @keyframes popIn       { from{transform:scale(0) rotate(-10deg)} to{transform:scale(1) rotate(0)} }
    @keyframes slideUp     { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeSlide   { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
    @keyframes float       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes revealFade  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes countUp     { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
    @keyframes pulseRing   { 0%{box-shadow:0 0 0 0 rgba(6,182,212,0.35)} 70%{box-shadow:0 0 0 12px rgba(6,182,212,0)} 100%{box-shadow:0 0 0 0 rgba(6,182,212,0)} }
  `;

  // ── INTRO ──────────────────────────────────────────────────────
  if (step === "INTRO") return (
    <>
      <style>{keyframes}</style>
      <div className="max-w-xl mx-auto px-4 py-8" style={{ animation: "slideUp 0.4s ease" }}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg,#06b6d4,#0d9488)" }}>
              <ClipboardList size={15} className="text-white" />
            </div>
            <span className="text-base font-semibold text-slate-800">EI Assessment</span>
          </div>
          <button onClick={() => router.push("/post-login")} className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition font-medium">
            <ArrowLeft size={13} /> Back
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-7 pt-7 pb-6" style={{ background: "linear-gradient(135deg,#ecfeff 0%,#f0fdfa 50%,#e0f2fe 100%)" }}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0"
                style={{ width: 52, height: 52, background: "linear-gradient(135deg,#06b6d4,#0d9488)", boxShadow: "0 8px 20px rgba(6,182,212,0.3)" }}>
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Discover Your EI Profile</h1>
                <p className="text-xs text-slate-500 mt-0.5">BEIS validated psychometric framework</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[["18","Questions"],["4","Dimensions"],["~4 min","Duration"]].map(([v,l]) => (
                <div key={l} className="rounded-xl bg-white/70 border border-white/80 p-3 text-center">
                  <div className="text-sm font-bold text-cyan-700">{v}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-7 py-6">
            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Response Scale</p>
            <div className="flex items-end justify-between gap-1.5 mb-6">
              {OPTIONS.map(o => (
                <div key={o.value} className="flex flex-col items-center gap-1 flex-1">
                  <img src={o.img} alt={o.label} className="w-9 h-9 object-contain hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-medium text-slate-400 text-center leading-tight whitespace-pre-line">{o.short}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 mb-6">
              {[["🤖","ML-powered early prediction at question 9"],["💬","Personalised AI feedback per EI dimension"],["📊","Radar chart across all 4 EI dimensions"],["🧠","Brain Style profile determination"]].map(([icon,text]) => (
                <div key={text as string} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("PHASE1")}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: "linear-gradient(135deg,#06b6d4,#0d9488)", boxShadow: "0 4px 16px rgba(6,182,212,0.3)" }}>
              Begin Assessment <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // ── QUESTION ───────────────────────────────────────────────────
  if (step === "PHASE1" || step === "PHASE2") return (
    <>
      <style>{keyframes}</style>
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => router.push("/post-login")} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1 text-[10.5px] font-semibold">
            <span className={`rounded-full px-2.5 py-0.5 transition-all ${step==="PHASE1" ? "bg-cyan-50 text-cyan-700" : "text-slate-400"}`}>Phase 1</span>
            <span className="text-slate-300">›</span>
            <span className="text-slate-400 px-1">ML Scan</span>
            <span className="text-slate-300">›</span>
            <span className={`rounded-full px-2.5 py-0.5 transition-all ${step==="PHASE2" ? "bg-cyan-50 text-cyan-700" : "text-slate-400"}`}>Phase 2</span>
          </div>
          <span className="text-xs font-bold text-cyan-600 tabular-nums">{progressPct}%</span>
        </div>

        <div className="h-1 w-full rounded-full bg-slate-100 mb-5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#06b6d4,#0d9488)" }} />
        </div>

        <div key={cardKey} className="rounded-2xl bg-white shadow-sm"
  style={{ animation: "fadeSlide 0.25s ease", overflow: "visible", outline: "1px solid rgb(226 232 240 / 0.8)" }}>
          <div className="h-[3px] rounded-t-2xl -mx-px -mt-px" style={{ background: `linear-gradient(90deg,${dimMeta.color},#06b6d4)` }} />

          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: dimMeta.accent, color: dimMeta.color }}>
                {dimMeta.icon} {dimMeta.label}
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-bold text-slate-800 tabular-nums">{current.id}</span>
                <span className="text-xs text-slate-400 font-medium">/ 18</span>
              </div>
            </div>

            <div className="relative mb-7 pr-8">
              <p className="text-[17px] font-semibold text-slate-800 leading-snug">{current.text}</p>
              <div className="absolute top-0 right-0" style={{ zIndex: 9999 }}>
                <InfoTooltip question={current.text} selectedValue={selectedVal} />
              </div>
            </div>

            <div className="flex gap-1.5 mb-5">
              {OPTIONS.map(o => (
                <EmotionCard key={o.value} opt={o}
                  isSelected={selectedVal === o.value}
                  isHovered={hoveredOpt === o.value && selectedVal !== o.value}
                  onClick={() => selectAnswer(o.value)}
                  onEnter={() => setHoveredOpt(o.value)}
                  onLeave={() => setHoveredOpt(null)}
                />
              ))}
            </div>

            <div className="h-6 mb-4">
              {(selectedVal || hoveredOpt) && (() => {
                const active = OPTIONS.find(o => o.value === (hoveredOpt ?? selectedVal));
                return active ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gradient-to-r from-cyan-100 to-transparent" />
                    <span className="text-[11px] font-semibold text-cyan-600">
                      {hoveredOpt ? "Previewing" : "Selected"}: {active.label}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-l from-cyan-100 to-transparent" />
                  </div>
                ) : null;
              })()}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={goBack} disabled={idx === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition">
                <ArrowLeft size={13} /> Back
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: 18 }, (_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-300 ${i===idx ? "w-3.5 h-1.5 bg-cyan-500" : answers[i+1] ? "w-1.5 h-1.5 bg-teal-400" : "w-1.5 h-1.5 bg-slate-200"}`} />
                ))}
              </div>
              <button onClick={goNext} disabled={!selectedVal}
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-30 transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: "linear-gradient(135deg,#06b6d4,#0d9488)", boxShadow: "0 4px 12px rgba(6,182,212,0.28)" }}>
                {idx === 8 ? "ML Prediction 🤖" : idx === 17 ? "Finish ✓" : "Next"}
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // ── ML INTERSTITIAL ────────────────────────────────────────────
  if (step === "ML_INTERSTITIAL") return (
    <>
      <style>{keyframes}</style>
      <div className="max-w-xl mx-auto px-4 py-8" style={{ animation: "slideUp 0.4s ease" }}>
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-8 pt-8 pb-6 text-center" style={{ background: "linear-gradient(135deg,#ecfeff,#f0fdfa,#e0f2fe)" }}>
            <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ width:52, height:52, background:"linear-gradient(135deg,#06b6d4,#0d9488)", boxShadow:"0 8px 24px rgba(6,182,212,0.35)", animation: loading ? "none" : "pulseRing 2s infinite" }}>
              <Brain size={22} className="text-white" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-cyan-100 px-3 py-1 text-[11px] font-semibold text-cyan-700 mb-3">
              🤖 Early Prediction
            </span>
            <h2 className="text-xl font-bold text-slate-900 mb-1.5">Halfway There</h2>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Our Random Forest model (trained on 372 students) analysed your first 9 responses.
            </p>
          </div>

          <div className="px-8 py-7 text-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay:`${i*0.15}s` }} />)}
                </div>
                <p className="text-xs text-slate-400">Analysing your responses…</p>
              </div>
            ) : (
              <>
                <div className="inline-block rounded-2xl px-10 py-6 mb-4 border border-cyan-100"
                  style={{ background:"linear-gradient(135deg,#ecfeff,#f0fdfa)", animation:"float 3s ease-in-out infinite" }}>
                  <div className="text-[52px] font-bold tabular-nums leading-none mb-1"
                    style={{ background:"linear-gradient(135deg,#0891b2,#0d9488)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"countUp 0.5s ease" }}>
                    {mlPrediction !== null ? <AnimatedNumber target={mlPrediction} duration={1800} /> : "—"}
                  </div>
                  <div className="text-xs font-semibold text-cyan-600 mb-3">Predicted EI Score / 100</div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden w-36 mx-auto">
                    <div className="h-full rounded-full transition-all duration-[1800ms] ease-out"
                      style={{ width:`${mlPrediction ?? 0}%`, background:"linear-gradient(90deg,#06b6d4,#0d9488)" }} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2.5">9 more questions for your final score</p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-2 text-[12px] text-amber-700 font-medium mb-6">
                  💡 Early estimate — final score may vary
                </div>

                <button onClick={() => { setIdx(9); setStep("PHASE2"); }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                  style={{ background:"linear-gradient(135deg,#06b6d4,#0d9488)", boxShadow:"0 4px 16px rgba(6,182,212,0.32)" }}>
                  Continue to Phase 2 <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // ── PROCESSING ─────────────────────────────────────────────────
  if (step === "PROCESSING") return (
    <>
      <style>{keyframes}</style>
      <div className="max-w-xl mx-auto px-4 py-8" style={{ animation:"slideUp 0.3s ease" }}>
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-8 text-center">
          <div className="mx-auto w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-5 animate-pulse"
            style={{ background:"linear-gradient(135deg,#06b6d4,#0d9488)", boxShadow:"0 8px 24px rgba(6,182,212,0.28)" }}>
            <Brain size={22} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Analysing Your Results</h2>
          <p className="text-sm text-slate-400 mb-8">Just a moment…</p>
          <div className="space-y-3 text-left max-w-[260px] mx-auto">
            {["Collecting all 18 responses","Applying BEIS scoring model","Computing 4 EI dimensions","Determining your Brain Style","Generating personalised AI feedback"].map((s,i) => (
              <div key={i} className="flex items-center gap-3 text-[13px] text-slate-600"
                style={{ animation:`revealFade 0.4s ease ${i*0.12}s both` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" style={{ animationDelay:`${i*0.2}s` }} />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // ── RESULTS ────────────────────────────────────────────────────
  if (step === "RESULTS" && results) {
    const brainInfo = BRAIN_STYLE_DESC[results.brain_style] ?? BRAIN_STYLE_DESC["Visionary"];
    const overall   = results.overall ?? 50;

    const grade = overall >= 85 ? { label: "Exceptional", bg: "#d1fae5", color: "#065f46" }
                : overall >= 70 ? { label: "Strong",      bg: "#cffafe", color: "#0e7490" }
                : overall >= 55 ? { label: "Developing",  bg: "#fef3c7", color: "#92400e" }
                :                 { label: "Growing",     bg: "#fee2e2", color: "#991b1b" };

    const dimScores = [
      { label: "Emotional Awareness",     key: "EA",  value: results.ea,  color: "#0891b2", icon: "😤" },
      { label: "Emotion Usage",           key: "EU",  value: results.eu,  color: "#0d9488", icon: "🔥" },
      { label: "Emotional Understanding", key: "EUS", value: results.eus, color: "#0e7490", icon: "❤️" },
      { label: "Emotional Controlling",   key: "EC",  value: results.ec,  color: "#14b8a6", icon: "🧭" },
    ];

    const feedbackPairs: [string, string | undefined, string][] = [
      ["😤 Emotional Awareness",     results.groq_feedback?.ea_feedback,  "#0891b2"],
      ["🔥 Emotion Usage",           results.groq_feedback?.eu_feedback,  "#0d9488"],
      ["❤️ Emotional Understanding", results.groq_feedback?.eus_feedback, "#0e7490"],
      ["🧭 Emotional Controlling",   results.groq_feedback?.ec_feedback,  "#14b8a6"],
    ];

    return (
      <>
        <style>{keyframes}</style>
        <div className="max-w-xl mx-auto px-4 py-6 space-y-4" style={{ animation:"slideUp 0.4s ease" }}>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">EI Profile Results</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">BEIS psychometric framework</p>
            </div>
            <button onClick={restart}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm">
              <RotateCcw size={12} /> Retake
            </button>
          </div>

          <div className="rounded-2xl border border-cyan-100 overflow-hidden"
            style={{ background:"linear-gradient(135deg,#ecfeff 0%,#f0fdfa 45%,#e0f2fe 100%)", boxShadow:"0 4px 24px rgba(6,182,212,0.1)" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[10.5px] font-semibold text-cyan-600 uppercase tracking-wider mb-1.5">Overall EI Score</p>
                  <div className="text-[52px] font-bold tabular-nums leading-none"
                    style={{ background:"linear-gradient(135deg,#0891b2,#0d9488)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"countUp 0.6s ease" }}>
                    <AnimatedNumber target={overall} duration={2000} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">out of 100</p>
                  <span className="mt-2 inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ background:grade.bg, color:grade.color }}>
                    {grade.label}
                  </span>
                </div>
                <div className="rounded-xl bg-white/60 border border-white px-4 py-3 text-right backdrop-blur-sm">
                  <p className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1">ML Predicted · Q9</p>
                  <div className="text-2xl font-bold text-cyan-700 tabular-nums">{mlPrediction?.toFixed(1) ?? "—"}</div>
                  {mlPrediction && <p className="text-[10px] text-slate-400 mt-0.5">{Math.abs(overall - mlPrediction).toFixed(1)} pts off</p>}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-4 border-t border-cyan-100/70">
                {dimScores.map((d, i) => (
                  <div key={d.key} className="text-center rounded-xl bg-white/50 py-2.5 px-1"
                    style={{ animation:`revealFade 0.4s ease ${i*0.1+0.3}s both` }}>
                    <div className="text-sm mb-0.5">{d.icon}</div>
                    <div className="text-sm font-bold tabular-nums" style={{ color:d.color }}>{d.value?.toFixed(0) ?? "—"}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{d.key}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background:`linear-gradient(90deg,${brainInfo.color},#06b6d4)` }} />
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color:brainInfo.color }}>Brain Style</p>
              <div className="flex items-start gap-4">
                <div className="text-4xl shrink-0" style={{ animation:"float 4s ease-in-out infinite" }}>{brainInfo.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold text-slate-900">{results.brain_style}</p>
                  <p className="text-xs text-slate-400 mt-0.5 mb-2">{brainInfo.traits}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{brainInfo.desc}</p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {([["Focus",results.brain_focus],["Decisions",results.brain_decisions],["Drive",results.brain_drive]] as [string,string][])
                      .filter(([,v])=>v)
                      .map(([k,v])=>(
                        <span key={k} className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                          style={{ borderColor:brainInfo.color+"40", color:brainInfo.color, background:brainInfo.color+"0d" }}>
                          {k}: {v}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
            <p className="text-sm font-bold text-slate-800 mb-4">EI Dimensions Breakdown</p>
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-[155px]">
                <RadarChart scores={dimScores} />
              </div>
              <div className="flex-1 space-y-3.5">
                {dimScores.map((d,i) => (
                  <ScoreBar key={d.key} label={`${d.icon} ${d.label}`} score={d.value} color={d.color} delay={i*100} />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
            <p className="text-sm font-bold text-slate-800 mb-4">Growth Recommendations</p>
            <div className="space-y-2.5">
              {brainInfo.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100"
                  style={{ animation:`revealFade 0.4s ease ${i*0.12+0.2}s both` }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                    style={{ background:"linear-gradient(135deg,#06b6d4,#0d9488)" }}>
                    {i+1}
                  </span>
                  <p className="text-[13px] text-slate-600 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {results.groq_feedback && (
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
              <p className="text-sm font-bold text-slate-800 mb-4">AI Personalised Feedback</p>
              <div className="space-y-3">
                {feedbackPairs.map(([dim, text, color]) => text && (
                  <div key={dim} className="rounded-xl p-4" style={{ background:color+"07", border:`1px solid ${color}18` }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-1 h-4 rounded-full" style={{ background:color }} />
                      <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color }}>{dim}</span>
                    </div>
                    <ul className="space-y-1.5 pl-1">
                      {text.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 4).map((sentence: string, si: number) => (
                        <li key={si} className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-relaxed">
                          <span className="w-1 h-1 rounded-full mt-[6px] shrink-0 opacity-60" style={{ background:color }} />
                          {sentence.trim()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pb-6">
            <button onClick={() => router.push("/learning-hub/resources")}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ background:"linear-gradient(135deg,#06b6d4,#0d9488)", boxShadow:"0 4px 16px rgba(6,182,212,0.28)" }}>
              View Learning Resources →
            </button>
            <button onClick={restart}
              className="w-12 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition shadow-sm">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}