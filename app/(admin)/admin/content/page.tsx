"use client";

import { useEffect, useState, useCallback, useRef, FC, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, Pencil, Trash2, Loader2, BookOpen, NotebookPen, Trophy,
  Tag, Calendar, Eye, Bookmark, CheckCircle2, XCircle, BarChart3,
  Zap, ChevronDown, FileText, Video, Sparkles, FileSpreadsheet,
  Link2, Circle, Archive, ChevronLeft, ChevronRight, CalendarRange,
  Wand2, X, RefreshCw, Database, Brain,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type EIResource = {
  id: string; title: string; description: string; content: string | null;
  category: string; pillar: string; type: string; status: string;
  publish_date: string; view_count: number; bookmark_count: number;
  resource_url: string | null; created_at: string;
};

type JournalQuote = {
  id: string; quote: string; author: string;
  publish_date_from: string; publish_date_to: string;
  is_active: boolean; created_at: string;
};

type Mission = {
  id: string; title: string; description: string;
  activity_key: string; xp_reward: number; is_active: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TOPICS: { id: string; label: string }[] = [
  { id: "productivity",  label: "Productivity"    },
  { id: "confidence",    label: "Confidence"      },
  { id: "anger",         label: "Anger"           },
  { id: "anxiety",       label: "Anxiety"         },
  { id: "people",        label: "People-pleasing" },
  { id: "relationships", label: "Relationships"   },
  { id: "selflove",      label: "Self-love"       },
  { id: "parenting",     label: "Parenting"       },
];
const TOPIC_LABELS: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.id, t.label]));
const RESOURCE_TYPES: { key: string; label: string; icon: ReactNode }[] = [
  { key: "ARTICLE",         label: "Article",         icon: <FileText        size={14} /> },
  { key: "VIDEO",           label: "Video",           icon: <Video           size={14} /> },
  { key: "GUIDED_EXERCISE", label: "Guided Exercise", icon: <Sparkles        size={14} /> },
  { key: "WORKSHEET",       label: "Worksheet",       icon: <FileSpreadsheet size={14} /> },
];
const LINK_REQUIRED_TYPES = ["ARTICLE", "VIDEO"];
const RESOURCE_STATUSES: { key: string; label: string; icon: ReactNode; cls: string }[] = [
  { key: "PUBLISHED", label: "Published", icon: <CheckCircle2 size={14} />, cls: "text-emerald-600" },
  { key: "DRAFT",     label: "Draft",     icon: <Circle       size={14} />, cls: "text-amber-500"   },
  { key: "ARCHIVED",  label: "Archived",  icon: <Archive      size={14} />, cls: "text-slate-400"   },
];
const EMPTY_RESOURCE = { title: "", description: "", content: "", category: "productivity", type: "ARTICLE", status: "PUBLISHED", resource_url: "" };
const todayStr = new Date().toISOString().slice(0, 10);
const EMPTY_QUOTE = { quote: "", author: "", publish_date_from: todayStr, publish_date_to: todayStr, is_active: false };

// ─── Calendar helpers ─────────────────────────────────────────────────────────
const CAL_DAY_NAMES   = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const CAL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function buildCalendarGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let i = 1; i <= daysIn; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ─── Click-outside hook ───────────────────────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) handler(); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [ref, handler]);
}
const OutsideWrapper: FC<{ children: ReactNode; onClose: () => void; className?: string }> = ({ children, onClose, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);
  return <div ref={ref} className={className}>{children}</div>;
};

