"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  X,
  Bookmark,
  BookOpenText,
  ArrowLeft,
  Star,
  Filter,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Video,
  Sparkles,
  FileSpreadsheet,
  Flame,
  ShieldAlert,
  Angry,
  Users,
  Handshake,
  Heart,
  Timer,
  Baby,
} from "lucide-react";

type Tab = "LIBRARY" | "BOOKMARK";
type ContentType = "Article" | "Lesson" | "Video" | "Guided Exercise" | "Worksheet";

type Topic = {
  id: string;
  title: string;
  icon: React.ReactNode;
};

type Lesson = {
  id: string;
  title: string;
  topicId: string;
  contentType: ContentType;
  minutes: number;
  rating: number;
  content: string;
  bookmarked?: boolean;
};

const BRAND_BG = "bg-cyan-600";
const BRAND_BG_SOFT = "bg-cyan-50";
const BRAND_TEXT = "text-cyan-700";

const CONTENT_TYPES: { key: ContentType; icon: React.ReactNode }[] = [
  { key: "Article", icon: <FileText size={14} /> },
  { key: "Lesson", icon: <GraduationCap size={14} /> },
  { key: "Video", icon: <Video size={14} /> },
  { key: "Guided Exercise", icon: <Sparkles size={14} /> },
  { key: "Worksheet", icon: <FileSpreadsheet size={14} /> },
];

const TOPICS: Topic[] = [
  { id: "productivity", title: "Productivity", icon: <Timer size={16} /> },
  { id: "confidence", title: "Confidence", icon: <Flame size={16} /> },
  { id: "anger", title: "Anger", icon: <Angry size={16} /> },
  { id: "anxiety", title: "Anxiety", icon: <ShieldAlert size={16} /> },
  { id: "people", title: "People-pleasing", icon: <Users size={16} /> },
  { id: "relationships", title: "Relationships", icon: <Handshake size={16} /> },
  { id: "selflove", title: "Self-love", icon: <Heart size={16} /> },
  { id: "parenting", title: "Parenting", icon: <Baby size={16} /> },
];

const LESSONS: Lesson[] = [
  {
    id: "l1",
    title: "Understanding Self-Awareness",
    topicId: "selflove",
    contentType: "Article",
    minutes: 8,
    rating: 4.8,
    bookmarked: false,
    content:
      "Self-awareness is noticing your emotions, triggers, and patterns.\n\nTry:\n1) Name the emotion.\n2) Identify the trigger.\n3) Choose a response (not a reaction).\n\nMini task:\nWrite one moment today where you noticed a feeling early.",
  },
  {
    id: "l2",
    title: "Managing Stress at Work",
    topicId: "anxiety",
    contentType: "Guided Exercise",
    minutes: 12,
    rating: 4.5,
    bookmarked: true,
    content:
      "Quick guided reset:\n1) Breathe out slowly.\n2) Relax shoulders.\n3) Choose ONE next action.\n\nRepeat 3 times and return to the task.",
  },
  {
    id: "l3",
    title: "Building Empathy Skills",
    topicId: "relationships",
    contentType: "Lesson",
    minutes: 10,
    rating: 4.9,
    bookmarked: false,
    content:
      "Empathy is understanding feelings, not fixing.\n\nPractice:\n• Ask: “What’s it like for you?”\n• Reflect: “That sounds hard.”\n• Avoid rushing to advice.",
  },
  {
    id: "l4",
    title: "Effective Communication",
    topicId: "relationships",
    contentType: "Worksheet",
    minutes: 15,
    rating: 4.7,
    bookmarked: false,
    content:
      "Worksheet:\n1) Write the situation.\n2) Write what you feel.\n3) Write what you need.\n\nUse the script:\n“I feel __ when __ because __. I need __.”",
  },
  {
    id: "l5",
    title: "Emotional Regulation Techniques",
    topicId: "anger",
    contentType: "Lesson",
    minutes: 11,
    rating: 4.6,
    bookmarked: false,
    content:
      "Regulation tools:\n• 90-second pause\n• Label the emotion\n• Reframe the story\n\nPick one tool and use it today.",
  },
  {
    id: "l6",
    title: "Conflict Resolution Guide",
    topicId: "relationships",
    contentType: "Article",
    minutes: 14,
    rating: 4.4,
    bookmarked: false,
    content:
      "Conflict resolution:\n1) Agree on the goal.\n2) Share impact (not blame).\n3) Brainstorm options.\n4) Decide next steps.\n\nKey: stay specific.",
  },
  {
    id: "l7",
    title: "Healthy Boundaries (Short Video)",
    topicId: "people",
    contentType: "Video",
    minutes: 6,
    rating: 4.3,
    bookmarked: false,
    content:
      "Video notes:\n• Boundaries are rules for self-respect.\n• Keep scripts short.\n• Repeat calmly.\n\nTry: “That doesn’t work for me.”",
  },
  {
    id: "l8",
    title: "Focus Sprint Method",
    topicId: "productivity",
    contentType: "Lesson",
    minutes: 9,
    rating: 4.2,
    bookmarked: false,
    content:
      "Focus Sprint:\n1) Pick ONE task.\n2) Set 15–25 minutes timer.\n3) Remove distractions.\n4) Work until timer ends.\n5) Take short break.\n\nRepeat 2–4 cycles.",
  },
];

function TabBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative rounded-full px-3 py-2 text-xs font-extrabold transition",
        active ? "text-white" : "text-white/80 hover:text-white",
      ].join(" ")}
    >
      {label}
      {active && (
        <motion.span
          layoutId="tab-underline"
          className="absolute left-1/2 top-full mt-2 h-1 w-16 -translate-x-1/2 rounded-full bg-white/90"
        />
      )}
    </button>
  );
}

/** Flip chip (content types + topics) */
function FlipChip({
  active,
  label,
  icon,
  onClick,
  variant = "header",
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "header" | "topic";
}) {
  const base =
    variant === "header"
      ? "rounded-full px-3 py-1 text-xs"
      : "rounded-2xl px-3 py-3 text-xs w-full text-left";

  const activeCls =
    variant === "header"
      ? "bg-white text-cyan-800 shadow-sm ring-2 ring-white/30"
      : "bg-cyan-600 text-white ring-2 ring-cyan-200 shadow-[0_8px_18px_rgba(8,145,178,0.25)]";

  const inactiveCls =
    variant === "header"
      ? "bg-white/15 text-white hover:bg-white/20"
      : `border border-slate-200 ${BRAND_BG_SOFT} text-slate-900 hover:bg-cyan-50`;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={{ scale: 0.98 }}
      animate={{ rotateY: active ? 180 : 0 }}
      transition={{ duration: 0.28 }}
      style={{ transformStyle: "preserve-3d" }}
      className={[
        "relative inline-flex items-center gap-2 font-extrabold transition",
        base,
        active ? activeCls : inactiveCls,
        variant === "topic" ? "shadow-sm" : "",
      ].join(" ")}
    >
      {/* front */}
      <span
        className="inline-flex items-center gap-2"
        style={{ backfaceVisibility: "hidden" }}
      >
        {icon}
        <span className={variant === "topic" ? "truncate" : ""}>{label}</span>
      </span>

      {/* back */}
      <span
        className="inline-flex items-center gap-2"
        style={{
          position: "absolute",
          inset: 0,
          padding: variant === "topic" ? "0.75rem" : "0.25rem 0.75rem",
          alignItems: "center",
          justifyContent: "flex-start",
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}
      >
        {icon}
        <span className={variant === "topic" ? "truncate" : ""}>{label}</span>
      </span>
    </motion.button>
  );
}

function CardPill({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-2 py-1 text-xs font-bold text-slate-700">
      {icon}
      {label}
    </span>
  );
}

