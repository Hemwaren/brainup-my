"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  ShieldCheck,
  NotebookPen,
  Image as ImageIcon,
  Video as VideoIcon,
  Type,
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Sparkles,
  Search,
  BookOpenText,
  Clock,
  CheckCircle2,
  Filter,
  Camera,
  Upload,
  Flame,
  Trophy,
  TrendingUp,
  Hash,
  Quote,
  ArrowLeft,
} from "lucide-react";

/* ─── Types (unchanged) ─────────────────────────────────────────────────── */
type EntryType = "TEXT" | "IMAGE" | "VIDEO";

type PinRow = {
  user_id: string;
  pin_salt: string;
  pin_hash: string;
  created_at: string;
  updated_at: string;
};

type JournalEntry = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  entry_type: EntryType;
  media_paths: string[];
  created_at: string;
};

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const BRAND_BG      = "bg-cyan-600";
const BRAND_BG_SOFT = "bg-cyan-50";

/* ─── Placeholder quote (updated by admin) ──────────────────────────────── */
const DAILY_QUOTE = {
  text: "The act of writing is the act of discovering what you believe.",
  author: "David Hare",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}
function bytesToB64(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function pbkdf2(pin: string, saltBytes: Uint8Array) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 120_000 },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}
function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  e.setMilliseconds(e.getMilliseconds() - 1);
  return e;
}
function startOfMonth(y: number, m: number) {
  const d = new Date(y, m, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfMonth(y: number, m: number) {
  const d = new Date(y, m + 1, 1);
  d.setMilliseconds(d.getMilliseconds() - 1);
  return d;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short", year: "numeric", month: "short",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function fmtShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}
function pinDigitsOnly(v: string) {
  return v.replace(/\D/g, "").slice(0, 6);
}

/* ─── Calendar helpers ───────────────────────────────────────────────────── */
const DAY_NAMES   = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
function buildCalendarGrid(year: number, month: number) {
  const first    = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7;
  const daysIn   = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let i = 1; i <= daysIn; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ─── Shared primitives ──────────────────────────────────────────────────── */
function CardPill({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/5 px-2.5 py-1 text-xs font-bold text-slate-700">
      {icon}{label}
    </span>
  );
}

function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative rounded-full px-3 py-2 text-xs font-extrabold transition",
        active ? "text-white" : "text-white/80 hover:text-white"
      )}
    >
      {label}
      {active && (
        <motion.span
          layoutId="journal-tab-underline"
          className="absolute left-1/2 top-full mt-2 h-1 w-16 -translate-x-1/2 rounded-full bg-white/90"
        />
      )}
    </button>
  );
}

function FlipChip({ active, label, icon, onClick }: {
  active: boolean; label: string; icon?: React.ReactNode; onClick: () => void;
}) {
  return (
    <motion.button
      type="button" onClick={onClick} aria-pressed={active}
      whileTap={{ scale: 0.96 }}
      animate={{ rotateY: active ? 180 : 0 }}
      transition={{ duration: 0.28 }}
      style={{ transformStyle: "preserve-3d" }}
      className={cx(
        "relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold transition",
        active ? "bg-white text-cyan-800 shadow-sm ring-2 ring-white/30" : "bg-white/15 text-white hover:bg-white/20"
      )}
    >
      <span className="inline-flex items-center gap-2" style={{ backfaceVisibility: "hidden" }}>{icon}{label}</span>
      <span
        className="inline-flex items-center gap-2"
        style={{
          position: "absolute", inset: 0, padding: "0.25rem 0.75rem",
          alignItems: "center", justifyContent: "flex-start",
          backfaceVisibility: "hidden", transform: "rotateY(180deg)",
        }}
      >{icon}{label}</span>
    </motion.button>
  );
}

function IconForType({ t }: { t: EntryType }) {
  if (t === "TEXT")  return <Type size={14} />;
  if (t === "IMAGE") return <ImageIcon size={14} />;
  return <VideoIcon size={14} />;
}

/* ── Animated stat row ── */
function StatRow({ icon, label, value, delay = 0 }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay }}
      className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
    >
      <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-500">
        <span className="text-slate-400">{icon}</span>{label}
      </div>
      <div className="text-sm font-extrabold text-slate-900">{value}</div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MINI CALENDAR — standalone card
