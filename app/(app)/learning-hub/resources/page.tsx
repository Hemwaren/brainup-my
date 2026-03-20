"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, X, Bookmark, BookOpenText, ArrowLeft, Star, Filter,
  CheckCircle2, Clock, FileText, Video, Sparkles, FileSpreadsheet,
  Flame, ShieldAlert, Angry, Users, Handshake, Heart, Timer, Baby,
  Loader2, RefreshCw, Link2, GraduationCap,
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

// ─── Constants ────────────────────────────────────────────────────────────────
const BRAND_BG  = "bg-cyan-600";

// ── Unified cyan/teal gradient for ALL cards ──
const UNIFIED = {
  bar:  "from-teal-400 via-cyan-500 to-sky-500",
  pill: "bg-cyan-100 text-cyan-800",
};

// Type display meta (icon + label only — no individual colours)
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

// ─── Flip Card ────────────────────────────────────────────────────────────────
function FlipCard({
  resource, bookmarked, onBookmark, onRead,
}: {
  resource: EIResource;
  bookmarked: boolean;
  onBookmark: () => void;
  onRead: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const meta  = getTypeMeta(resource.type);
  const topic = TOPICS.find((t) => t.id === resource.category);

  return (
    <div
      className="relative h-52"
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* ── FRONT ── */}
        <div
          className="absolute inset-0 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          {/* unified cyan bar */}
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

            <div className="text-base font-extrabold text-slate-900 leading-snug flex-1 line-clamp-2">
              {resource.title}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-slate-400" />
                  {new Date(resource.publish_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className="flex items-center gap-1">
                  <Bookmark size={12} className="text-slate-400" /> {resource.bookmark_count}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onBookmark(); }}
                className={`grid h-8 w-8 place-items-center rounded-xl border transition ${bookmarked ? "border-cyan-200 bg-cyan-50 text-cyan-600" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"}`}
              >
                <Bookmark size={13} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>

        {/* ── BACK ── unified cyan gradient for ALL types */}
        <div
          className={`absolute inset-0 rounded-3xl overflow-hidden flex flex-col bg-gradient-to-br ${UNIFIED.bar} shadow-lg`}
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10 pointer-events-none" />

          <div className="relative z-10 flex flex-col flex-1 p-5 text-white">
            <div className="text-[10px] font-extrabold text-white/60 uppercase tracking-widest mb-2">
              {meta.label}{topic ? ` · ${topic.title}` : ""}
            </div>
            <div className="text-base font-extrabold leading-snug mb-2 flex-1 line-clamp-3">
              {resource.description || resource.title}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/70 mb-4">
              <BookOpenText size={11} /> {resource.view_count} views ·
              <Bookmark     size={11} /> {resource.bookmark_count} saves
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onRead}
                className="flex-1 rounded-2xl bg-white py-2.5 text-xs font-extrabold text-slate-900 hover:bg-white/90 transition shadow-sm"
              >
                Read now →
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onBookmark(); }}
                className={`grid h-10 w-10 place-items-center rounded-2xl border transition ${bookmarked ? "bg-white/30 border-white/50 text-white" : "bg-white/15 border-white/30 text-white/70 hover:bg-white/25"}`}
              >
                <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="h-52 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-pulse">
      <div className={`h-1 w-full bg-gradient-to-r ${UNIFIED.bar} opacity-30`} />
      <div className="p-5 flex flex-col h-full gap-3">
        <div className="flex gap-2">
          <div className="h-5 w-20 rounded-full bg-slate-200" />
          <div className="h-5 w-24 rounded-full bg-slate-200" />
        </div>
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-3/4 rounded bg-slate-200" />
        <div className="flex-1" />
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-8 w-8 rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={["relative rounded-full px-4 py-2 text-xs font-extrabold transition",
        active ? "text-white" : "text-white/60 hover:text-white"].join(" ")}>
      {label}
      {active && (
        <motion.span layoutId="tab-underline"
          className="absolute left-1/2 top-full mt-1.5 h-0.5 w-10 -translate-x-1/2 rounded-full bg-white/80" />
      )}
    </button>
  );
}

// ─── Filter Chip ─────────────────────────────────────────────────────────────
function FilterChip({ active, label, icon, onClick }: { active: boolean; label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.96 }}
      className={["inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
        active ? "bg-white text-cyan-700 shadow-sm" : "bg-white/15 text-white/80 hover:bg-white/25 hover:text-white"].join(" ")}>
      {icon}{label}
    </motion.button>
  );
}

// ─── Topic Chip ──────────────────────────────────────────────────────────────
function TopicChip({ active, label, icon, onClick }: { active: boolean; label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.97 }}
      className={["inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-extrabold w-full transition",
        active ? "border-cyan-500 bg-cyan-600 text-white shadow-md shadow-cyan-100"
               : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50"].join(" ")}>
      {icon}{label}
    </motion.button>
  );
}