/** ✅ NEW: Flip + fill bookmark icon on toggle */
function FlipBookmarkButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      animate={{ rotateY: active ? 180 : 0 }}
      transition={{ duration: 0.28 }}
      style={{ transformStyle: "preserve-3d" }}
      className={[
        "relative grid h-10 w-10 place-items-center rounded-2xl border transition",
        active
          ? "border-cyan-200 bg-cyan-50 text-cyan-900"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      ].join(" ")}
      aria-label={active ? "Saved bookmark" : "Save bookmark"}
      aria-pressed={active}
    >
      {/* front (outline) */}
      <span style={{ backfaceVisibility: "hidden" }}>
        <Bookmark size={18} />
      </span>

      {/* back (filled) */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}
      >
        <Bookmark size={18} fill="currentColor" />
      </span>
    </motion.button>
  );
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={[
            "rounded-xl p-2 transition",
            value >= n ? "bg-cyan-600/10" : "bg-slate-100 hover:bg-slate-200",
          ].join(" ")}
          aria-label={`Rate ${n} star`}
        >
          <Star
            size={18}
            className={value >= n ? "text-cyan-700" : "text-slate-400"}
            fill={value >= n ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

export default function ResourcesPage() {
  const [tab, setTab] = useState<Tab>("LIBRARY");
  const [query, setQuery] = useState("");

  const [selectedTypes, setSelectedTypes] = useState<Set<ContentType>>(new Set());
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  const [mode, setMode] = useState<"LIST" | "READ">("LIST");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const l of LESSONS) init[l.id] = !!l.bookmarked;
    return init;
  });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [justFinished, setJustFinished] = useState(false);

  const activeLesson = useMemo(() => {
    if (!activeLessonId) return null;
    const l = LESSONS.find((x) => x.id === activeLessonId) || null;
    return l ? { ...l, bookmarked: !!bookmarks[l.id] } : null;
  }, [activeLessonId, bookmarks]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasTypeFilter = selectedTypes.size > 0;
    const hasTopicFilter = selectedTopics.size > 0;

    return LESSONS.filter((l) => {
      const topicTitle = TOPICS.find((t) => t.id === l.topicId)?.title || "";

      const matchesQuery =
        !q || l.title.toLowerCase().includes(q) || topicTitle.toLowerCase().includes(q);

      const matchesType = !hasTypeFilter ? true : selectedTypes.has(l.contentType);
      const matchesTopic = !hasTopicFilter ? true : selectedTopics.has(l.topicId);

      return matchesQuery && matchesType && matchesTopic;
    }).map((l) => ({ ...l, bookmarked: !!bookmarks[l.id] }));
  }, [query, selectedTypes, selectedTopics, bookmarks]);

  const bookmarkedResults = results.filter((l) => l.bookmarked);

  function clearSearch() {
    setQuery("");
    setSelectedTypes(new Set());
    setSelectedTopics(new Set());
  }

  function toggleType(t: ContentType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleTopic(id: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onToggleBookmark(id: string) {
    setBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openReader(id: string) {
    setJustFinished(false);
    setActiveLessonId(id);
    setMode("READ");
  }

  function closeReader() {
    setMode("LIST");
    setActiveLessonId(null);
  }

  function finishReading() {
    const r = activeLessonId ? ratings[activeLessonId] || 0 : 0;
    if (!activeLessonId || r < 1) return;

    setJustFinished(true);
    setTimeout(() => setJustFinished(false), 1800);
    closeReader();
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* HEADER */}
      <div
        className={[
          "rounded-3xl p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.10)]",
          BRAND_BG,
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15">
              <BookOpenText size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/80">Learning Hub</div>
              <div className="text-2xl font-black tracking-tight">Resources</div>
            </div>
          </div>

          <Link
            href="/learning-hub/assessment"
            className="rounded-full bg-white/15 px-4 py-2 text-xs font-extrabold text-white hover:bg-white/20"
          >
            Back to Assessment
          </Link>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex items-center gap-2">
          <TabBtn active={tab === "LIBRARY"} label="Library" onClick={() => setTab("LIBRARY")} />
          <TabBtn active={tab === "BOOKMARK"} label="Bookmark" onClick={() => setTab("BOOKMARK")} />
        </div>

        {/* Search */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <Search className="text-slate-400" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you looking for?"
              className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={clearSearch}
            className={[
              "shrink-0 rounded-2xl px-4 py-3 text-sm font-extrabold transition",
              query.trim().length > 0 || selectedTypes.size > 0 || selectedTopics.size > 0
                ? "bg-white/20 text-white hover:bg-white/25"
                : "bg-white/10 text-white/70",
            ].join(" ")}
          >
            Cancel
          </button>
        </div>

        {/* Filter row (content types) */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold text-white">
            <Filter size={14} />
            Filter
          </span>

          {CONTENT_TYPES.map((t) => (
            <FlipChip
              key={t.key}
              label={t.key}
              icon={t.icon}
              active={selectedTypes.has(t.key)}
              onClick={() => toggleType(t.key)}
              variant="header"
            />
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {mode === "LIST" ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Topics */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-black text-slate-900">Topics</div>

                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {TOPICS.map((t, idx) => {
                    const active = selectedTopics.has(t.id);
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                      >
                        <FlipChip
                          active={active}
                          label={t.title}
                          icon={t.icon}
                          onClick={() => toggleTopic(t.id)}
                          variant="topic"
                        />
                      </motion.div>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs font-semibold text-slate-500">
                  Select multiple topics to refine results. Click again to unselect.
                </div>
              </div>

              {/* Finish toast */}
              <AnimatePresence>
                {justFinished && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-cyan-700" />
                      Nice! Rating saved ✅
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Library / Bookmark */}
              <AnimatePresence mode="wait">
                {tab === "LIBRARY" ? (
                  <motion.div
                    key="library"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-lg font-black text-slate-900">All content</div>
                        <div className="text-sm font-semibold text-slate-600">
                          {results.length} item(s) found
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {results.map((l, idx) => {
                        const topic = TOPICS.find((t) => t.id === l.topicId);
                        const typeIcon = CONTENT_TYPES.find((t) => t.key === l.contentType)?.icon;

                        return (
                          <motion.div
                            key={l.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.02 }}
                            whileHover={{ y: -2 }}
                            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-base font-black text-slate-900">
                                  {l.title}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <CardPill label={l.contentType} icon={typeIcon} />
                                  {topic && <CardPill label={topic.title} icon={topic.icon} />}
                                </div>
                              </div>

                              {/* ✅ Flip + fill bookmark button */}
                              <FlipBookmarkButton
                                active={l.bookmarked}
                                onClick={() => onToggleBookmark(l.id)}
                              />
                            </div>

                            <div className="mt-4 flex items-center justify-between text-sm">
                              <span className="inline-flex items-center gap-2 text-slate-600">
                                <Clock size={16} className="text-slate-400" />
                                <span className="font-semibold">{l.minutes} min read</span>
                              </span>

                              <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                                <Star size={16} className="text-amber-500" fill="currentColor" />
                                {l.rating.toFixed(1)}
                              </span>
                            </div>

                            <div className="mt-5 flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-500">Quick read</span>

                              <button
                                type="button"
                                onClick={() => openReader(l.id)}
                                className={[
                                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-extrabold text-white transition hover:opacity-95",
                                  BRAND_BG,
                                ].join(" ")}
                              >
                                <BookOpenText size={16} />
                                Read
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="bookmark"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-lg font-black text-slate-900">Bookmarks</div>
                        <div className="text-sm font-semibold text-slate-600">
                          {bookmarkedResults.length} saved
                        </div>
                      </div>
                    </div>

                    {bookmarkedResults.length === 0 ? (
                      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-800">
                          <Bookmark size={18} />
                        </div>
                        <div className="mt-4 text-xl font-black text-slate-900">
                          No lessons bookmarked yet
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-600">
                          Tap bookmark on any content to keep it here.
                        </div>
                        <button
                          type="button"
                          onClick={() => setTab("LIBRARY")}
                          className={[
                            "mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white transition hover:opacity-95",
                            BRAND_BG,
                          ].join(" ")}
                        >
                          <BookOpenText size={18} />
                          Browse Library
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {bookmarkedResults.map((l) => {
                          const topic = TOPICS.find((t) => t.id === l.topicId);
                          const typeIcon =
                            CONTENT_TYPES.find((t) => t.key === l.contentType)?.icon;

                          return (
                            <div
                              key={l.id}
                              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-base font-black text-slate-900">
                                    {l.title}
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <CardPill label={l.contentType} icon={typeIcon} />
                                    {topic && <CardPill label={topic.title} icon={topic.icon} />}
                                  </div>
                                </div>

                                {/* ✅ same flip+fill bookmark */}
                                <FlipBookmarkButton
                                  active={l.bookmarked}
                                  onClick={() => onToggleBookmark(l.id)}
                                />
                              </div>

                              <div className="mt-4 flex items-center justify-between text-sm">
                                <span className="inline-flex items-center gap-2 text-slate-600">
                                  <Clock size={16} className="text-slate-400" />
                                  <span className="font-semibold">{l.minutes} min read</span>
                                </span>

                                <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                                  <Star size={16} className="text-amber-500" fill="currentColor" />
                                  {l.rating.toFixed(1)}
                                </span>
                              </div>

                              <div className="mt-5 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => openReader(l.id)}
                                  className={[
                                    "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-extrabold text-white transition hover:opacity-95",
                                    BRAND_BG,
                                  ].join(" ")}
                                >
                                  <BookOpenText size={16} />
                                  Read
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            // READ MODE (unchanged)
            <motion.div
              key="read"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={closeReader}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => activeLesson && onToggleBookmark(activeLesson.id)}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold transition",
                    activeLesson?.bookmarked
                      ? "border-cyan-200 bg-cyan-50 text-cyan-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <Bookmark size={16} />
                  {activeLesson?.bookmarked ? "Saved" : "Save"}
                </button>
              </div>

              <div className="mt-5">
                <div className="text-2xl font-black tracking-tight text-slate-900">
                  {activeLesson?.title || "Reading"}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {activeLesson && (
                    <>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-bold text-slate-700">
                        {CONTENT_TYPES.find((t) => t.key === activeLesson.contentType)?.icon}
                        {activeLesson.contentType}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-bold text-slate-700">
                        <Clock size={14} />
                        {activeLesson.minutes} min read
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-bold text-slate-700">
                        <Star size={14} className="text-amber-500" fill="currentColor" />
                        {activeLesson.rating.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>

                <div className="mt-5 whitespace-pre-line rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-800">
                  {activeLesson?.content || "—"}
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-black text-slate-900">Rate this content</div>
                  <div className="mt-2 text-sm font-semibold text-slate-600">
                    Choose 1 to 5 stars, then click Finish.
                  </div>

                  <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <StarRating
                      value={activeLessonId ? ratings[activeLessonId] || 0 : 0}
                      onChange={(v) => {
                        if (!activeLessonId) return;
                        setRatings((prev) => ({ ...prev, [activeLessonId]: v }));
                      }}
                    />

                    <button
                      type="button"
                      onClick={finishReading}
                      disabled={!activeLessonId || (ratings[activeLessonId] || 0) < 1}
                      className={[
                        "inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white transition",
                        !activeLessonId || (ratings[activeLessonId] || 0) < 1
                          ? "bg-slate-300 cursor-not-allowed"
                          : `${BRAND_BG} hover:opacity-95`,
                      ].join(" ")}
                    >
                      <CheckCircle2 size={18} />
                      Finish
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