// ─── Generic Animated Dropdown ────────────────────────────────────────────────
type DropdownOption = { key: string; label: string; icon?: ReactNode; pillCls?: string };
function AnimatedDropdown({ value, options, onChange, placeholder }: { value: string; options: DropdownOption[]; onChange: (val: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  return (
    <OutsideWrapper onClose={() => setOpen(false)} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-cyan-300 transition">
        <span className="flex items-center gap-2 truncate">{selected?.icon}<span className={selected?.pillCls}>{selected?.label ?? placeholder ?? "Select…"}</span></span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
          <ChevronDown size={15} className="text-slate-400" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="listbox" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.18 }}
            className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
              {options.map((opt) => (
                <motion.button key={opt.key} type="button" role="option"
                  variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }}
                  onClick={() => { onChange(opt.key); setOpen(false); }}
                  className={["flex w-full items-center gap-2.5 border-b border-slate-100 last:border-b-0 px-3 py-2.5 text-sm font-semibold transition-colors",
                    opt.key === value ? "bg-cyan-50 text-cyan-700" : "bg-white text-slate-700 hover:bg-slate-50"].join(" ")}>
                  {opt.icon && <span className={opt.key === value ? "text-cyan-600" : opt.pillCls ?? "text-slate-400"}>{opt.icon}</span>}
                  <span>{opt.label}</span>
                  {opt.key === value && <CheckCircle2 size={13} className="ml-auto text-cyan-500" />}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OutsideWrapper>
  );
}

// ─── Inline Range Calendar Picker ─────────────────────────────────────────────
// Single calendar: 1st click = start date, 2nd click = end date, with live hover preview
function RangeCalendarPicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const now = new Date();
  const [calYear,  setCalYear]  = useState(() => ymdToDate(from).getFullYear());
  const [calMonth, setCalMonth] = useState(() => ymdToDate(from).getMonth());
  const [dir,      setDir]      = useState(0);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  // "from" = waiting for start click, "to" = waiting for end click
  const [stage,    setStage]    = useState<"from" | "to">("from");

  const fromDate = ymdToDate(from);
  const toDate   = ymdToDate(to);
  const cells    = buildCalendarGrid(calYear, calMonth);

  function prevMonth() { setDir(-1); if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }
  function nextMonth() { setDir(1);  if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }

  function handleDayClick(day: number) {
    const clicked    = new Date(calYear, calMonth, day);
    const clickedStr = dateToYmd(clicked);
    if (stage === "from") {
      onChange(clickedStr, clickedStr);
      setStage("to");
    } else {
      if (clicked < fromDate) {
        onChange(clickedStr, from);
      } else {
        onChange(from, clickedStr);
      }
      setStage("from");
      setHoverDay(null);
    }
  }

  function getEffectiveTo(): Date {
    if (stage === "to" && hoverDay !== null) {
      const h = new Date(calYear, calMonth, hoverDay);
      return h > fromDate ? h : fromDate;
    }
    return toDate;
  }
  const effectiveTo = getEffectiveTo();

  function isFromDay(day: number)  { return new Date(calYear, calMonth, day).getTime() === fromDate.getTime(); }
  function isToDay(day: number)    { return new Date(calYear, calMonth, day).getTime() === effectiveTo.getTime(); }
  function isInRange(day: number)  { const d = new Date(calYear, calMonth, day); return d > fromDate && d < effectiveTo; }
  function isTodayDay(day: number) { return now.getFullYear() === calYear && now.getMonth() === calMonth && now.getDate() === day; }

  return (
    <div className="rounded-xl border border-cyan-200 bg-white overflow-hidden select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between px-3 py-2 bg-cyan-50 border-b border-cyan-100">
        <motion.button type="button" onClick={prevMonth} whileTap={{ scale: 0.88 }}
          className="grid h-6 w-6 place-items-center rounded-lg border border-cyan-200 bg-white text-cyan-600 hover:bg-cyan-100 transition">
          <ChevronLeft size={12} />
        </motion.button>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={`${calYear}-${calMonth}`} custom={dir}
            initial={{ opacity: 0, x: dir * 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -14 }} transition={{ duration: 0.13 }}
            className="text-xs font-extrabold text-cyan-800">{CAL_MONTH_NAMES[calMonth]} {calYear}</motion.div>
        </AnimatePresence>
        <motion.button type="button" onClick={nextMonth} whileTap={{ scale: 0.88 }}
          className="grid h-6 w-6 place-items-center rounded-lg border border-cyan-200 bg-white text-cyan-600 hover:bg-cyan-100 transition">
          <ChevronRight size={12} />
        </motion.button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {CAL_DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[9px] font-extrabold text-slate-400 pb-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={`rcal-${calYear}-${calMonth}`} custom={dir}
          initial={{ opacity: 0, x: dir * 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -14 }} transition={{ duration: 0.14 }}
          className="grid grid-cols-7 px-2 pb-2">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="h-8 w-full" />;
            const fromCell = isFromDay(day);
            const toCell   = isToDay(day);
            const inRange  = isInRange(day);
            const todayCell = isTodayDay(day);
            const isSingleDay = fromDate.getTime() === effectiveTo.getTime();
            return (
              <div key={idx} className="relative flex items-center justify-center h-8"
                onMouseEnter={() => stage === "to" && setHoverDay(day)}
                onMouseLeave={() => stage === "to" && setHoverDay(null)}>
                {/* Range fill */}
                {inRange && <div className="absolute inset-y-1 left-0 right-0 bg-cyan-100" />}
                {/* Start cap — only show strip if range > single day */}
                {fromCell && !isSingleDay && <div className="absolute inset-y-1 left-1/2 right-0 bg-cyan-100" />}
                {/* End cap */}
                {toCell && !fromCell && <div className="absolute inset-y-1 left-0 right-1/2 bg-cyan-100" />}
                <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={() => handleDayClick(day)}
                  className={["relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition",
                    (fromCell || toCell)
                      ? "bg-cyan-600 text-white shadow-sm"
                      : todayCell
                      ? "ring-2 ring-cyan-400 text-cyan-700 font-extrabold"
                      : inRange
                      ? "text-cyan-800 hover:bg-cyan-200"
                      : "text-slate-600 hover:bg-slate-100"].join(" ")}>
                  {day}
                </motion.button>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Footer */}
      <div className="px-3 pb-2.5 pt-1 border-t border-cyan-100 bg-cyan-50 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-cyan-700">
          {stage === "from" ? "① Click to set start date" : "② Click to set end date"}
        </span>
        <span className="text-[10px] font-bold text-cyan-600">
          {from === to ? from : `${from} → ${to}`}
        </span>
      </div>
    </div>
  );
}

// ─── Sidebar Quote Calendar (range-aware) ─────────────────────────────────────
function QuotesCalendar({ quotes, onMonthChange }: { quotes: JournalQuote[]; onMonthChange: (year: number, month: number) => void }) {
  const now = new Date();
  const [calYear,  setCalYear]  = useState(() => now.getFullYear());
  const [calMonth, setCalMonth] = useState(() => now.getMonth());
  const [dir,      setDir]      = useState(0);
  const cells = buildCalendarGrid(calYear, calMonth);

  const rangeDays = new Set<number>(); const activeRangeDays = new Set<number>();
  const rangeStartDays = new Set<number>(); const rangeEndDays = new Set<number>();
  quotes.forEach((q) => {
    const from = ymdToDate(q.publish_date_from); const to = ymdToDate(q.publish_date_to);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(calYear, calMonth, d);
      if (cellDate >= from && cellDate <= to) { rangeDays.add(d); if (q.is_active) activeRangeDays.add(d); }
    }
    if (from.getFullYear() === calYear && from.getMonth() === calMonth) rangeStartDays.add(from.getDate());
    if (to.getFullYear()   === calYear && to.getMonth()   === calMonth) rangeEndDays.add(to.getDate());
  });

  function prevMonth() { setDir(-1); const nm = calMonth === 0 ? 11 : calMonth - 1; const ny = calMonth === 0 ? calYear - 1 : calYear; setCalMonth(nm); setCalYear(ny); onMonthChange(ny, nm); }
  function nextMonth() { setDir(1);  const nm = calMonth === 11 ? 0 : calMonth + 1; const ny = calMonth === 11 ? calYear + 1 : calYear; setCalMonth(nm); setCalYear(ny); onMonthChange(ny, nm); }

  const quotesThisMonth = quotes.filter((q) => {
    const from = ymdToDate(q.publish_date_from); const to = ymdToDate(q.publish_date_to);
    return from <= new Date(calYear, calMonth + 1, 0) && to >= new Date(calYear, calMonth, 1);
  });
  const activeThisMonth = quotesThisMonth.filter((q) => q.is_active).length;
  const isToday = (day: number) => now.getDate() === day && now.getMonth() === calMonth && now.getFullYear() === calYear;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-50"><CalendarRange size={13} className="text-cyan-600" /></div>
        <div>
          <div className="text-sm font-extrabold text-slate-900">Quote Calendar</div>
          <div className="text-[10px] font-semibold text-slate-400">{quotesThisMonth.length} quote{quotesThisMonth.length !== 1 ? "s" : ""} · {activeThisMonth} active</div>
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <motion.button type="button" onClick={prevMonth} whileTap={{ scale: 0.88 }}
          className="grid h-6 w-6 place-items-center rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 transition">
          <ChevronLeft size={12} />
        </motion.button>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={`${calYear}-${calMonth}`} custom={dir} initial={{ opacity: 0, x: dir * 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -16 }} transition={{ duration: 0.16 }}
            className="text-xs font-extrabold text-slate-800">{CAL_MONTH_NAMES[calMonth]} {calYear}</motion.div>
        </AnimatePresence>
        <motion.button type="button" onClick={nextMonth} whileTap={{ scale: 0.88 }}
          className="grid h-6 w-6 place-items-center rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 transition">
          <ChevronRight size={12} />
        </motion.button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {CAL_DAY_NAMES.map((d) => <div key={d} className="text-center text-[9px] font-extrabold text-slate-400 py-0.5">{d}</div>)}
      </div>
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={`cal-${calYear}-${calMonth}`} custom={dir} initial={{ opacity: 0, x: dir * 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -18 }} transition={{ duration: 0.18 }}
          className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="h-7 w-full" />;
            const todayCell = isToday(day); const inRange = rangeDays.has(day); const inActiveRange = activeRangeDays.has(day);
            const isStart = rangeStartDays.has(day); const isEnd = rangeEndDays.has(day);
            return (
              <div key={idx} className="relative flex items-center justify-center h-7">
                {inRange && !isStart && !isEnd && <div className={`absolute inset-y-1 left-0 right-0 ${inActiveRange ? "bg-emerald-100" : "bg-slate-100"}`} />}
                {isStart && !isEnd && <div className={`absolute inset-y-1 left-1/2 right-0 ${inActiveRange ? "bg-emerald-100" : "bg-slate-100"}`} />}
                {isEnd && !isStart && <div className={`absolute inset-y-1 left-0 right-1/2 ${inActiveRange ? "bg-emerald-100" : "bg-slate-100"}`} />}
                <div className={["relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold select-none transition",
                  todayCell ? "bg-cyan-600 text-white shadow-sm" : (isStart || isEnd) && inActiveRange ? "bg-emerald-500 text-white" : (isStart || isEnd) ? "bg-slate-400 text-white" : inActiveRange ? "text-emerald-800" : inRange ? "text-slate-600" : "text-slate-400"].join(" ")}>
                  {day}
                </div>
                {todayCell && (
                  <motion.span className="absolute inset-0 z-20 rounded-full border-2 border-cyan-400/60 w-6 h-6 m-auto"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }} transition={{ duration: 2.4, repeat: Infinity }} />
                )}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
      <div className="mt-3 flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400"><span className="h-2 w-2 rounded-full bg-cyan-600 inline-block" />Today</span>
        <span className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />Active range</span>
        <span className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400"><span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />Inactive range</span>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminContentPage() {
  const router = useRouter(); const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "resources";
  const [activeTab,   setActiveTab]   = useState(tabParam);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }
      const md: any = session.user.user_metadata || {};
      if (String(md?.role).toUpperCase() !== "ADMIN") { router.push("/post-login"); return; }
      setAuthChecked(true);
    }
    check();
  }, [router]);

  useEffect(() => { setActiveTab(tabParam); }, [tabParam]);
  function goTab(tab: string) { setActiveTab(tab); router.push(`/admin/content?tab=${tab}`); }

  if (!authChecked) return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-600">Loading...</p></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Content Management</h1>
        <p className="mt-1 text-sm text-slate-500">Manage EI resources, journal quotes and gamification content.</p>
      </div>
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: "resources",    label: "EI Resources",   icon: <BookOpen    size={15} /> },
          { key: "journal",      label: "Journal Quotes", icon: <NotebookPen size={15} /> },
          { key: "gamification", label: "Gamification",   icon: <Trophy      size={15} /> },
        ].map((t) => (
          <button key={t.key} type="button" onClick={() => goTab(t.key)}
            className={["inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold border-b-2 transition -mb-px",
              activeTab === t.key ? "border-cyan-500 text-cyan-600" : "border-transparent text-slate-500 hover:text-slate-700"].join(" ")}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {activeTab === "resources"    && <EIResourcesTab />}
      {activeTab === "journal"      && <JournalQuotesTab />}
      {activeTab === "gamification" && <GamificationTab />}
    </div>
  );
}