// ─── Star Rating ─────────────────────────────────────────────────────────────
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
  const [mode,           setMode]           = useState<"LIST" | "READ">("LIST");
  const [activeId,       setActiveId]       = useState<string | null>(null);
  const [bookmarks,      setBookmarks]      = useState<Record<string, boolean>>({});
  const [ratings,        setRatings]        = useState<Record<string, number>>({});
  const [justFinished,   setJustFinished]   = useState(false);
  const [resources,      setResources]      = useState<EIResource[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [fetchError,     setFetchError]     = useState<string | null>(null);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  const fetchResources = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from("ei_resources")
        .select("*")
        .eq("status", "PUBLISHED")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setResources(data ?? []);
      setBookmarks((prev) => {
        const next = { ...prev };
        for (const r of data ?? []) {
          if (!(r.id in next)) next[r.id] = false;
        }
        return next;
      });
    } catch (err: any) {
      setFetchError(err?.message ?? "Failed to load resources.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  // Listens to INSERT / UPDATE / DELETE on ei_resources.
  // When admin publishes → card appears instantly.
  // When admin archives / drafts → card disappears instantly.
  useEffect(() => {
    const channel = supabase
      .channel("ei_resources_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ei_resources" },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload as any;

          if (eventType === "INSERT") {
            // Only show if PUBLISHED
            if (newRow.status === "PUBLISHED") {
              setResources((prev) => {
                // avoid duplicates
                if (prev.some((r) => r.id === newRow.id)) return prev;
                return [newRow as EIResource, ...prev];
              });
              setBookmarks((prev) => ({ ...prev, [newRow.id]: false }));
            }
          }

          if (eventType === "UPDATE") {
            if (newRow.status === "PUBLISHED") {
              // Add or update in list
              setResources((prev) => {
                const exists = prev.some((r) => r.id === newRow.id);
                if (exists) return prev.map((r) => r.id === newRow.id ? (newRow as EIResource) : r);
                return [newRow as EIResource, ...prev];
              });
              setBookmarks((prev) => ({ ...prev, [newRow.id]: prev[newRow.id] ?? false }));
            } else {
              // Status changed to DRAFT or ARCHIVED — remove from list
              setResources((prev) => prev.filter((r) => r.id !== newRow.id));
            }
          }

          if (eventType === "DELETE") {
            setResources((prev) => prev.filter((r) => r.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const availableTypes = useMemo(() =>
    Array.from(new Set(resources.map((r) => r.type?.toUpperCase()).filter(Boolean))),
    [resources]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      const topicTitle = TOPICS.find((t) => t.id === r.category)?.title ?? "";
      const matchQuery  = !q || r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || topicTitle.toLowerCase().includes(q);
      const matchType   = selectedTypes.size === 0 || selectedTypes.has(r.type?.toUpperCase());
      const matchTopic  = selectedTopics.size === 0 || selectedTopics.has(r.category);
      return matchQuery && matchType && matchTopic;
    });
  }, [resources, query, selectedTypes, selectedTopics]);

  const bookmarkedFiltered = filtered.filter((r) => bookmarks[r.id]);
  const displayList        = tab === "LIBRARY" ? filtered : bookmarkedFiltered;
  const bookmarkCount      = Object.values(bookmarks).filter(Boolean).length;

  const activeResource = useMemo(() =>
    resources.find((r) => r.id === activeId) ?? null,
    [resources, activeId]
  );
  const activeMeta = activeResource ? getTypeMeta(activeResource.type) : null;

  // ── Actions ────────────────────────────────────────────────────────────────
  function toggleType(t: string) {
    setSelectedTypes((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  }
  function toggleTopic(id: string) {
    setSelectedTopics((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function clearAll() { setQuery(""); setSelectedTypes(new Set()); setSelectedTopics(new Set()); }

  async function onToggleBookmark(id: string) {
    const was      = bookmarks[id];
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
    setJustFinished(false);
    setActiveId(id);
    setMode("READ");

    const resource = resources.find((r) => r.id === id);
    if (resource) {
      const next = resource.view_count + 1;
      await supabase.from("ei_resources").update({ view_count: next }).eq("id", id);
      setResources((prev) => prev.map((r) => r.id === id ? { ...r, view_count: next } : r));
    }
  }

  function closeReader() { setMode("LIST"); setActiveId(null); }

  async function finishReading() {
    const r = activeId ? ratings[activeId] ?? 0 : 0;
    if (!activeId || r < 1) return;
    setJustFinished(true);
    setTimeout(() => setJustFinished(false), 2500);
    closeReader();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) fetch("/api/gamification/award-xp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ activityKey: "read_ei_resource" }),
    }).catch(() => {});
  }

  const hasActiveFilters = query || selectedTypes.size > 0 || selectedTopics.size > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-6xl">

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
              className="grid h-9 w-9 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
              title="Refresh">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
            <Link href="/learning-hub/assessment"
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white hover:bg-white/20 transition">
              ← Assessment
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex items-center gap-1">
          <TabBtn active={tab === "LIBRARY"}  label="Library"                        onClick={() => setTab("LIBRARY")}  />
          <TabBtn active={tab === "BOOKMARK"} label={`Bookmarks (${bookmarkCount})`} onClick={() => setTab("BOOKMARK")} />
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <Search className="shrink-0 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search resources..."
              className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 transition">
                <X size={15} />
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearAll}
              className="rounded-2xl bg-white/20 px-4 py-3 text-xs font-extrabold text-white hover:bg-white/30 transition">
              Clear
            </button>
          )}
        </div>

        {/* Type filter chips */}
        {availableTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/50">
              <Filter size={12} /> Filter
            </span>
            {availableTypes.map((t) => {
              const m = getTypeMeta(t);
              return (
                <FilterChip key={t} label={m.label} icon={m.icon}
                  active={selectedTypes.has(t)} onClick={() => toggleType(t)} />
              );
            })}
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="mt-6">
        <AnimatePresence mode="wait">

          {/* LIST MODE */}
          {mode === "LIST" && (
            <motion.div key="list"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* XP toast */}
              <AnimatePresence>
                {justFinished && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                    <CheckCircle2 size={17} className="text-emerald-500" />
                    XP earned! Great work finishing that resource.
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              {fetchError && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  <span>⚠ {fetchError}</span>
                  <button type="button" onClick={fetchResources} className="text-xs font-extrabold underline hover:no-underline">Retry</button>
                </div>
              )}

              {/* Topics */}
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

              {/* Results header */}
              <div>
                <div className="text-lg font-extrabold text-slate-900">
                  {tab === "LIBRARY" ? "All Resources" : "Saved Resources"}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {loading
                    ? "Loading…"
                    : `${displayList.length} item${displayList.length !== 1 ? "s" : ""} · hover a card to flip it`}
                </div>
              </div>

              {/* Skeletons */}
              {loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              )}

              {/* Empty */}
              {!loading && displayList.length === 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
                    {tab === "BOOKMARK"
                      ? <Bookmark size={22} className="text-slate-400" />
                      : <BookOpenText size={22} className="text-slate-400" />}
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {tab === "BOOKMARK" ? "No bookmarks yet"
                      : resources.length === 0 ? "No published resources yet"
                      : "Nothing matches your filters"}
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

              {/* Cards */}
              {!loading && displayList.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {displayList.map((r, i) => (
                    <motion.div key={r.id}
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}>
                      <FlipCard
                        resource={r}
                        bookmarked={!!bookmarks[r.id]}
                        onBookmark={() => onToggleBookmark(r.id)}
                        onRead={() => openReader(r.id)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* READER MODE */}
          {mode === "READ" && activeResource && (
            <motion.div key="read"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {/* unified bar */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${UNIFIED.bar}`} />

              <div className="p-6">
                {/* Nav */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  <button type="button" onClick={closeReader}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={() => onToggleBookmark(activeResource.id)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold transition ${bookmarks[activeResource.id] ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                    <Bookmark size={15} fill={bookmarks[activeResource.id] ? "currentColor" : "none"} />
                    {bookmarks[activeResource.id] ? "Saved" : "Save"}
                  </button>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-3">
                  {activeResource.title}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {activeMeta && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${UNIFIED.pill}`}>
                      {activeMeta.icon} {activeMeta.label}
                    </span>
                  )}
                  {(() => {
                    const t = TOPICS.find((t) => t.id === activeResource.category);
                    return t ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {t.icon} {t.title}
                      </span>
                    ) : null;
                  })()}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    <BookOpenText size={12} /> {activeResource.view_count} views
                  </span>
                </div>

                {activeResource.description && (
                  <p className="text-sm text-slate-500 italic border-l-4 border-cyan-200 pl-4 mb-5 leading-relaxed">
                    {activeResource.description}
                  </p>
                )}

                {/* External link button */}
                {activeResource.resource_url && (
                  <a href={activeResource.resource_url} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold text-white mb-5 hover:opacity-90 transition ${BRAND_BG}`}>
                    <Link2 size={15} />
                    {activeResource.type === "VIDEO" ? "Watch Video" : "Read Full Article"} →
                  </a>
                )}

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700 whitespace-pre-line mb-6 min-h-20">
                  {activeResource.content || (
                    <span className="text-slate-400 italic">No additional content for this resource.</span>
                  )}
                </div>

                {/* Rating */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-extrabold text-slate-900 mb-0.5">Rate this content</div>
                  <div className="text-xs text-slate-500 mb-4">Pick 1–5 stars, then click Finish to earn XP.</div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <StarRating
                      value={activeId ? ratings[activeId] ?? 0 : 0}
                      onChange={(v) => { if (activeId) setRatings((p) => ({ ...p, [activeId]: v })); }}
                    />
                    <button type="button" onClick={finishReading}
                      disabled={!activeId || (ratings[activeId] ?? 0) < 1}
                      className={[
                        "inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-extrabold text-white transition",
                        !activeId || (ratings[activeId] ?? 0) < 1
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : `${BRAND_BG} hover:opacity-90 shadow-sm`,
                      ].join(" ")}>
                      <CheckCircle2 size={16} /> Finish & Earn XP
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