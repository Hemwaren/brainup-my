"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { X, ChevronRight, CheckCircle2 } from "lucide-react";
import Image from "next/image";

// ─── EMOTION TAGS ─────────────────────────────────────────────────────────────
const TAGS_BY_LEVEL: Record<number, string[]> = {
  1: [
    "Hopeless", "Devastated", "Miserable", "Drained", "Angry",
    "Disgusted", "Ashamed", "Scared", "Lonely", "Sad",
    "Anxious", "Stressed", "Overwhelmed", "Frustrated", "Guilty",
    "Embarrassed", "Disappointed", "Discouraged", "Irritated", "Worried",
    "Nervous", "Jealous", "Indifferent", "Annoyed", "Vulnerable",
    "Calm", "Content", "Relieved", "Satisfied", "Hopeful",
    "Grateful", "Proud", "Confident", "Happy", "Excited",
    "Joyful", "Amazed", "Surprised", "Passionate", "Peaceful",
    "Playful", "Inspired", "Motivated", "Energetic", "Focused",
    "Curious", "Nostalgic", "Brave", "Amused",
  ],
  2: [
    "Sad", "Anxious", "Stressed", "Frustrated", "Lonely",
    "Disappointed", "Discouraged", "Irritated", "Worried", "Nervous",
    "Guilty", "Embarrassed", "Annoyed", "Drained", "Overwhelmed",
    "Jealous", "Indifferent", "Scared", "Angry", "Ashamed",
    "Hopeless", "Disgusted", "Miserable", "Vulnerable", "Nostalgic",
    "Calm", "Content", "Relieved", "Amused", "Satisfied",
    "Hopeful", "Grateful", "Proud", "Confident", "Brave",
    "Happy", "Excited", "Joyful", "Peaceful", "Focused",
    "Curious", "Inspired", "Motivated", "Energetic", "Playful",
    "Passionate", "Amazed", "Surprised",
  ],
  3: [
    "Calm", "Indifferent", "Content", "Focused", "Nostalgic",
    "Curious", "Amused", "Relieved", "Satisfied", "Hopeful",
    "Worried", "Anxious", "Nervous", "Frustrated", "Disappointed",
    "Grateful", "Proud", "Confident", "Peaceful", "Brave",
    "Sad", "Lonely", "Drained", "Stressed", "Overwhelmed",
    "Happy", "Excited", "Joyful", "Inspired", "Motivated",
    "Energetic", "Playful", "Passionate", "Amazed", "Surprised",
    "Irritated", "Annoyed", "Jealous", "Embarrassed", "Guilty",
    "Discouraged", "Vulnerable", "Scared", "Angry", "Ashamed",
    "Disgusted", "Hopeless",
  ],
  4: [
    "Happy", "Content", "Grateful", "Hopeful", "Relieved",
    "Satisfied", "Proud", "Confident", "Calm", "Peaceful",
    "Excited", "Amused", "Playful", "Inspired", "Motivated",
    "Energetic", "Focused", "Curious", "Brave", "Nostalgic",
    "Joyful", "Amazed", "Surprised", "Passionate",
    "Worried", "Nervous", "Anxious", "Indifferent", "Lonely",
    "Frustrated", "Disappointed", "Sad", "Stressed", "Overwhelmed",
    "Jealous", "Irritated", "Annoyed", "Embarrassed", "Guilty",
    "Discouraged", "Drained", "Scared", "Angry", "Ashamed",
    "Disgusted", "Vulnerable",
  ],
  5: [
    "Joyful", "Excited", "Amazed", "Passionate", "Energetic",
    "Happy", "Inspired", "Motivated", "Proud", "Grateful",
    "Confident", "Hopeful", "Playful", "Amused", "Peaceful",
    "Content", "Satisfied", "Relieved", "Calm", "Focused",
    "Curious", "Brave", "Surprised", "Nostalgic",
    "Indifferent", "Worried", "Nervous", "Lonely", "Frustrated",
    "Disappointed", "Sad", "Stressed", "Overwhelmed", "Anxious",
    "Jealous", "Irritated", "Annoyed", "Embarrassed", "Guilty",
    "Discouraged", "Drained", "Scared", "Angry", "Ashamed",
    "Disgusted", "Vulnerable",
  ],
};