// ─── EI Resources Tab ─────────────────────────────────────────────────────────
function EIResourcesTab() {
  const [resources, setResources] = useState<EIResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_RESOURCE);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [filterTopic, setFilterTopic] = useState("ALL");
  const [aiOpen, setAiOpen] = useState(false);
  const needsLink = LINK_REQUIRED_TYPES.includes(form.type);

  const fetchResources = useCallback(async () => {
    const { data } = await supabase.from("ei_resources").select("*").order("created_at", { ascending: false });
    setResources(data ?? []); setLoading(false);
  }, []);
  useEffect(() => { fetchResources(); }, [fetchResources]);

  function openCreate() { setEditingId(null); setForm(EMPTY_RESOURCE); setMsg(null); setShowForm(true); }
  function openEdit(r: EIResource) {
    setEditingId(r.id);
    setForm({ title: r.title, description: r.description, content: r.content ?? "", category: r.category, type: r.type, status: r.status, resource_url: r.resource_url ?? "" });
    setMsg(null); setShowForm(true);
  }
  async function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) { setMsg({ text: "Title and description are required.", type: "error" }); return; }
    if (needsLink && !form.resource_url.trim()) { setMsg({ text: `A link is required for ${form.type === "ARTICLE" ? "Article" : "Video"}.`, type: "error" }); return; }
    setSaving(true);
    const payload = { title: form.title.trim(), description: form.description.trim(), content: form.content.trim() || null, category: form.category, pillar: "KNOW_YOURSELF", type: form.type, status: form.status, publish_date: new Date().toISOString().slice(0, 10), resource_url: needsLink ? form.resource_url.trim() : null, updated_at: new Date().toISOString() };
    if (editingId) { const { error } = await supabase.from("ei_resources").update(payload).eq("id", editingId); if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; } }
    else { const { error } = await supabase.from("ei_resources").insert(payload); if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; } }
    await fetchResources(); setShowForm(false); setEditingId(null); setForm(EMPTY_RESOURCE); setSaving(false);
    setMsg({ text: editingId ? "Resource updated." : "Resource created.", type: "success" });
  }
  async function handleDelete(id: string) {
    if (!confirm("Delete this resource?")) return; setDeletingId(id);
    await supabase.from("ei_resources").delete().eq("id", id); await fetchResources(); setDeletingId(null);
  }
  const filtered = filterTopic === "ALL" ? resources : resources.filter((r) => r.category === filterTopic);
  const statusMeta = (key: string) => RESOURCE_STATUSES.find((s) => s.key === key);
  const typeMeta   = (key: string) => RESOURCE_TYPES.find((t) => t.key === key);
  if (loading) return <div className="text-sm text-slate-500">Loading resources...</div>;
  const typeOptions:   DropdownOption[] = RESOURCE_TYPES.map((t) => ({ key: t.key, label: t.label, icon: t.icon }));
  const statusOptions: DropdownOption[] = RESOURCE_STATUSES.map((s) => ({ key: s.key, label: s.label, icon: s.icon, pillCls: s.cls }));
  const topicOptions:  DropdownOption[] = TOPICS.map((t) => ({ key: t.id, label: t.label }));

  return (
    <div className="space-y-4">
      <AIGeneratorModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onPublished={() => { fetchResources(); setMsg({ text: "✨ AI-generated resource published!", type: "success" }); }}
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {[{ id: "ALL", label: "All" }, ...TOPICS].map((t) => (
            <button key={t.id} type="button" onClick={() => setFilterTopic(t.id)}
              className={["rounded-xl px-3 py-1.5 text-xs font-extrabold transition", filterTopic === t.id ? "bg-cyan-500 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-cyan-500 to-sky-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-95 transition">
            <Wand2 size={14} /> Generate with AI
          </button>
          <button type="button" onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <Plus size={14} /> Add Resource
          </button>
        </div>
      </div>
      {msg && !showForm && <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{msg.text}</div>}
      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 text-sm font-extrabold text-slate-900">{editingId ? "Edit Resource" : "Add New Resource"}</div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="text-xs font-bold text-slate-500 block mb-1.5">Title *</label><input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Resource title..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" /></div>
              <div><label className="text-xs font-bold text-slate-500 block mb-1.5">Content Type</label><AnimatedDropdown value={form.type} options={typeOptions} onChange={(val) => setForm((p) => ({ ...p, type: val, resource_url: "" }))} /></div>
            </div>
            <AnimatePresence>
              {needsLink && (
                <motion.div key="link-field" initial={{ opacity: 0, height: 0, y: -4 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: -4 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-700 mb-1.5"><Link2 size={12} />{form.type === "ARTICLE" ? "Article URL" : "Video URL"}<span className="text-rose-500">*</span></label>
                    <input value={form.resource_url} onChange={(e) => setForm((p) => ({ ...p, resource_url: e.target.value }))} placeholder={form.type === "ARTICLE" ? "https://example.com/article" : "https://youtube.com/watch?v=..."} className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div><label className="text-xs font-bold text-slate-500 block mb-1.5">Description *</label><textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Brief description..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none" /></div>
            <div><label className="text-xs font-bold text-slate-500 block mb-1.5">Content <span className="font-normal text-slate-400">(optional)</span></label><textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} rows={4} placeholder="Full content..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="text-xs font-bold text-slate-500 block mb-1.5">Topic</label><AnimatedDropdown value={form.category} options={topicOptions} onChange={(val) => setForm((p) => ({ ...p, category: val }))} /></div>
              <div><label className="text-xs font-bold text-slate-500 block mb-1.5">Status</label><AnimatedDropdown value={form.status} options={statusOptions} onChange={(val) => setForm((p) => ({ ...p, status: val }))} /></div>
            </div>
          </div>
          {msg && <p className={`mt-3 text-sm font-semibold ${msg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>{msg.text}</p>}
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={handleSubmit} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition">{saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Saving..." : editingId ? "Update" : "Publish"}</button>
            <button type="button" onClick={() => { setShowForm(false); setMsg(null); }} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
          </div>
        </section>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[{ label: "Total", value: resources.length, icon: <BookOpen size={14} />, color: "text-slate-600 bg-slate-50" }, { label: "Published", value: resources.filter((r) => r.status === "PUBLISHED").length, icon: <CheckCircle2 size={14} />, color: "text-emerald-600 bg-emerald-50" }, { label: "Archived", value: resources.filter((r) => r.status === "ARCHIVED").length, icon: <XCircle size={14} />, color: "text-slate-400 bg-slate-50" }].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className={`inline-flex h-7 w-7 place-items-center grid rounded-lg ${s.color} mb-2`}>{s.icon}</div>
            <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs font-bold text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100"><div className="text-sm font-extrabold text-slate-900">{filtered.length} resources</div></div>
        {filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">No resources yet.</div> : (
          <div className="divide-y divide-slate-100">
            {filtered.map((r) => { const sm = statusMeta(r.status); const tm = typeMeta(r.type); return (
              <div key={r.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <div className="text-sm font-extrabold text-slate-900">{r.title}</div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-600">{tm?.icon}{tm?.label ?? r.type}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${r.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : r.status === "DRAFT" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{sm?.icon}{sm?.label ?? r.status}</span>
                    <span className="inline-flex items-center rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-extrabold text-cyan-700"><Tag size={8} className="mr-1" />{TOPIC_LABELS[r.category] ?? r.category}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{r.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1"><Eye size={10} />{r.view_count}</span>
                    <span className="inline-flex items-center gap-1"><Bookmark size={10} />{r.bookmark_count}</span>
                    <span className="inline-flex items-center gap-1"><Calendar size={10} />{r.publish_date}</span>
                    {r.resource_url && <span className="inline-flex items-center gap-1 text-cyan-500"><Link2 size={10} /> Link attached</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => openEdit(r)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"><Pencil size={13} /></button>
                  <button type="button" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id} className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50 transition">{deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>
                </div>
              </div>
            ); })}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Journal Quotes Tab ───────────────────────────────────────────────────────
function JournalQuotesTab() {
  const [quotes,     setQuotes]     = useState<JournalQuote[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [form,       setForm]       = useState(EMPTY_QUOTE);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg,        setMsg]        = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [calYear,    setCalYear]    = useState(() => new Date().getFullYear());
  const [calMonth,   setCalMonth]   = useState(() => new Date().getMonth());

  const fetchQuotes = useCallback(async () => {
    const { data } = await supabase.from("journal_quotes").select("*").order("publish_date_from", { ascending: false });
    setQuotes(data ?? []); setLoading(false);
  }, []);
  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  function openCreate() { setEditingId(null); setForm(EMPTY_QUOTE); setMsg(null); setShowForm(true); }
  function openEdit(q: JournalQuote) {
    setEditingId(q.id);
    setForm({ quote: q.quote, author: q.author, publish_date_from: q.publish_date_from, publish_date_to: q.publish_date_to, is_active: q.is_active });
    setMsg(null); setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.quote.trim()) { setMsg({ text: "Quote text is required.", type: "error" }); return; }
    if (form.publish_date_from > form.publish_date_to) { setMsg({ text: "Start date must be on or before end date.", type: "error" }); return; }
    setSaving(true);

    // Enforce only 1 active quote at a time
    if (form.is_active) {
      const otherIds = quotes.filter((q) => q.is_active && q.id !== editingId).map((q) => q.id);
      if (otherIds.length > 0) await supabase.from("journal_quotes").update({ is_active: false }).in("id", otherIds);
    }

    const payload = { quote: form.quote.trim(), author: form.author.trim() || "Unknown", publish_date_from: form.publish_date_from, publish_date_to: form.publish_date_to, is_active: form.is_active };
    if (editingId) { const { error } = await supabase.from("journal_quotes").update(payload).eq("id", editingId); if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; } }
    else { const { error } = await supabase.from("journal_quotes").insert(payload); if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; } }
    await fetchQuotes(); setShowForm(false); setEditingId(null); setForm(EMPTY_QUOTE); setSaving(false);
    setMsg({ text: editingId ? "Quote updated." : "Quote added.", type: "success" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this quote?")) return; setDeletingId(id);
    await supabase.from("journal_quotes").delete().eq("id", id); await fetchQuotes(); setDeletingId(null);
  }

  // Toggle active — only 1 allowed at a time
  async function toggleActive(q: JournalQuote) {
    const newActive = !q.is_active;
    if (newActive) {
      // Deactivate all others first, then activate this one
      const otherIds = quotes.filter((x) => x.is_active && x.id !== q.id).map((x) => x.id);
      if (otherIds.length > 0) await supabase.from("journal_quotes").update({ is_active: false }).in("id", otherIds);
    }
    await supabase.from("journal_quotes").update({ is_active: newActive }).eq("id", q.id);
    await fetchQuotes();
  }

  const filteredQuotes = quotes.filter((q) => {
    const from = ymdToDate(q.publish_date_from); const to = ymdToDate(q.publish_date_to);
    return from <= new Date(calYear, calMonth + 1, 0) && to >= new Date(calYear, calMonth, 1);
  });
  function handleCalendarMonthChange(year: number, month: number) { setCalYear(year); setCalMonth(month); }
  function rangeLabel(q: JournalQuote) { return q.publish_date_from === q.publish_date_to ? q.publish_date_from : `${q.publish_date_from} → ${q.publish_date_to}`; }
  const activeCount = quotes.filter((q) => q.is_active).length;

  if (loading) return <div className="text-sm text-slate-500">Loading quotes...</div>;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-slate-500">{quotes.length} quotes in library</div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold border ${activeCount === 1 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : activeCount === 0 ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
            <CheckCircle2 size={10} />
            {activeCount === 0 ? "No active quote" : activeCount === 1 ? "1 active" : `${activeCount} active — only 1 allowed`}
          </span>
        </div>
        <button type="button" onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-95 transition">
          <Plus size={14} /> Add Quote
        </button>
      </div>

      {msg && !showForm && <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{msg.text}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          {/* Form */}
          {showForm && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-extrabold text-slate-900">{editingId ? "Edit Quote" : "Add New Quote"}</div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Quote *</label>
                  <textarea value={form.quote} onChange={(e) => setForm((p) => ({ ...p, quote: e.target.value }))} rows={3} placeholder="Enter the quote text..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Author</label>
                  <input value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} placeholder="e.g. Brené Brown"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
                </div>

                {/* ── Single-calendar range picker ── */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CalendarRange size={13} className="text-cyan-600" />
                    <span className="text-xs font-bold text-slate-700">Publish Date Range</span>
                  </div>
                  <RangeCalendarPicker
                    from={form.publish_date_from}
                    to={form.publish_date_to}
                    onChange={(from, to) => setForm((p) => ({ ...p, publish_date_from: from, publish_date_to: to }))}
                  />
                </div>

                {/* Active toggle */}
                <div className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                    <span className="text-sm font-semibold text-slate-700">Active (visible in journal)</span>
                  </label>
                  {form.is_active && quotes.some((q) => q.is_active && q.id !== editingId) && (
                    <p className="text-[11px] text-amber-600 font-semibold">⚠️ Saving will deactivate the currently active quote.</p>
                  )}
                </div>
              </div>

              {msg && <p className={`mt-3 text-sm font-semibold ${msg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>{msg.text}</p>}
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={handleSubmit} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition">
                  {saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Saving..." : editingId ? "Update" : "Add Quote"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setMsg(null); }}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
              </div>
            </section>
          )}

          {/* Quote list */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="text-sm font-extrabold text-slate-900">{CAL_MONTH_NAMES[calMonth]} {calYear} — {filteredQuotes.length} quote{filteredQuotes.length !== 1 ? "s" : ""}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Quotes with a publish range overlapping this month</div>
            </div>
            {filteredQuotes.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">No quotes scheduled for {CAL_MONTH_NAMES[calMonth]} {calYear}.<br /><span className="text-xs">Navigate the calendar or click Add Quote.</span></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredQuotes.map((q) => (
                  <div key={q.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 italic mb-1 line-clamp-2">&#34;{q.quote}&#34;</div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="font-bold text-slate-700">— {q.author}</span>
                        <span className="inline-flex items-center gap-1 text-[10px]"><CalendarRange size={10} className="text-cyan-500" /><span className="font-semibold text-slate-600">{rangeLabel(q)}</span></span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 items-center">
                      <button type="button" onClick={() => toggleActive(q)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition ${q.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        <CheckCircle2 size={11} />{q.is_active ? "Active" : "Inactive"}
                      </button>
                      <button type="button" onClick={() => openEdit(q)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"><Pencil size={13} /></button>
                      <button type="button" onClick={() => handleDelete(q.id)} disabled={deletingId === q.id} className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50 transition">
                        {deletingId === q.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar calendar */}
        <div><QuotesCalendar quotes={quotes} onMonthChange={handleCalendarMonthChange} /></div>
      </div>
    </div>
  );
}

// ─── Gamification Tab ─────────────────────────────────────────────────────────
// ─── Gamification Tab Types ───────────────────────────────────────────
type PendingApproval = {
  id: string;
  user_id: string;
  user_name: string;
  mission_id: string;
  mission_title: string;
  reflection_text: string | null;
  proof_url: string | null;
  completed_at: string;
};

type GamificationStats = {
  totalXP: number;
  totalUsers: number;
  avgLevel: number;
  totalBadges: number;
  topUsers: Array<{ user_id: string; full_name: string; total_xp: number; level: number }>;
  missionStats: Array<{ id: string; title: string; completions: number; completion_rate: number }>;
  pendingCount: number;
};

// ─── Main Gamification Tab ────────────────────────────────────────────
function GamificationTab() {
  const [subTab, setSubTab] = useState<"stats" | "config">("stats");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setSubTab("stats")}
          className={["inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold border-b-2 transition -mb-px",
            subTab === "stats" ? "border-cyan-500 text-cyan-600" : "border-transparent text-slate-500 hover:text-slate-700"].join(" ")}>
          <BarChart3 size={14} /> Gamification Stats
        </button>
        <button type="button" onClick={() => setSubTab("config")}
          className={["inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold border-b-2 transition -mb-px",
            subTab === "config" ? "border-cyan-500 text-cyan-600" : "border-transparent text-slate-500 hover:text-slate-700"].join(" ")}>
          <Trophy size={14} /> Configuration
        </button>
      </div>
      {subTab === "stats" ? <GamificationStatsTab /> : <GamificationConfigTab />}
    </div>
  );
}

// ─── Stats Sub-Tab ────────────────────────────────────────────────────
function GamificationStatsTab() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GamificationStats | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const [
      { data: gamiData },
      { data: xpData },
      { data: badgeData },
      { data: missions },
      { data: completions },
      { data: pending },
      { data: profiles },
    ] = await Promise.all([
      supabase.from("user_gamification").select("user_id, total_xp, level"),
      supabase.from("xp_transactions").select("xp_awarded"),
      supabase.from("user_badges").select("id"),
      supabase.from("daily_missions").select("id, title, is_active"),
      supabase.from("user_mission_completions").select("mission_id, status"),
      supabase.from("user_mission_completions").select("id").eq("status", "pending"),
      supabase.from("profiles").select("id, full_name").eq("role", "EMPLOYEE"),
    ]);

    const totalXP = (xpData ?? []).reduce((s: number, t: any) => s + (t.xp_awarded ?? 0), 0);
    const totalUsers = (gamiData ?? []).length;
    const avgLevel = totalUsers > 0
      ? (gamiData ?? []).reduce((s: number, g: any) => s + (g.level ?? 1), 0) / totalUsers
      : 0;

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    const topUsers = (gamiData ?? [])
      .sort((a: any, b: any) => (b.total_xp ?? 0) - (a.total_xp ?? 0))
      .slice(0, 5)
      .map((g: any) => ({
        user_id: g.user_id,
        full_name: profileMap.get(g.user_id) ?? "Employee",
        total_xp: g.total_xp ?? 0,
        level: g.level ?? 1,
      }));

    const approvedCompletions = (completions ?? []).filter((c: any) => c.status === "approved" || c.status === null);
    const missionStats = (missions ?? []).map((m: any) => {
      const count = approvedCompletions.filter((c: any) => c.mission_id === m.id).length;
      return { id: m.id, title: m.title, completions: count, completion_rate: totalUsers > 0 ? (count / totalUsers) * 100 : 0 };
    }).sort((a, b) => b.completions - a.completions);

    setStats({ totalXP, totalUsers, avgLevel, totalBadges: (badgeData ?? []).length, topUsers, missionStats, pendingCount: (pending ?? []).length });
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <div className="text-sm text-slate-500">Loading stats...</div>;
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total XP Awarded", value: stats.totalXP.toLocaleString(), icon: <Zap size={14} />, color: "bg-cyan-50 text-cyan-600" },
          { label: "Active Users", value: stats.totalUsers, icon: <Trophy size={14} />, color: "bg-violet-50 text-violet-600" },
          { label: "Avg Level", value: stats.avgLevel.toFixed(1), icon: <BarChart3 size={14} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Badges Awarded", value: stats.totalBadges, icon: <CheckCircle2 size={14} />, color: "bg-amber-50 text-amber-600" },
          { label: "Pending Approvals", value: stats.pendingCount, icon: <Sparkles size={14} />, color: stats.pendingCount > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className={`inline-flex h-7 w-7 place-items-center grid rounded-lg ${s.color} mb-2`}>{s.icon}</div>
            <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs font-bold text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={15} className="text-amber-500" />
          <div className="text-sm font-extrabold text-slate-900">Top 5 Employees by XP</div>
        </div>
        {stats.topUsers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No active employees yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.topUsers.map((u, i) => (
              <div key={u.user_id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className={["grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold",
                  i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"].join(" ")}>
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-slate-800 truncate">{u.full_name}</div>
                  <div className="text-xs text-slate-400">Level {u.level}</div>
                </div>
                <div className="text-sm font-extrabold text-cyan-600">{u.total_xp.toLocaleString()} XP</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={15} className="text-cyan-500" />
          <div className="text-sm font-extrabold text-slate-900">Mission Performance</div>
        </div>
        <p className="text-xs text-slate-400 mb-4">Sorted by completions. Low rates = consider revising that mission.</p>
        {stats.missionStats[0] && (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 mb-1">🏆 Most Popular</div>
            <div className="text-sm font-extrabold text-amber-900">{stats.missionStats[0].title}</div>
            <div className="text-xs text-amber-700 mt-0.5">{stats.missionStats[0].completions} completions · {stats.missionStats[0].completion_rate.toFixed(1)}% of employees</div>
          </div>
        )}
        <div className="space-y-1.5">
          {stats.missionStats.map(m => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 truncate">{m.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden max-w-[200px]">
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500" style={{ width: `${Math.min(100, m.completion_rate)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">{m.completion_rate.toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-xs font-extrabold text-slate-700 shrink-0">{m.completions}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Configuration Sub-Tab ────────────────────────────────────────────
function GamificationConfigTab() {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", activity_key: "daily_emotion_checkin",
    xp_reward: 5, verification_type: "platform", requires_reflection: false, is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [pendingList, setPendingList] = useState<PendingApproval[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    const { data } = await supabase.from("daily_missions").select("*").order("created_at", { ascending: false });
    setMissions(data ?? []);
    setLoading(false);
  }, []);

  const fetchPending = useCallback(async () => {
    setPendingLoading(true);
    const { data: completions } = await supabase
      .from("user_mission_completions")
      .select("id, user_id, mission_id, reflection_text, proof_url, completed_at")
      .eq("status", "pending")
      .order("completed_at", { ascending: false });

    if (!completions || completions.length === 0) { setPendingList([]); setPendingLoading(false); return; }

    const userIds = [...new Set(completions.map((c: any) => c.user_id))];
    const missionIds = [...new Set(completions.map((c: any) => c.mission_id))];

    const [{ data: profiles }, { data: missionData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", userIds),
      supabase.from("daily_missions").select("id, title").in("id", missionIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    const missionMap = new Map((missionData ?? []).map((m: any) => [m.id, m.title]));

    setPendingList(completions.map((c: any) => ({
      id: c.id, user_id: c.user_id,
      user_name: profileMap.get(c.user_id) ?? "Employee",
      mission_id: c.mission_id,
      mission_title: missionMap.get(c.mission_id) ?? "Unknown mission",
      reflection_text: c.reflection_text,
      proof_url: c.proof_url,
      completed_at: c.completed_at,
    })));
    setPendingLoading(false);
  }, []);

  useEffect(() => { fetchMissions(); fetchPending(); }, [fetchMissions, fetchPending]);

  function openCreate() {
    setEditingId(null);
    setForm({ title: "", description: "", activity_key: "daily_emotion_checkin", xp_reward: 5, verification_type: "platform", requires_reflection: false, is_active: true });
    setShowForm(true); setMsg(null);
  }

  function openEdit(m: any) {
    setEditingId(m.id);
    setForm({ title: m.title, description: m.description, activity_key: m.activity_key, xp_reward: m.xp_reward, verification_type: m.verification_type || "platform", requires_reflection: m.requires_reflection || false, is_active: m.is_active });
    setShowForm(true); setMsg(null);
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) { setMsg({ text: "Title and description are required.", type: "error" }); return; }
    setSaving(true);
    const payload = {
      ...form,
      title: form.title.trim(), description: form.description.trim(),
      activity_key: form.verification_type === "realworld" ? "realworld_mission" : form.activity_key,
      requires_reflection: form.verification_type === "realworld" ? true : form.requires_reflection,
    };
    if (editingId) {
      const { error } = await supabase.from("daily_missions").update(payload).eq("id", editingId);
      if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("daily_missions").insert(payload);
      if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; }
    }
    await fetchMissions(); setShowForm(false); setSaving(false);
    setMsg({ text: editingId ? "Mission updated." : "Mission created.", type: "success" });
  }

  async function deleteMission(id: string) {
    if (!confirm("Delete this mission?")) return;
    await supabase.from("daily_missions").delete().eq("id", id);
    await fetchMissions();
  }

  async function toggleMission(m: any) {
    await supabase.from("daily_missions").update({ is_active: !m.is_active }).eq("id", m.id);
    setMissions(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function processApproval(completionId: string, action: "approve" | "reject") {
    setProcessingId(completionId);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/admin/approve-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ completion_id: completionId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await fetchPending();
      setMsg({ text: action === "approve" ? `Approved! +${data.xp_awarded} XP awarded to employee.` : "Rejected.", type: "success" });
    } catch (e: any) {
      setMsg({ text: e?.message ?? "Failed", type: "error" });
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading...</div>;

  const platformMissions = missions.filter(m => (m.verification_type || "platform") === "platform");
  const realworldMissions = missions.filter(m => m.verification_type === "realworld");

  return (
    <div className="space-y-4">
      <MissionAIGeneratorModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onUseGenerated={(g) => {
          setEditingId(null);
          setForm({ title: g.title, description: g.description, activity_key: g.activity_key, xp_reward: g.xp_reward, verification_type: g.verification_type, requires_reflection: g.requires_reflection, is_active: true });
          setAiOpen(false); setShowForm(true);
        }}
      />

      {msg && !showForm && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {msg.text}
        </div>
      )}

      {/* Pending Approvals */}
      {pendingLoading ? (
        <div className="text-xs text-slate-400">Checking pending approvals...</div>
      ) : pendingList.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-amber-600" />
            <div className="text-sm font-extrabold text-amber-900">Pending Real-World Approvals ({pendingList.length})</div>
          </div>
          <div className="space-y-3">
            {pendingList.map(p => (
              <div key={p.id} className="rounded-xl border border-amber-200 bg-white p-4">
                <div className="mb-2">
                  <div className="text-sm font-extrabold text-slate-900">{p.mission_title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <strong>{p.user_name}</strong> · submitted {new Date(p.completed_at).toLocaleDateString("en-MY", { day: "2-digit", month: "short" })}
                  </div>
                </div>
                {p.reflection_text && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-700 leading-relaxed mb-3 italic">
                    "{p.reflection_text}"
                  </div>
                )}
                {p.proof_url && (
                  <button type="button" onClick={() => window.open(p.proof_url!, "_blank")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-extrabold text-cyan-700 mb-3 hover:bg-cyan-100">
                    📎 View Proof
                  </button>
                )}
                <div className="flex gap-2 mt-1">
                  <button type="button"
                    disabled={processingId === p.id}
                    onClick={() => processApproval(p.id, "approve")}
                    style={{ backgroundColor: "#059669", color: "#ffffff" }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-extrabold disabled:opacity-50 transition hover:opacity-90">
                    {processingId === p.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <CheckCircle2 size={12} />}
                    Approve
                  </button>
                  <button type="button"
                    disabled={processingId === p.id}
                    onClick={() => processApproval(p.id, "reject")}
                    style={{ backgroundColor: "#ffffff", color: "#be123c", border: "1px solid #fecdd3" }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-extrabold disabled:opacity-50 transition hover:opacity-90">
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-500">
          {missions.length} missions · {platformMissions.length} platform · {realworldMissions.length} real-world
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-cyan-500 to-sky-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-95">
            <Wand2 size={14} /> Generate with AI
          </button>
          <button type="button" onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50">
            <Plus size={14} /> Add Mission
          </button>
        </div>
      </div>

      {/* Mission Form */}
      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-extrabold text-slate-900">{editingId ? "Edit Mission" : "New Mission"}</div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Mission Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm(p => ({ ...p, verification_type: "platform", requires_reflection: false }))}
                  className={`rounded-xl border px-4 py-3 text-left transition ${form.verification_type === "platform" ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <div className="text-sm font-extrabold text-slate-900 mb-0.5">🖥️ Platform</div>
                  <div className="text-[11px] text-slate-500">Auto-verified by app activity</div>
                </button>
                <button type="button" onClick={() => setForm(p => ({ ...p, verification_type: "realworld", requires_reflection: true, activity_key: "realworld_mission" }))}
                  className={`rounded-xl border px-4 py-3 text-left transition ${form.verification_type === "realworld" ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <div className="text-sm font-extrabold text-slate-900 mb-0.5">🌍 Real-world</div>
                  <div className="text-[11px] text-slate-500">Requires reflection + approval</div>
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Daily Mood Check-in"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Description *</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                placeholder="Brief description of the mission..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none" />
            </div>
            {form.verification_type === "platform" && (
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Activity Key</label>
                <select value={form.activity_key} onChange={e => setForm(p => ({ ...p, activity_key: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-300">
                  <option value="daily_emotion_checkin">Daily Emotion Check-in</option>
                  <option value="daily_journal_entry">Daily Journal Entry</option>
                  <option value="read_ei_resource">Read EI Resource</option>
                  <option value="watch_ei_video">Watch EI Video</option>
                  <option value="breathing_exercise">Breathing Exercise</option>
                  <option value="reflection_worksheet">Reflection Worksheet</option>
                  <option value="ei_mini_quiz">EI Mini Quiz</option>
                  <option value="full_ei_assessment">Full EI Assessment</option>
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">XP Reward</label>
                <input type="number" value={form.xp_reward} min={1} max={50}
                  onChange={e => setForm(p => ({ ...p, xp_reward: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Status</label>
                <button type="button" onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-bold transition ${form.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                  {form.is_active ? "✓ Active" : "○ Inactive"}
                </button>
              </div>
            </div>
          </div>
          {msg && <p className={`mt-3 text-sm font-semibold ${msg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>{msg.text}</p>}
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving..." : editingId ? "Update" : "Create Mission"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setMsg(null); }}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Mission List */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-sm font-extrabold text-slate-900">All Missions ({missions.length})</div>
        </div>
        {missions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No missions yet. Click Add Mission or Generate with AI.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {missions.map(m => (
              <div key={m.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition ${!m.is_active ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <div className="text-sm font-extrabold text-slate-900">{m.title}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${m.verification_type === "realworld" ? "bg-violet-50 text-violet-700 border border-violet-200" : "bg-cyan-50 text-cyan-700 border border-cyan-200"}`}>
                      {m.verification_type === "realworld" ? "🌍 Real-world" : "🖥️ Platform"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{m.description}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-extrabold text-slate-900">{m.xp_reward}</span>
                  <span className="text-xs font-bold text-slate-400">XP</span>
                </div>
                <button type="button" onClick={() => toggleMission(m)}
                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition ${m.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                  {m.is_active ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {m.is_active ? "Active" : "Inactive"}
                </button>
                <button type="button" onClick={() => openEdit(m)}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
                  <Pencil size={13} />
                </button>
                <button type="button" onClick={() => deleteMission(m.id)}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── AI Mission Generator Modal ───────────────────────────────────────
function MissionAIGeneratorModal({ open, onClose, onUseGenerated }: {
  open: boolean;
  onClose: () => void;
  onUseGenerated: (g: any) => void;
}) {
  const [theme, setTheme] = useState("");
  const [missionType, setMissionType] = useState<"platform" | "realworld">("platform");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ragUsed, setRagUsed] = useState(false);
  const [similarCount, setSimilarCount] = useState(0);

  function reset() { setTheme(""); setMissionType("platform"); setResult(null); setErr(null); setRagUsed(false); setSimilarCount(0); }
  function handleClose() { reset(); onClose(); }

  async function handleGenerate() {
    if (!theme.trim()) { setErr("Please enter a theme."); return; }
    setGenerating(true); setErr(null); setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/generate-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ theme: theme.trim(), mission_type: missionType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult(data.generated); setRagUsed(data.rag_used); setSimilarCount(data.similar_count);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate.");
    } finally {
      setGenerating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-violet-50 via-cyan-50 to-sky-50 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 via-cyan-400 to-sky-400 text-white shadow-sm">
              <Wand2 size={17} />
            </div>
            <div>
              <div className="text-base font-extrabold text-slate-900">AI Mission Generator</div>
              <div className="text-xs text-slate-600 mt-0.5">Powered by <span className="font-extrabold text-violet-600">Groq</span> + <span className="font-extrabold text-cyan-600">RAG</span></div>
            </div>
          </div>
          <button type="button" onClick={handleClose}
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!result ? (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">Theme *</label>
                <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="e.g. Empathy, Stress management, Team connection..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">Mission Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMissionType("platform")}
                    className={`rounded-xl border px-4 py-3 text-left transition ${missionType === "platform" ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <div className="text-sm font-extrabold text-slate-900 mb-0.5">🖥️ Platform</div>
                    <div className="text-[11px] text-slate-500">Auto-verified app actions</div>
                  </button>
                  <button type="button" onClick={() => setMissionType("realworld")}
                    className={`rounded-xl border px-4 py-3 text-left transition ${missionType === "realworld" ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <div className="text-sm font-extrabold text-slate-900 mb-0.5">🌍 Real-world</div>
                    <div className="text-[11px] text-slate-500">Outside app, needs reflection</div>
                  </button>
                </div>
              </div>
              {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{err}</div>}
              <button type="button" onClick={handleGenerate} disabled={generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-cyan-500 to-sky-500 px-5 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 shadow-sm">
                {generating ? <><Loader2 size={15} className="animate-spin" /> Generating...</> : <><Wand2 size={15} /> Generate Mission</>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {ragUsed && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-extrabold text-violet-700">
                  <Database size={10} /> RAG checked {similarCount} existing missions
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Title</div>
                  <div className="text-sm font-extrabold text-slate-900">{result.title}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Description</div>
                  <div className="text-sm text-slate-700">{result.description}</div>
                </div>
                <div className="flex gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Type</div>
                    <div className="text-xs font-bold text-slate-700">{result.verification_type === "realworld" ? "🌍 Real-world" : "🖥️ Platform"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">XP</div>
                    <div className="text-xs font-bold text-slate-700">+{result.xp_reward}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => onUseGenerated(result)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 shadow-sm">
                  <CheckCircle2 size={14} /> Use This Mission
                </button>
                <button type="button" onClick={() => setResult(null)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
                  <RefreshCw size={13} /> Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Content Generator Modal ──────────────────────────────────────
function AIGeneratorModal({
  open, onClose, onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("article");
  const [category, setCategory] = useState("productivity");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [ragUsed, setRagUsed] = useState(false);
  const [similarCount, setSimilarCount] = useState(0);

  function reset() {
    setTopic("");
    setContentType("article");
    setCategory("productivity");
    setResult(null);
    setErr(null);
    setRagUsed(false);
    setSimilarCount(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleGenerate() {
    if (!topic.trim()) {
      setErr("Please enter a topic.");
      return;
    }
    setGenerating(true);
    setErr(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ topic: topic.trim(), content_type: contentType, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult(data.generated);
      setRagUsed(data.rag_used);
      setSimilarCount(data.similar_count);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate.");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!result) return;

    // Validate URL requirement for ARTICLE/VIDEO
    if (result.needs_url && !result.resource_url?.trim()) {
      setErr(`A URL is required for ${result.type === "ARTICLE" ? "Article" : "Video"} type.`);
      return;
    }

    setPublishing(true);
    setErr(null);

    const { error } = await supabase.from("ei_resources").insert({
      title: result.title,
      description: result.description,
      content: result.content,
      category: result.category,
      pillar: "KNOW_YOURSELF",
      type: result.type,
      status: "PUBLISHED",
      publish_date: new Date().toISOString().slice(0, 10),
      resource_url: result.needs_url ? result.resource_url.trim() : null,
    });

    setPublishing(false);

    if (error) {
      setErr(`Failed to publish: ${error.message}`);
      return;
    }

    reset();
    onPublished();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-violet-50 via-cyan-50 to-sky-50 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 via-cyan-400 to-sky-400 text-white shadow-sm">
              <Wand2 size={17} />
            </div>
            <div>
              <div className="text-base font-extrabold text-slate-900">AI Content Generator</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Generate EI content with <span className="font-extrabold text-violet-600">Groq Llama 3.3</span> + <span className="font-extrabold text-cyan-600">RAG</span> over existing resources.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!result ? (
            /* ─── INPUT VIEW ─── */
            <div className="space-y-4">
              {/* Info banner */}
              <div className="rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-sky-50 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <Brain size={15} className="text-cyan-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-cyan-800 leading-relaxed">
                    <strong>How it works:</strong> The AI queries existing resources first (RAG) to avoid duplicates, then generates fresh content tailored to Malaysian SME workplaces.
                  </div>
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Topic <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Managing workplace stress, Building empathy in teams..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition"
                />
                <div className="mt-1.5 text-[10px] text-slate-400">
                  Be specific — "Managing burnout in remote teams" works better than just "Burnout".
                </div>
              </div>

              {/* Content Type + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Content Type
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="article">📄 Article (400-500 words)</option>
                    <option value="worksheet">📝 Worksheet (5-7 questions)</option>
                    <option value="guide">📋 Step-by-Step Guide</option>
                    <option value="exercise">🧘 Mindfulness Exercise</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="productivity">Productivity</option>
                    <option value="confidence">Confidence</option>
                    <option value="anger">Anger</option>
                    <option value="anxiety">Anxiety</option>
                    <option value="people">People-pleasing</option>
                    <option value="relationships">Relationships</option>
                    <option value="selflove">Self-love</option>
                    <option value="parenting">Parenting</option>
                  </select>
                </div>
              </div>

              {err && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {err}
                </div>
              )}

              {/* Generate button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-cyan-500 to-sky-500 px-5 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 shadow-sm transition"
              >
                {generating ? (
                  <><Loader2 size={15} className="animate-spin" /> Generating with Groq + RAG...</>
                ) : (
                  <><Wand2 size={15} /> Generate Content</>
                )}
              </button>
            </div>
          ) : (
            /* ─── RESULT VIEW ─── */
            <div className="space-y-4">
              {/* Success banner */}
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-emerald-800 leading-relaxed flex-1">
                    <strong>Content ready!</strong> Review and edit below, then publish to make it visible to employees.
                  </div>
                </div>
              </div>

              {/* RAG context badge */}
              {ragUsed && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-extrabold text-violet-700">
                  <Database size={10} />
                  RAG referenced {similarCount} similar resource{similarCount !== 1 ? "s" : ""} to ensure uniqueness
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">Title</label>
                <input
                  type="text"
                  value={result.title}
                  onChange={(e) => setResult({ ...result, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">Description</label>
                <textarea
                  value={result.description}
                  onChange={(e) => setResult({ ...result, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 resize-none"
                />
              </div>

              {/* URL (for Article/Video) */}
              {result.needs_url && (
                <div>
                  <label className="text-[10px] font-extrabold text-cyan-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Link2 size={11} />
                    {result.type === "ARTICLE" ? "Article URL" : "Video URL"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={result.resource_url}
                    onChange={(e) => setResult({ ...result, resource_url: e.target.value })}
                    placeholder={result.type === "ARTICLE" ? "https://example.com/article" : "https://youtube.com/watch?v=..."}
                    className="w-full rounded-xl border border-cyan-200 bg-cyan-50/30 px-4 py-2.5 text-sm font-medium outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                  <div className="mt-1 text-[10px] text-slate-400">AI suggested this — verify it's the right link before publishing.</div>
                </div>
              )}

              {/* Content */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  {result.type === "WORKSHEET" ? (
                    <>Content <span className="font-normal text-violet-500">(this is the prompt Groq uses to generate the scenario game)</span></>
                  ) : (
                    <>Content</>
                  )}
                </label>
                <textarea
                  value={result.content}
                  onChange={(e) => setResult({ ...result, content: e.target.value })}
                  rows={11}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Metadata + tags */}
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-extrabold text-slate-500 mb-0.5">Read Time</div>
                    <div className="font-bold text-slate-700">{result.read_time_minutes} min</div>
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-500 mb-0.5">Type</div>
                    <div className="font-bold text-slate-700">{result.type}</div>
                  </div>
                </div>
                {result.tags && result.tags.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Suggested Tags</div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.tags.map((tag: string, i: number) => (
                        <span key={i} className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-extrabold text-cyan-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {err && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {err}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="border-t border-slate-100 bg-white px-6 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 shadow-sm"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {publishing ? "Publishing..." : "Publish to Resources"}
            </button>
            <button
              type="button"
              onClick={() => { setResult(null); setErr(null); }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={13} />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}