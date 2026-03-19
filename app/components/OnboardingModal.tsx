"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

type Props = {
  userId: string;
  onComplete: (data: { nickname: string; age: number; gender: string; ei_identify_level: string; one_word_self: string }) => void;
};

const GENDERS = ["Male", "Female", "Prefer not to say"];
const EI_LEVELS = ["Easy", "Sometimes", "Hard"];

export default function OnboardingModal({ userId, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState("");
  const [eiLevel, setEiLevel] = useState("");
  const [oneWord, setOneWord] = useState("");

  function canProceedForm() {
    return nickname.trim() && gender && eiLevel && oneWord.trim();
  }

  async function handleFinish() {
    if (!canProceedForm()) {
      setMsg("Please fill in all fields.");
      return;
    }
    setSaving(true);
    setMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMsg("Session expired. Please log in again.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/profile/complete-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          age,
          gender,
          ei_identify_level: eiLevel,
          one_word_self: oneWord.trim(),
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMsg(`Error: ${data.message}`);
        setSaving(false);
        return;
      }

      // Pass saved data back to parent so profile card updates immediately
      onComplete({
        nickname: nickname.trim(),
        age,
        gender,
        ei_identify_level: eiLevel,
        one_word_self: oneWord.trim(),
      });

    } catch (err: any) {
      setMsg("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const dots = (
    <div className="flex justify-center items-center gap-2 mt-5">
      {[0, 1, 2].map((s) => (
        <div
          key={s}
          className="rounded-full transition-all duration-300"
          style={{
            width: step === s ? 28 : 8,
            height: 8,
            background: step === s ? "#22d3ee" : step > s ? "#99f6e4" : "#e2e8f0",
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full rounded-3xl bg-white shadow-2xl overflow-hidden"
        style={{ maxWidth: step === 2 ? "780px" : "620px" }}
      >
        <AnimatePresence mode="wait">

          {/* STEP 0: WELCOME */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-10 px-12 py-10"
            >
              <img src="/brainy-welcome.png" alt="Brainy welcomes you" className="w-52 h-52 object-contain drop-shadow-lg shrink-0" />
              <div className="flex-1">
                <h2 className="text-3xl font-extrabold" style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Welcome to BrainUp!
                </h2>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                  We're so excited to have you on board for this <strong className="text-slate-700">Emotional Intelligence journey</strong>. Let's get things set up for you! 🎉
                </p>
                <button type="button" onClick={() => setStep(1)}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl px-7 py-3 text-sm font-extrabold text-white hover:opacity-95 transition"
                  style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>
                  Let's Go <ChevronRight size={16} />
                </button>
                {dots}
              </div>
            </motion.div>
          )}

          {/* STEP 1: MEET BRAINY */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-10 px-12 py-10"
            >
              <img src="/brainy-meet.png" alt="Meet Brainy" className="w-52 h-52 object-contain drop-shadow-lg shrink-0" />
              <div className="flex-1">
                <h2 className="text-3xl font-extrabold" style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Meet Brainy!
                </h2>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                  Hi there! I'm <strong className="text-slate-700">Brainy</strong>, your emotional intelligence companion. I'll guide you throughout your entire BrainUp journey — from daily check-ins to levelling up your EI! 🦊
                </p>
                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setStep(0)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-50 transition">
                    <ChevronLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-2xl px-7 py-2.5 text-sm font-extrabold text-white hover:opacity-95 transition"
                    style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>
                    Next <ChevronRight size={16} />
                  </button>
                </div>
                {dots}
              </div>
            </motion.div>
          )}

          {/* STEP 2: FORM */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="flex"
            >
              <div className="hidden sm:flex flex-col items-center justify-center bg-gradient-to-b from-cyan-50 to-teal-50 px-8 py-8 w-52 shrink-0 border-r border-slate-100">
                <img src="/brainy-form.png" alt="Brainy helping" className="w-36 object-contain drop-shadow-md" />
                <p className="mt-4 text-xs font-bold text-cyan-700 text-center leading-relaxed">
                  Fill this in and I'll personalise your BrainUp experience!
                </p>
              </div>

              <div className="flex-1 px-10 py-8">
                <h2 className="text-xl font-extrabold mb-0.5" style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Tell us about yourself
                </h2>
                <p className="text-xs text-slate-400 mb-5">All fields required</p>

                <div className="space-y-5">

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1.5">Nickname / Preferred Name</label>
                      <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Alex, Kak Ani"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1.5">One word to describe yourself</label>
                      <input type="text" value={oneWord} onChange={(e) => setOneWord(e.target.value.split(" ")[0])} placeholder="e.g. Curious, Resilient"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1.5">Age — <span className="text-cyan-600 font-extrabold">{age}</span></label>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setAge((v) => Math.max(16, v - 1))}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition text-xl font-bold shrink-0">−</button>
                      <div className="w-20 shrink-0">
                        <div className="rounded-xl border border-cyan-200 bg-cyan-50 py-1.5 text-center">
                          <div className="text-[10px] text-cyan-300 font-bold">{age - 1 >= 16 ? age - 1 : ""}</div>
                          <div className="text-2xl font-extrabold text-cyan-700 leading-tight">{age}</div>
                          <div className="text-[10px] text-cyan-300 font-bold">{age + 1 <= 80 ? age + 1 : ""}</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => setAge((v) => Math.min(80, v + 1))}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition text-xl font-bold shrink-0">+</button>
                      <input type="range" min={16} max={80} value={age} onChange={(e) => setAge(Number(e.target.value))} className="flex-1 accent-cyan-500" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1.5">Gender</label>
                    <div className="flex gap-3">
                      {GENDERS.map((g) => (
                        <button key={g} type="button" onClick={() => setGender(g)}
                          className={["flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition", gender === g ? "border-cyan-400 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1.5">How easily can you identify your emotions?</label>
                    <div className="flex gap-3">
                      {EI_LEVELS.map((l) => (
                        <button key={l} type="button" onClick={() => setEiLevel(l)}
                          className={["flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition", eiLevel === l ? "border-cyan-400 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {msg && <p className="mt-3 text-xs font-semibold text-rose-600">{msg}</p>}

                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-50 transition">
                    <ChevronLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={handleFinish} disabled={saving || !canProceedForm()}
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-40 transition"
                    style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>
                    {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <>Start Journey! 🚀</>}
                  </button>
                </div>

                {dots}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}