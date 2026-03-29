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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {[{ id: "ALL", label: "All" }, ...TOPICS].map((t) => (
            <button key={t.id} type="button" onClick={() => setFilterTopic(t.id)}
              className={["rounded-xl px-3 py-1.5 text-xs font-extrabold transition", filterTopic === t.id ? "bg-cyan-500 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-95 transition">
          <Plus size={14} /> Add Resource
        </button>
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
function GamificationTab() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [msg,      setMsg]      = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    const { data } = await supabase.from("daily_missions").select("id, title, description, activity_key, xp_reward, is_active").order("xp_reward", { ascending: false });
    setMissions(data ?? []); setLoading(false);
  }, []);
  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  async function toggleMission(m: Mission) {
    setSaving(m.id);
    await supabase.from("daily_missions").update({ is_active: !m.is_active }).eq("id", m.id);
    setMissions((prev) => prev.map((x) => x.id === m.id ? { ...x, is_active: !x.is_active } : x)); setSaving(null);
  }
  async function updateXP(id: string, xp: number) {
    if (xp < 1 || xp > 50) return;
    await supabase.from("daily_missions").update({ xp_reward: xp }).eq("id", id);
    setMissions((prev) => prev.map((x) => x.id === id ? { ...x, xp_reward: xp } : x));
    setMsg("XP updated."); setTimeout(() => setMsg(null), 2000);
  }

  if (loading) return <div className="text-sm text-slate-500">Loading missions...</div>;
  const activeMissions = missions.filter((m) => m.is_active);
  const inactiveMissions = missions.filter((m) => !m.is_active);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[{ label: "Total Missions", value: missions.length, icon: <Trophy size={14} />, color: "bg-slate-50 text-slate-600" }, { label: "Active", value: activeMissions.length, icon: <CheckCircle2 size={14} />, color: "bg-emerald-50 text-emerald-600" }, { label: "Total XP Pool", value: activeMissions.reduce((s, m) => s + m.xp_reward, 0), icon: <Zap size={14} />, color: "bg-cyan-50 text-cyan-600" }].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className={`inline-flex h-7 w-7 place-items-center grid rounded-lg ${s.color} mb-2`}>{s.icon}</div>
            <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs font-bold text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700"><span className="font-bold">Note:</span> Toggle missions on/off to control what employees see.</div>
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{msg}</div>}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /><div className="text-sm font-extrabold text-slate-900">Active Missions ({activeMissions.length})</div></div>
        <div className="divide-y divide-slate-100">{activeMissions.map((m) => <MissionRow key={m.id} mission={m} onToggle={toggleMission} onXPChange={updateXP} saving={saving === m.id} />)}</div>
      </section>
      {inactiveMissions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"><XCircle size={14} className="text-slate-400" /><div className="text-sm font-extrabold text-slate-900">Inactive Missions ({inactiveMissions.length})</div></div>
          <div className="divide-y divide-slate-100">{inactiveMissions.map((m) => <MissionRow key={m.id} mission={m} onToggle={toggleMission} onXPChange={updateXP} saving={saving === m.id} />)}</div>
        </section>
      )}
    </div>
  );
}

function MissionRow({ mission: m, onToggle, onXPChange, saving }: { mission: Mission; onToggle: (m: Mission) => void; onXPChange: (id: string, xp: number) => void; saving: boolean }) {
  const [xpInput, setXpInput] = useState(String(m.xp_reward));
  return (
    <div className={`flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition ${!m.is_active ? "opacity-60" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-extrabold text-slate-900">{m.title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{m.description}</div>
        <div className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-600">{m.activity_key}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <BarChart3 size={13} className="text-cyan-500" />
        <input type="number" value={xpInput} min={1} max={50} onChange={(e) => setXpInput(e.target.value)} onBlur={() => onXPChange(m.id, Number(xpInput))}
          className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-extrabold text-center outline-none focus:ring-2 focus:ring-cyan-300" />
        <span className="text-xs font-bold text-slate-400">XP</span>
      </div>
      <button type="button" onClick={() => onToggle(m)} disabled={saving}
        className={["inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition",
          m.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"].join(" ")}>
        {saving ? <Loader2 size={11} className="animate-spin" /> : m.is_active ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
        {m.is_active ? "Active" : "Inactive"}
      </button>
    </div>
  );
}