// ─── LEVEL CONFIG ─────────────────────────────────────────────────────────────
type LevelConfig = {
  level: number;
  label: string;
  color: string;
  bg: string;
  imgSrc: string;
  particleColor: string;
  idleAnimate: Record<string, number[]>;
  idleDuration: number;
  entryX: number;
  entryScale: number;
  exitX: number;
};

const LEVELS: LevelConfig[] = [
  {
    level: 1,
    label: "Very Unpleasant",
    color: "#6366f1",
    bg: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
    imgSrc: "/emotions/veryunpleasant.png",
    particleColor: "#a5b4fc",
    idleAnimate: { rotate: [-2, 2, -2], y: [0, -3, 0] },
    idleDuration: 3,
    entryX: -60,
    entryScale: 1,
    exitX: 60,
  },
  {
    level: 2,
    label: "Unpleasant",
    color: "#3b82f6",
    bg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    imgSrc: "/emotions/unpleasant.png",
    particleColor: "#93c5fd",
    idleAnimate: { y: [0, -5, 0], rotate: [-1, 1, -1] },
    idleDuration: 2.5,
    entryX: -60,
    entryScale: 1,
    exitX: 60,
  },
  {
    level: 3,
    label: "Neutral",
    color: "#10b981",
    bg: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
    imgSrc: "/emotions/neutral.png",
    particleColor: "#6ee7b7",
    idleAnimate: { y: [0, -6, 0] },
    idleDuration: 2.8,
    entryX: 0,
    entryScale: 0.8,
    exitX: 0,
  },
  {
    level: 4,
    label: "Pleasant",
    color: "#f59e0b",
    bg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    imgSrc: "/emotions/pleasant.png",
    particleColor: "#fcd34d",
    idleAnimate: { y: [0, -8, 0], rotate: [0, 3, 0, -3, 0] },
    idleDuration: 2,
    entryX: 60,
    entryScale: 1,
    exitX: -60,
  },
  {
    level: 5,
    label: "Very Pleasant",
    color: "#ec4899",
    bg: "linear-gradient(135deg, #fdf4ff 0%, #fce7f3 100%)",
    imgSrc: "/emotions/verypleasant.png",
    particleColor: "#f9a8d4",
    idleAnimate: { y: [0, -12, 0], scale: [1, 1.05, 1] },
    idleDuration: 1.8,
    entryX: 60,
    entryScale: 1.1,
    exitX: -60,
  },
];

// ─── PARTICLES ────────────────────────────────────────────────────────────────
function Particles({ color }: { color: string }) {
  const particles = [
    { x: 20, delay: 0 }, { x: 60, delay: 0.3 }, { x: 100, delay: 0.6 },
    { x: 140, delay: 0.2 }, { x: 170, delay: 0.5 }, { x: 40, delay: 0.8 },
    { x: 120, delay: 0.4 }, { x: 80, delay: 0.1 },
  ];
  const stars = ["⭐", "✨", "💫", "🌟"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.div key={i}
          className="absolute rounded-full"
          style={{ width: 6 + (i % 3) * 3, height: 6 + (i % 3) * 3, background: color, left: p.x, bottom: 20, opacity: 0.7 }}
          animate={{ y: [-80, -160], opacity: [0.7, 0], scale: [1, 0.5] }}
          transition={{ duration: 2 + (i % 3) * 0.5, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
        />
      ))}
      {stars.map((star, i) => (
        <motion.div key={`star-${i}`}
          className="absolute text-lg"
          style={{ left: [15, 55, 130, 165][i], bottom: 30 }}
          animate={{ y: [-60, -140], opacity: [1, 0], rotate: [0, 360] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}>
          {star}
        </motion.div>
      ))}
    </div>
  );
}

// ─── MASCOT ───────────────────────────────────────────────────────────────────
function Mascot({ levelConfig, size = 160 }: { levelConfig: LevelConfig; size?: number }) {
  return (
    <motion.div
      animate={levelConfig.idleAnimate}
      transition={{ duration: levelConfig.idleDuration, repeat: Infinity, ease: "easeInOut" }}>
      <Image
        src={levelConfig.imgSrc}
        alt={levelConfig.label}
        width={size}
        height={size}
        className="object-contain drop-shadow-lg"
        priority
      />
    </motion.div>
  );
}

// ─── PROPS ────────────────────────────────────────────────────────────────────
type Props = {
  userId: string;
  department: string;
  scheduleSlot: string | null;
  onComplete: () => void;
  onClose: () => void;
};