══════════════════════════════════════════════════════════════════════════ */
function MiniCalendarCard({
  entries,
  diaryLocked,
  setFilterMode,
  setMonthPick,
}: {
  entries: JournalEntry[];
  diaryLocked: boolean;
  setFilterMode: (m: "WEEK" | "MONTH") => void;
  setMonthPick: (s: string) => void;
}) {
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [dir,      setDir]      = useState(0);
  const today = new Date();
  const cells = buildCalendarGrid(calYear, calMonth);

  const entryDays = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      const d = new Date(e.created_at);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth)
        set.add(String(d.getDate()));
    });
    return set;
  }, [entries, calYear, calMonth]);

  function prevMonth() {
    setDir(-1);
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    setDir(1);
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  useEffect(() => {
    const val = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    setMonthPick(val);
    setFilterMode("MONTH");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calYear, calMonth]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      {/* Card header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-50">
          <CalendarDays size={15} className="text-cyan-600" />
        </div>
        <div>
          <div className="text-base font-black text-slate-900">Calendar</div>
          <div className="text-[11px] font-semibold text-slate-400">Your entry history</div>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <motion.button
          type="button" onClick={prevMonth}
          whileTap={{ scale: 0.88 }} whileHover={{ x: -1 }}
          disabled={diaryLocked}
          className="grid h-7 w-7 place-items-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 transition disabled:opacity-40"
        >
          <ChevronLeft size={13} />
        </motion.button>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={`${calYear}-${calMonth}`}
            custom={dir}
            initial={{ opacity: 0, x: dir * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -20 }}
            transition={{ duration: 0.18 }}
            className="text-xs font-extrabold text-slate-800"
          >
            {MONTH_NAMES[calMonth]} {calYear}
          </motion.div>
        </AnimatePresence>

        <motion.button
          type="button" onClick={nextMonth}
          whileTap={{ scale: 0.88 }} whileHover={{ x: 1 }}
          disabled={diaryLocked}
          className="grid h-7 w-7 place-items-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 transition disabled:opacity-40"
        >
          <ChevronRight size={13} />
        </motion.button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[9px] font-extrabold text-slate-400 py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={`cal-${calYear}-${calMonth}`}
          custom={dir}
          initial={{ opacity: 0, x: dir * 22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -22 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7 gap-y-0.5"
        >
          {cells.map((day, idx) => {
            const isToday  = day !== null
              && today.getDate() === day
              && today.getMonth() === calMonth
              && today.getFullYear() === calYear;
            const hasEntry = day !== null && entryDays.has(String(day)) && !diaryLocked;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.55 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.12, delay: (idx % 7) * 0.014 }}
                className="flex items-center justify-center py-0.5"
              >
                {day !== null ? (
                  <motion.div
                    whileHover={{ scale: 1.22 }}
                    whileTap={{ scale: 0.9 }}
                    className={cx(
                      "relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold cursor-pointer transition select-none",
                      isToday
                        ? "bg-cyan-600 text-white shadow-[0_2px_8px_rgba(8,145,178,0.45)]"
                        : hasEntry
                        ? "bg-cyan-100 text-cyan-800"
                        : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {day}
                    {/* Pulse ring for today */}
                    {isToday && (
                      <motion.span
                        className="absolute inset-0 rounded-full border-2 border-cyan-400/60"
                        animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
                        transition={{ duration: 2.4, repeat: Infinity }}
                      />
                    )}
                    {/* Entry dot */}
                    {hasEntry && !isToday && (
                      <motion.span
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-500"
                      />
                    )}
                  </motion.div>
                ) : (
                  <div className="h-6 w-6" />
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400">
          <span className="h-2 w-2 rounded-full bg-cyan-600 inline-block" />Today
        </span>
        <span className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400">
          <span className="h-2 w-2 rounded-full bg-cyan-100 ring-1 ring-cyan-300 inline-block" />
          {diaryLocked ? "Locked" : "Has entry"}
        </span>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MERGED STATS + QUOTE CARD
══════════════════════════════════════════════════════════════════════════ */
function StatsAndQuoteCard({
  stats,
  diaryLocked,
}: {
  stats: { total: number; thisWeek: number; streak: number; xp: number };
  diaryLocked: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.28 }}
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-50/70 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-sky-50/70 blur-2xl" />

      <div className="relative flex flex-col lg:flex-row">

        {/* ── LEFT: Stats ── */}
        <div className="flex-1 p-5 lg:border-r border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-50">
              <TrendingUp size={15} className="text-cyan-600" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">Your Journey</div>
              <div className="text-[11px] font-semibold text-slate-400">Journaling progress</div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {diaryLocked ? (
              <motion.div
                key="stats-locked"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center gap-2"
              >
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-600"
                >
                  <Lock size={18} />
                </motion.div>
                <p className="text-sm font-extrabold text-slate-700">Stats hidden</p>
                <p className="text-xs font-semibold text-slate-400">Unlock diary to reveal</p>
              </motion.div>
            ) : (
              <motion.div
                key="stats-unlocked"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.28 }}
                className="mt-3"
              >
                <StatRow
                  icon={<Hash size={14} />} label="Total Entries"
                  value={
                    <motion.span key={stats.total}
                      initial={{ scale: 1.5, color: "#0891b2" }} animate={{ scale: 1, color: "#0f172a" }}
                      transition={{ duration: 0.4 }}
                    >{stats.total}</motion.span>
                  } delay={0.05}
                />
                <StatRow
                  icon={<CalendarDays size={14} />} label="This Week"
                  value={
                    <motion.span key={stats.thisWeek}
                      initial={{ scale: 1.5, color: "#0891b2" }} animate={{ scale: 1, color: "#0f172a" }}
                      transition={{ duration: 0.4 }}
                    >{stats.thisWeek}</motion.span>
                  } delay={0.1}
                />
                <StatRow
                  icon={<Flame size={14} className="text-orange-400" />} label="Current Streak"
                  value={
                    <span className="flex items-center gap-1.5">
                      <motion.span key={stats.streak}
                        initial={{ scale: 1.5, color: "#f97316" }} animate={{ scale: 1, color: "#0f172a" }}
                        transition={{ duration: 0.4 }}
                      >{stats.streak} day{stats.streak !== 1 ? "s" : ""}</motion.span>
                      {stats.streak > 0 && (
                        <motion.span
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                        >🔥</motion.span>
                      )}
                    </span>
                  } delay={0.15}
                />
                <StatRow
                  icon={<Trophy size={14} className="text-amber-500" />} label="XP from Journaling"
                  value={
                    <motion.span key={stats.xp}
                      initial={{ scale: 1.5, color: "#d97706" }} animate={{ scale: 1, color: "#0f172a" }}
                      transition={{ duration: 0.4 }}
                      className="font-extrabold text-amber-600"
                    >+{stats.xp}</motion.span>
                  } delay={0.2}
                />

                {/* Progress bar */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38 }}
                  className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
                    <span className="flex items-center gap-1.5"><TrendingUp size={11} /> Weekly goal</span>
                    <span>{Math.min(stats.thisWeek, 7)}/7 entries</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((stats.thisWeek / 7) * 100, 100)}%` }}
                      transition={{ duration: 0.9, delay: 0.45, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider on mobile */}
        <div className="h-px w-full bg-slate-100 lg:hidden" />

        {/* ── RIGHT: Quote ── */}
        <div className="flex flex-col justify-between p-5 lg:w-72 xl:w-80">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }}
                className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-50"
              >
                <Sparkles size={14} className="text-cyan-600" />
              </motion.div>
              <div>
                <div className="text-base font-black text-slate-900">Daily Inspiration</div>
                <div className="text-[11px] font-semibold text-slate-400">Updated by admin</div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.4 }}
            >
              <motion.div
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Quote size={28} className="text-cyan-200 mb-3" />
              </motion.div>
              <p className="text-sm font-bold leading-relaxed text-slate-800 italic">
                "{DAILY_QUOTE.text}"
              </p>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="mt-3 text-xs font-extrabold text-cyan-700"
              >
                — {DAILY_QUOTE.author}
              </motion.p>
            </motion.div>
          </div>

          {/* Animated dots */}
          <div className="mt-6 flex items-center gap-2">
            {[0, 0.35, 0.7].map((delay, i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2.2, repeat: Infinity, delay }}
                className="h-1.5 w-1.5 rounded-full bg-cyan-400"
              />
            ))}
            <span className="ml-1 text-[10px] font-semibold text-slate-400">Refreshed daily</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MEDIA CAPTURE SECTION
══════════════════════════════════════════════════════════════════════════ */
function MediaCaptureSection({
  createType, files, onPickFiles, fileInputRef, cameraInputRef,
}: {
  createType: EntryType;
  files: File[];
  onPickFiles: (list: FileList | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  if (createType === "TEXT") return null;
  const isVideo = createType === "VIDEO";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}
      className="space-y-2"
    >
      <label className="text-[11px] font-semibold text-slate-400">
        {isVideo ? "Upload video (1 file)" : "Upload images (up to 8)"}
      </label>

      <div className="grid grid-cols-2 gap-3">
        {/* Camera */}
        <motion.label
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(8,145,178,0.18)" }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50 px-3 py-4 text-center transition"
        >
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.4 }}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-600 text-white shadow-[0_4px_14px_rgba(8,145,178,0.4)]"
          >
            <Camera size={18} />
          </motion.div>
          <span className="text-xs font-extrabold text-cyan-800">{isVideo ? "Record Video" : "Take Photo"}</span>
          <span className="text-[10px] font-semibold text-cyan-500">Use device camera</span>
          <input
            ref={cameraInputRef} type="file"
            accept={isVideo ? "video/*" : "image/*"}
            capture="environment"
            onChange={(e) => onPickFiles(e.target.files)}
            className="sr-only"
          />
        </motion.label>

        {/* Upload */}
        <motion.label
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(15,23,42,0.08)" }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center transition"
        >
          <motion.div
            whileHover={{ y: -2 }}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm"
          >
            <Upload size={18} />
          </motion.div>
          <span className="text-xs font-extrabold text-slate-700">{isVideo ? "Upload Video" : "Upload Photos"}</span>
          <span className="text-[10px] font-semibold text-slate-400">From your device</span>
          <input
            ref={fileInputRef} type="file"
            accept={isVideo ? "video/*" : "image/*"}
            multiple={!isVideo}
            onChange={(e) => onPickFiles(e.target.files)}
            className="sr-only"
          />
        </motion.label>
      </div>

      {/* Selected files preview */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
          >
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-cyan-800">
                <CheckCircle2 size={13} className="text-cyan-600" />
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </div>
              <div className="mt-1 space-y-0.5">
                {files.map((f, i) => (
                  <div key={i} className="truncate text-[10px] font-semibold text-cyan-600">{f.name}</div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function JournalPage() {
  /* ── All state (unchanged) ── */
  const [booting,     setBooting]     = useState(true);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [pinRow,      setPinRow]      = useState<PinRow | null>(null);
  const [diaryState,  setDiaryState]  = useState<"NEED_SETUP" | "NEED_UNLOCK" | "UNLOCKED">("NEED_SETUP");
  const [setupPin1,   setSetupPin1]   = useState("");
  const [setupPin2,   setSetupPin2]   = useState("");
  const [unlockPin,   setUnlockPin]   = useState("");
  const [pinBusy,     setPinBusy]     = useState(false);
  const [pinMsg,      setPinMsg]      = useState<string | null>(null);
  const [entries,     setEntries]     = useState<JournalEntry[]>([]);
  const [entriesBusy, setEntriesBusy] = useState(false);
  const [filterMode,  setFilterMode]  = useState<"WEEK" | "MONTH">("WEEK");
  const [monthPick,   setMonthPick]   = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [search,      setSearch]      = useState("");
  const [createOpen,  setCreateOpen]  = useState(false);
  const [createType,  setCreateType]  = useState<EntryType>("TEXT");
  const [title,       setTitle]       = useState("");
  const [desc,        setDesc]        = useState("");
  const [files,       setFiles]       = useState<File[]>([]);
  const [createBusy,  setCreateBusy]  = useState(false);
  const fileInputRef   = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [viewEntry,   setViewEntry]   = useState<JournalEntry | null>(null);
  const [signedUrls,  setSignedUrls]  = useState<string[]>([]);
  const [viewBusy,    setViewBusy]    = useState(false);

  /* ── Boot (unchanged) ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      setBooting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user?.id) { setUserId(null); setBooting(false); return; }
      setUserId(user.id);
      const { data, error } = await supabase.from("diary_pin").select("*").eq("user_id", user.id).maybeSingle();
      if (!alive) return;
      if (error)  { console.error(error); setPinRow(null); setDiaryState("NEED_SETUP"); }
      else if (!data) { setPinRow(null); setDiaryState("NEED_SETUP"); }
      else { setPinRow(data as PinRow); setDiaryState("NEED_UNLOCK"); }
      setBooting(false);
    })();
    return () => { alive = false; };
  }, []);

  /* ── Range (unchanged) ── */
  const range = useMemo(() => {
    const now = new Date();
    if (filterMode === "WEEK") {
      return { start: startOfWeek(now), end: endOfWeek(now), label: "This Week" };
    }
    const [yy, mm] = monthPick.split("-").map((x) => parseInt(x, 10));
    const s = startOfMonth(yy, mm - 1), e = endOfMonth(yy, mm - 1);
    return { start: s, end: e, label: s.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
  }, [filterMode, monthPick]);

  /* ── Load entries (unchanged) ── */
  useEffect(() => {
    if (!userId || diaryState !== "UNLOCKED") return;
    let alive = true;
    (async () => {
      setEntriesBusy(true);
      const { data, error } = await supabase
        .from("journal_entries").select("*").eq("user_id", userId)
        .gte("created_at", range.start.toISOString()).lte("created_at", range.end.toISOString())
        .order("created_at", { ascending: false });
      if (!alive) return;
      if (error) { console.error(error); setEntries([]); }
      else setEntries((data as JournalEntry[]) ?? []);
      setEntriesBusy(false);
    })();
    return () => { alive = false; };
  }, [userId, diaryState, range.start, range.end]);

  /* ── Filtered entries (unchanged) ── */
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
    );
  }, [entries, search]);

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const total    = entries.length;
    const thisWeek = entries.filter((e) => {
      const d = new Date(e.created_at);
      return d >= startOfWeek(new Date()) && d <= endOfWeek(new Date());
    }).length;
    const daySet = new Set(entries.map((e) => {
      const d = new Date(e.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }));
    let streak = 0;
    const cur = new Date();
    for (let i = 0; i < 365; i++) {
      if (daySet.has(`${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`)) {
        streak++; cur.setDate(cur.getDate() - 1);
      } else break;
    }
    return { total, thisWeek, streak, xp: total * 30 + streak * 10 };
  }, [entries]);

  /* ── PIN handlers (unchanged) ── */
  async function onSetupPin() {
    setPinMsg(null);
    const p1 = setupPin1.trim(), p2 = setupPin2.trim();
    if (p1.length !== 6 || p2.length !== 6) { setPinMsg("PIN must be exactly 6 digits."); return; }
    if (p1 !== p2) { setPinMsg("PIN confirmation does not match."); return; }
    if (!userId) return;
    setPinBusy(true);
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await pbkdf2(p1, salt);
      const payload = { user_id: userId, pin_salt: bytesToB64(salt), pin_hash: bytesToB64(hash), updated_at: new Date().toISOString() };
      const { error } = await supabase.from("diary_pin").upsert(payload, { onConflict: "user_id" });
      if (error) { console.error(error); setPinMsg(error.message); return; }
      setPinRow(payload as any); setDiaryState("UNLOCKED");
      setSetupPin1(""); setSetupPin2(""); setUnlockPin("");
      setPinMsg("Diary protected ✅"); setTimeout(() => setPinMsg(null), 1600);
    } finally { setPinBusy(false); }
  }
  async function onUnlock() {
    setPinMsg(null);
    if (!pinRow) return;
    const p = unlockPin.trim();
    if (p.length !== 6) { setPinMsg("Enter your 6-digit PIN."); return; }
    setPinBusy(true);
    try {
      const salt = b64ToBytes(pinRow.pin_salt), expected = b64ToBytes(pinRow.pin_hash);
      const got = await pbkdf2(p, salt);
      if (!constantTimeEqual(expected, got)) { setPinMsg("Wrong PIN. Try again."); return; }
      setDiaryState("UNLOCKED"); setUnlockPin("");
      setPinMsg("Unlocked ✨"); setTimeout(() => setPinMsg(null), 1000);
    } finally { setPinBusy(false); }
  }
  function resetCreate() { setTitle(""); setDesc(""); setFiles([]); setCreateType("TEXT"); }
  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    if      (createType === "VIDEO") setFiles(arr.slice(0, 1));
    else if (createType === "IMAGE") setFiles(arr.slice(0, 8));
    else setFiles([]);
  }
  async function uploadFilesToStorage(uid: string) {
    const paths: string[] = [];
    if (createType === "TEXT") return paths;
    if (files.length === 0) throw new Error(createType === "VIDEO" ? "Please upload a video." : "Please upload at least 1 image.");
    for (const f of files) {
      const ext  = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${uid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("journal-media").upload(path, f, {
        cacheControl: "3600", upsert: false, contentType: f.type || undefined,
      });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  }
  async function onCreateEntry() {
    if (!userId) return;
    const t = title.trim(), d = desc.trim();
    if (!t || !d) return;
    setCreateBusy(true);
    try {
      const media_paths = await uploadFilesToStorage(userId);
      const { error } = await supabase.from("journal_entries").insert(
        { user_id: userId, title: t, description: d, entry_type: createType, media_paths }
      );
      if (error) { console.error(error); return; }
      const { data } = await supabase.from("journal_entries").select("*").eq("user_id", userId)
        .gte("created_at", range.start.toISOString()).lte("created_at", range.end.toISOString())
        .order("created_at", { ascending: false });
      setEntries((data as JournalEntry[]) ?? []);
      setCreateOpen(false); resetCreate();
    } catch (e: any) { alert(e?.message ?? "Something went wrong"); }
    finally { setCreateBusy(false); }
  }
  async function openEntry(e: JournalEntry) {
    setViewEntry(e); setSignedUrls([]);
    if (e.entry_type === "TEXT" || e.media_paths.length === 0) return;
    setViewBusy(true);
    try {
      const urls: string[] = [];
      for (const p of e.media_paths) {
        const { data, error } = await supabase.storage.from("journal-media").createSignedUrl(p, 60 * 30);
        if (error) throw error;
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setSignedUrls(urls);
    } catch (err) { console.error(err); }
    finally { setViewBusy(false); }
  }

  const diaryLocked = diaryState !== "UNLOCKED";

  /* ── Skeleton ── */
  if (booting) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className={cx("rounded-3xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.10)]", BRAND_BG)}>
          <div className="text-2xl font-black tracking-tight text-white">Journal</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
          <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
        </div>
        <div className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
        <div className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className={cx("rounded-3xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.10)]", BRAND_BG)}>
          <div className="text-2xl font-black tracking-tight text-white">Journal</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">You're not authenticated right now.</p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">

      {/* ═══════════════ HEADER ═══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={cx("rounded-3xl p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.10)]", BRAND_BG)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.7, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.08 }}
              className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15"
            >
              <NotebookPen size={18} />
            </motion.div>
            <div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
                className="text-xs font-semibold text-white/80">Digital Diary</motion.div>
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.16 }}
                className="text-2xl font-black tracking-tight">Journal</motion.div>
            </div>
          </div>

          <AnimatePresence>
            {diaryState === "UNLOCKED" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 280 }}
                whileTap={{ scale: 0.95 }}
                whileHover={{ y: -1, backgroundColor: "rgba(255,255,255,0.25)" }}
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-extrabold text-white transition"
              >
                <Plus size={15} /> New Entry
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="mt-5 flex items-center gap-2">
          <TabBtn active={filterMode === "WEEK"}  label="This Week" onClick={() => setFilterMode("WEEK")} />
          <TabBtn active={filterMode === "MONTH"} label="By Month"  onClick={() => setFilterMode("MONTH")} />
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Search className="text-slate-400 shrink-0" size={18} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or description…" disabled={diaryLocked}
            className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none disabled:opacity-50"
          />
          <AnimatePresence>
            {search.trim().length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                type="button" onClick={() => setSearch("")}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Filter chips */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
          className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold text-white">
            <Filter size={13} /> Filter
          </span>
          <FlipChip label="Text"   icon={<Type size={13} />}      active={false} onClick={() => {}} />
          <FlipChip label="Images" icon={<ImageIcon size={13} />} active={false} onClick={() => {}} />
          <FlipChip label="Video"  icon={<VideoIcon size={13} />} active={false} onClick={() => {}} />
        </motion.div>
      </motion.div>

      {/* ═══════════════ ROW 1: PIN (left) + CALENDAR (right) ═══════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* ── PIN PROTECTION CARD ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          {/* Card header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-black text-slate-900">Diary Protection</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CardPill label="PIN Locked" icon={<Lock size={12} />} />
                <CardPill label="6-digit"    icon={<ShieldCheck size={12} />} />
              </div>
            </div>
            <motion.div
              animate={diaryState === "UNLOCKED" ? { rotate: [0, -15, 15, -8, 8, 0] } : {}}
              transition={{ duration: 0.55, delay: 0.15 }}
              className={cx(
                "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border transition",
                diaryState === "UNLOCKED"
                  ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                  : "border-slate-200 bg-white text-slate-500"
              )}
            >
              {diaryState === "UNLOCKED" ? <ShieldCheck size={18} /> : <Lock size={18} />}
            </motion.div>
          </div>

          {/* PIN forms */}
          <div className="mt-5">
            <AnimatePresence mode="wait">
              {diaryState === "NEED_SETUP" && (
                <motion.div key="setup"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}
                  className="space-y-3"
                >
                  <p className="text-xs font-semibold text-slate-500">First time? Create your 6-digit PIN:</p>
                  <div className="grid gap-1">
                    <label className="text-[11px] font-semibold text-slate-400">Enter PIN</label>
                    <input value={setupPin1} onChange={(e) => setSetupPin1(pinDigitsOnly(e.target.value))}
                      inputMode="numeric" placeholder="••••••"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-[11px] font-semibold text-slate-400">Confirm PIN</label>
                    <input value={setupPin2} onChange={(e) => setSetupPin2(pinDigitsOnly(e.target.value))}
                      inputMode="numeric" placeholder="••••••"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    />
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }}
                    disabled={pinBusy} onClick={onSetupPin}
                    className={cx("mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-extrabold text-white transition hover:opacity-95 disabled:opacity-60", BRAND_BG)}
                  >
                    {pinBusy ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
                    Protect My Diary
                  </motion.button>
                </motion.div>
              )}

              {diaryState === "NEED_UNLOCK" && (
                <motion.div key="unlock"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}
                  className="space-y-3"
                >
                  <p className="text-xs font-semibold text-slate-500">Enter your PIN to unlock:</p>
                  <input value={unlockPin} onChange={(e) => setUnlockPin(pinDigitsOnly(e.target.value))}
                    inputMode="numeric" placeholder="••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                  <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }}
                    disabled={pinBusy} onClick={onUnlock}
                    className={cx("inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-extrabold text-white transition hover:opacity-95 disabled:opacity-60", BRAND_BG)}
                  >
                    {pinBusy ? <Loader2 className="animate-spin" size={15} /> : <Lock size={15} />}
                    Unlock Diary
                  </motion.button>
                </motion.div>
              )}

              {diaryState === "UNLOCKED" && (
                <motion.div key="unlocked"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
                  className="space-y-3"
                >
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-extrabold text-cyan-900">
                    <CheckCircle2 size={16} className="text-cyan-600" /> Diary Unlocked ✅
                  </div>
                  <p className="text-xs font-semibold text-slate-400">
                    Media stays private — accessed via signed links only.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {pinMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-xs font-semibold text-cyan-900"
                >
                  {pinMsg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── CALENDAR CARD (right of PIN) ── */}
        <MiniCalendarCard
          entries={entries}
          diaryLocked={diaryLocked}
          setFilterMode={setFilterMode}
          setMonthPick={setMonthPick}
        />
      </div>

      {/* ═══════════════ ROW 2: MERGED STATS + QUOTE ═══════════════ */}
      <StatsAndQuoteCard stats={stats} diaryLocked={diaryLocked} />

      {/* ═══════════════ ROW 3: GALLERY (full width) ═══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.38 }}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-black text-slate-900">Gallery</div>
            <div className="text-sm font-semibold text-slate-500">
              {range.label} · {filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <AnimatePresence mode="wait">
            {/* locked */}
            {diaryLocked ? (
              <motion.div key="gallery-locked"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-3xl border border-slate-100 bg-slate-50 p-12 text-center"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-600"
                >
                  <Lock size={22} />
                </motion.div>
                <div className="mt-4 text-xl font-black text-slate-900">Diary locked</div>
                <div className="mt-2 text-sm font-semibold text-slate-500">
                  Enter your PIN above to see your journal entries.
                </div>
              </motion.div>

            /* loading */
            ) : entriesBusy ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-slate-50"
                  />
                ))}
              </motion.div>

            /* empty */
            ) : filteredEntries.length === 0 ? (
              <motion.div key="empty"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-3xl border border-slate-100 bg-white p-12 text-center"
              >
                <motion.div
                  animate={{ rotate: [0, -6, 6, -4, 4, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2.5 }}
                  className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"
                >
                  <NotebookPen size={22} />
                </motion.div>
                <div className="mt-4 text-xl font-black text-slate-900">No entries yet</div>
                <div className="mt-2 text-sm font-semibold text-slate-500">
                  Create your first journal entry — text, images, or video.
                </div>
                <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }}
                  type="button" onClick={() => setCreateOpen(true)}
                  className={cx("mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white transition hover:opacity-95", BRAND_BG)}
                >
                  <Plus size={17} /> New Entry
                </motion.button>
              </motion.div>

            /* entries grid */
            ) : (
              <motion.div layout key="grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {filteredEntries.map((e, idx) => (
                    <motion.div
                      key={e.id} layout
                      initial={{ opacity: 0, y: 14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.97 }}
                      transition={{ duration: 0.22, delay: idx * 0.04 }}
                      whileHover={{ y: -3, boxShadow: "0 14px 30px rgba(8,145,178,0.12)" }}
                      className="group cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                      onClick={() => openEntry(e)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-slate-900">{e.title}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <CardPill label={e.entry_type} icon={<IconForType t={e.entry_type} />} />
                            {e.media_paths?.length > 0 && (
                              <CardPill
                                label={`${e.media_paths.length} file${e.media_paths.length > 1 ? "s" : ""}`}
                                icon={e.entry_type === "IMAGE" ? <ImageIcon size={12} /> : <VideoIcon size={12} />}
                              />
                            )}
                          </div>
                        </div>
                        <motion.div
                          whileHover={{ rotate: 12, scale: 1.1 }}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 group-hover:border-cyan-200 group-hover:bg-cyan-50 group-hover:text-cyan-700 transition"
                        >
                          <BookOpenText size={16} />
                        </motion.div>
                      </div>

                      <div className="mt-4 flex items-center text-xs text-slate-500">
                        <Clock size={12} className="mr-1.5 text-slate-400 shrink-0" />
                        <span className="font-semibold">{fmtShort(e.created_at)}</span>
                      </div>

                      <div className="mt-2 line-clamp-2 text-xs font-semibold text-slate-400">
                        {e.description}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400">Tap to view</span>
                        <motion.button
                          whileTap={{ scale: 0.95 }} type="button"
                          onClick={(ev) => { ev.stopPropagation(); openEntry(e); }}
                          className={cx("inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-extrabold text-white transition hover:opacity-90", BRAND_BG)}
                        >
                          <BookOpenText size={13} /> Open
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ═══════════════ CREATE MODAL ═══════════════ */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => { if (!createBusy) { setCreateOpen(false); resetCreate(); } }}
            />
            <motion.div
              initial={{ opacity: 0, y: 44, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 44, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="relative w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl max-h-[92vh]"
            >
              <div className={cx("h-1.5 w-full rounded-t-3xl", BRAND_BG)} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-black text-slate-900">New Journal Entry</div>
                    <div className="mt-1 text-sm font-semibold text-slate-500">
                      Choose a type, then write your title and description.
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.88, rotate: 90 }}
                    onClick={() => { if (!createBusy) { setCreateOpen(false); resetCreate(); } }}
                    className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                  >
                    <X size={17} />
                  </motion.button>
                </div>

                {/* Type picker */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {([
                    { type: "TEXT"  as EntryType, label: "Text",   icon: <Type size={17} />,      sub: "Write your thoughts" },
                    { type: "IMAGE" as EntryType, label: "Images", icon: <ImageIcon size={17} />, sub: "Photos & memories"    },
                    { type: "VIDEO" as EntryType, label: "Video",  icon: <VideoIcon size={17} />, sub: "Mini vlog"            },
                  ]).map(({ type, label, icon, sub }, i) => {
                    const active = createType === type;
                    return (
                      <motion.button
                        key={type} type="button"
                        onClick={() => { setCreateType(type); setFiles([]); }}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileTap={{ scale: 0.96 }} whileHover={{ y: -2 }}
                        aria-pressed={active}
                        className={cx(
                          "relative flex flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition shadow-sm",
                          active
                            ? "border-cyan-500/40 bg-cyan-600 text-white shadow-[0_6px_20px_rgba(8,145,178,0.32)]"
                            : cx("border-slate-200", BRAND_BG_SOFT, "text-slate-800 hover:border-cyan-200")
                        )}
                      >
                        <motion.div
                          animate={{ rotateY: active ? 360 : 0 }} transition={{ duration: 0.4 }}
                          className={cx(
                            "grid h-9 w-9 place-items-center rounded-xl",
                            active ? "bg-white/20 text-white" : "bg-white border border-slate-200 text-cyan-700"
                          )}
                        >
                          {icon}
                        </motion.div>
                        <div>
                          <div className={cx("text-xs font-extrabold", active ? "text-white" : "text-slate-800")}>{label}</div>
                          <div className={cx("text-[10px] font-semibold", active ? "text-white/75" : "text-slate-400")}>{sub}</div>
                        </div>
                        {active && (
                          <motion.div layoutId="type-dot"
                            className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-white/80" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-3">
                  <div className="grid gap-1">
                    <label className="text-[11px] font-semibold text-slate-400">Title</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., A calmer day today"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-[11px] font-semibold text-slate-400">Description</label>
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                      placeholder="Write what happened, how you felt, what you learned…"
                      className="min-h-[110px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition"
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    {(createType === "IMAGE" || createType === "VIDEO") && (
                      <MediaCaptureSection
                        createType={createType} files={files}
                        onPickFiles={onPickFiles}
                        fileInputRef={fileInputRef}
                        cameraInputRef={cameraInputRef}
                      />
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }}
                    disabled={createBusy || diaryState !== "UNLOCKED" || !title.trim() || !desc.trim()}
                    onClick={onCreateEntry}
                    className={cx(
                      "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed",
                      BRAND_BG
                    )}
                  >
                    {createBusy
                      ? <><Loader2 className="animate-spin" size={17} /> Saving…</>
                      : <><Plus size={17} /> Save Entry</>
                    }
                  </motion.button>
                  <p className="text-center text-[11px] text-slate-400">
                    Media is stored privately in Supabase Storage and accessed via signed links.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ VIEW MODAL ═══════════════ */}
      <AnimatePresence>
        {viewEntry && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setViewEntry(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="relative w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl max-h-[92vh]"
            >
              <div className={cx("h-1.5 w-full rounded-t-3xl", BRAND_BG)} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }} whileHover={{ x: -2 }}
                    type="button" onClick={() => setViewEntry(null)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50 transition"
                  >
                    <ArrowLeft size={14} /> Back
                  </motion.button>
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700">
                    <IconForType t={viewEntry.entry_type} />{viewEntry.entry_type}
                  </span>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }} className="mt-5"
                >
                  <div className="text-2xl font-black tracking-tight text-slate-900">{viewEntry.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CardPill label={fmtDate(viewEntry.created_at)} icon={<Clock size={12} />} />
                    {viewEntry.media_paths?.length > 0 && (
                      <CardPill
                        label={`${viewEntry.media_paths.length} file${viewEntry.media_paths.length > 1 ? "s" : ""}`}
                        icon={viewEntry.entry_type === "IMAGE" ? <ImageIcon size={12} /> : <VideoIcon size={12} />}
                      />
                    )}
                  </div>

                  <div className="mt-5 whitespace-pre-line rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-800">
                    {viewEntry.description}
                  </div>

                  <AnimatePresence>
                    {viewEntry.entry_type !== "TEXT" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} transition={{ delay: 0.15 }}
                        className="mt-4"
                      >
                        {viewBusy ? (
                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                            <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                              <Loader2 className="animate-spin" size={17} /> Loading private media…
                            </div>
                          </div>
                        ) : viewEntry.entry_type === "IMAGE" ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {signedUrls.map((u, i) => (
                              <motion.div key={i}
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.08 }}
                                className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={u} alt={`journal image ${i + 1}`} className="h-64 w-full object-cover" />
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                            className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
                          >
                            <video controls className="w-full" src={signedUrls[0]} />
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}