const MAX_TAGS = 5;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function EmotionCheckin({ userId, department, scheduleSlot, onComplete, onClose }: Props) {
  const [step, setStep] = useState<"slider" | "tags" | "done">("slider");
  const [sliderValue, setSliderValue] = useState(2);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchTag, setSearchTag] = useState("");

  const level = Math.min(5, Math.max(1, Math.ceil(sliderValue + 0.5)));
  const currentLevel = LEVELS[level - 1];
  const allTags = TAGS_BY_LEVEL[level] ?? TAGS_BY_LEVEL[3];
  const filteredTags = searchTag.trim()
    ? allTags.filter(t => t.toLowerCase().includes(searchTag.toLowerCase()))
    : allTags;
  const thumbPct = (sliderValue / 4) * 100;

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, tag];
    });
  }

  async function handleSave() {
    if (selectedTags.length === 0) return;
    setSaving(true);
    try {
      const insertData: Record<string, unknown> = {
        user_id: userId,
        emotion_level: level,
        emotion_tag: selectedTags[0],
        department: department || "",
        checked_in_at: new Date().toISOString(),
      };
      if (scheduleSlot) insertData.schedule_slot = scheduleSlot;

      const { error } = await supabase.from("emotion_checkins").insert(insertData);
      if (error) { console.error("Save error:", error.message); setSaving(false); return; }

      setStep("done");
      setTimeout(() => onComplete(), 2200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Unexpected error:", message);
      setSaving(false);
    }
  }

  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 32 }}
        transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-white"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Emotion · {timeStr}
          </div>
          <button type="button" onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition">
            <X size={13} />
          </button>
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1: SLIDER ── */}
          {step === "slider" && (
            <motion.div key="slider"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="pb-8">

              <h2 className="text-base font-extrabold text-slate-800 text-center px-6 mt-2 mb-4">
                How are you feeling right now?
              </h2>

              {/* Mascot stage */}
              <div
                className="relative mx-4 rounded-3xl overflow-hidden flex items-center justify-center"
                style={{ height: 220, background: currentLevel.bg, transition: "background 0.5s ease" }}
              >
                {level === 5 && <Particles color={currentLevel.particleColor} />}

                {/* Glowing background circles */}
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 160, height: 160, background: currentLevel.particleColor, opacity: 0.15 }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 110, height: 110, background: currentLevel.particleColor, opacity: 0.2 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />

                {/* Mascot with entry/exit transition */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`mascot-${level}`}
                    initial={{ x: currentLevel.entryX, scale: currentLevel.entryScale === 1 ? 0.85 : currentLevel.entryScale, opacity: 0 }}
                    animate={{ x: 0, scale: 1, opacity: 1 }}
                    exit={{ x: currentLevel.exitX, scale: 0.85, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    style={{ position: "relative", zIndex: 10 }}>
                    <Mascot levelConfig={currentLevel} size={160} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Label */}
              <AnimatePresence mode="wait">
                <motion.div key={`lbl-${level}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-center mt-4 mb-3 px-6">
                  <span className="text-xl font-extrabold"
                    style={{ color: currentLevel.color, transition: "color 0.4s ease" }}>
                    {currentLevel.label}
                  </span>
                </motion.div>
              </AnimatePresence>

              {/* Smooth continuous slider */}
              <div className="px-7 mb-2 relative">
                <div className="h-3 w-full rounded-full overflow-hidden"
                  style={{ background: "linear-gradient(to right, #6366f1, #3b82f6, #10b981, #f59e0b, #ec4899)" }} />
                <input
                  type="range" min={0} max={4} step={0.01}
                  value={sliderValue}
                  onChange={e => { setSliderValue(Number(e.target.value)); setSelectedTags([]); }}
                  className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
                  style={{ zIndex: 3, top: 0, left: 0, padding: "0 28px" }}
                />
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full border-[3px] border-white shadow-lg pointer-events-none"
                  style={{
                    left: `calc(${thumbPct}% - 14px)`,
                    background: currentLevel.color,
                    zIndex: 2,
                    transition: "background 0.4s ease",
                  }}
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              <div className="flex justify-between px-7 mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Very Unpleasant</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Very Pleasant</span>
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center gap-2 mb-5">
                {LEVELS.map((l, i) => (
                  <motion.button
                    key={l.level}
                    type="button"
                    onClick={() => { setSliderValue(i); setSelectedTags([]); }}
                    animate={{ width: level === l.level ? 30 : 8 }}
                    transition={{ duration: 0.2 }}
                    className="h-2 rounded-full"
                    style={{ background: level === l.level ? l.color : "#e2e8f0", transition: "background 0.3s ease" }}
                  />
                ))}
              </div>

              <div className="px-6">
                <motion.button
                  type="button"
                  onClick={() => setStep("tags")}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-2xl py-3.5 text-sm font-extrabold text-white flex items-center justify-center gap-2"
                  style={{ background: currentLevel.color, transition: "background 0.4s ease" }}>
                  Next <ChevronRight size={16} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: TAGS ── */}
          {step === "tags" && (
            <motion.div key="tags"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="px-6 pb-8">

              {/* Mini mascot header */}
              <div className="flex items-center gap-3 mt-2 mb-4">
                <div className="rounded-2xl shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ width: 64, height: 64, background: currentLevel.bg }}>
                  <Image
                    src={currentLevel.imgSrc}
                    alt={currentLevel.label}
                    width={56}
                    height={56}
                    className="object-contain"
                  />
                </div>
                <div>
                  <div className="text-base font-extrabold text-slate-900">{currentLevel.label}</div>
                  <div className="text-xs text-slate-500">
                    What best describes this?{" "}
                    <span className="font-extrabold" style={{ color: currentLevel.color }}>
                      {selectedTags.length}/{MAX_TAGS}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected tag pills */}
              {selectedTags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex flex-wrap gap-1.5 mb-3">
                  {selectedTags.map(tag => (
                    <motion.button key={tag} type="button" onClick={() => toggleTag(tag)}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                      style={{ background: currentLevel.color }}>
                      {tag} <X size={10} />
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {/* Search */}
              <input
                type="text"
                value={searchTag}
                onChange={e => setSearchTag(e.target.value)}
                placeholder="Search emotions..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:bg-white mb-3 transition"
              />

              {/* Tags grid */}
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto scrollbar-none">
                {filteredTags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  const isDisabled = !isSelected && selectedTags.length >= MAX_TAGS;
                  return (
                    <motion.button key={tag} type="button"
                      onClick={() => !isDisabled && toggleTag(tag)}
                      disabled={isDisabled}
                      whileTap={!isDisabled ? { scale: 0.93 } : {}}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-bold border transition-all",
                        isSelected ? "text-white border-transparent"
                          : isDisabled ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100",
                      ].join(" ")}
                      style={isSelected ? { background: currentLevel.color, borderColor: currentLevel.color } : {}}>
                      {tag}
                    </motion.button>
                  );
                })}
              </div>

              {selectedTags.length >= MAX_TAGS && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mt-2 text-[11px] font-bold text-center"
                  style={{ color: currentLevel.color }}>
                  Max {MAX_TAGS} emotions selected ✓
                </motion.p>
              )}

              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setStep("slider")}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-extrabold text-slate-600 hover:bg-slate-50 transition">
                  Back
                </button>
                <motion.button type="button" onClick={handleSave}
                  disabled={selectedTags.length === 0 || saving}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 rounded-2xl py-3 text-sm font-extrabold text-white disabled:opacity-40 transition"
                  style={{ background: selectedTags.length > 0 ? currentLevel.color : "#cbd5e1" }}>
                  {saving ? "Saving..." : "Done ✓"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: SUCCESS ── */}
          {step === "done" && (
            <motion.div key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 pb-10 pt-4 flex flex-col items-center text-center">

              {/* Big mascot */}
              <div className="relative rounded-3xl overflow-hidden flex items-center justify-center mb-4"
                style={{ width: 200, height: 200, background: currentLevel.bg }}>
                {level === 5 && <Particles color={currentLevel.particleColor} />}
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
                  style={{ position: "relative", zIndex: 10 }}>
                  <Mascot levelConfig={currentLevel} size={160} />
                </motion.div>
              </div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.3 }}>
                <CheckCircle2 size={32} className="mb-2" style={{ color: currentLevel.color }} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}>
                <div className="text-xl font-extrabold text-slate-900 mb-1">Emotions logged! 🎉</div>
                <div className="text-sm text-slate-500">
                  Feeling <span className="font-bold text-slate-800">{selectedTags.join(", ")}</span>
                </div>
                <div className="mt-1 text-xs font-bold" style={{ color: currentLevel.color }}>
                  {currentLevel.label}
                </div>
                <div className="mt-3 text-xs text-slate-400">Returning to dashboard...</div>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}