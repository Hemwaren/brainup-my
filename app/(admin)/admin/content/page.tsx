"use client";

import { useEffect, useState, useCallback, useRef, FC, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, Pencil, Trash2, Loader2, BookOpen, NotebookPen, Trophy,
  Tag, Calendar, Eye, Bookmark, CheckCircle2, XCircle, BarChart3,
  Zap, ChevronDown, FileText, Video, Sparkles, FileSpreadsheet,
  Link2, Circle, Archive,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
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

type JournalQuote = {
  id: string;
  quote: string;
  author: string;
  mood_category: string;
  publish_date: string;
  is_active: boolean;
  created_at: string;
};

type Mission = {
  id: string;
  title: string;
  description: string;
  activity_key: string;
  xp_reward: number;
  is_active: boolean;
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

const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t.label])
);

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

const MOOD_CATEGORIES = ["GENERAL", "HAPPY", "ANXIOUS", "SAD", "MOTIVATED", "STRESSED"];

const PILLARS = [
  { key: "KNOW_YOURSELF",   label: "Know Yourself"   },
  { key: "CHOOSE_YOURSELF", label: "Choose Yourself" },
  { key: "GIVE_YOURSELF",   label: "Give Yourself"   },
];

const EMPTY_RESOURCE = {
  title:        "",
  description:  "",
  content:      "",
  category:     "productivity",
  type:         "ARTICLE",
  status:       "PUBLISHED",
  resource_url: "",
};

const EMPTY_QUOTE = {
  quote:         "",
  author:        "",
  mood_category: "GENERAL",
  publish_date:  new Date().toISOString().slice(0, 10),
  is_active:     true,
};

// ─── Click-outside hook ───────────────────────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [ref, handler]);
}

const OutsideWrapper: FC<{ children: ReactNode; onClose: () => void; className?: string }> = ({
  children, onClose, className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);
  return <div ref={ref} className={className}>{children}</div>;
};

// ─── Generic Animated Dropdown ────────────────────────────────────────────────
type DropdownOption = {
  key: string;
  label: string;
  icon?: ReactNode;
  pillCls?: string;  // optional coloured pill class for status
};

function AnimatedDropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);

  return (
    <OutsideWrapper onClose={() => setOpen(false)} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-cyan-300 transition"
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.icon}
          <span className={selected?.pillCls}>{selected?.label ?? placeholder ?? "Select…"}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="shrink-0"
        >
          <ChevronDown size={15} className="text-slate-400" />
        </motion.span>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            >
              {options.map((opt) => (
                <motion.button
                  key={opt.key}
                  type="button"
                  role="option"
                  aria-selected={opt.key === value}
                  variants={{
                    hidden:  { opacity: 0, x: -10 },
                    visible: { opacity: 1, x: 0   },
                  }}
                  onClick={() => { onChange(opt.key); setOpen(false); }}
                  className={[
                    "flex w-full items-center gap-2.5 border-b border-slate-100 last:border-b-0 px-3 py-2.5 text-sm font-semibold transition-colors",
                    opt.key === value
                      ? "bg-cyan-50 text-cyan-700"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminContentPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tabParam     = searchParams.get("tab") ?? "resources";

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

  function goTab(tab: string) {
    setActiveTab(tab);
    router.push(`/admin/content?tab=${tab}`);
  }

  if (!authChecked) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Content Management</h1>
        <p className="mt-1 text-sm text-slate-500">Manage EI resources, journal quotes and gamification content.</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: "resources",    label: "EI Resources",  icon: <BookOpen    size={15} /> },
          { key: "journal",      label: "Journal Quotes", icon: <NotebookPen size={15} /> },
          { key: "gamification", label: "Gamification",  icon: <Trophy      size={15} /> },
        ].map((t) => (
          <button key={t.key} type="button" onClick={() => goTab(t.key)}
            className={[
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold border-b-2 transition -mb-px",
              activeTab === t.key ? "border-cyan-500 text-cyan-600" : "border-transparent text-slate-500 hover:text-slate-700",
            ].join(" ")}>
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
  const [resources,   setResources]   = useState<EIResource[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [form,        setForm]        = useState(EMPTY_RESOURCE);
  const [saving,      setSaving]      = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [msg,         setMsg]         = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [filterTopic, setFilterTopic] = useState("ALL");

  const needsLink = LINK_REQUIRED_TYPES.includes(form.type);

  const fetchResources = useCallback(async () => {
    const { data } = await supabase.from("ei_resources").select("*").order("created_at", { ascending: false });
    setResources(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  function openCreate() { setEditingId(null); setForm(EMPTY_RESOURCE); setMsg(null); setShowForm(true); }

  function openEdit(r: EIResource) {
    setEditingId(r.id);
    setForm({
      title:        r.title,
      description:  r.description,
      content:      r.content ?? "",
      category:     r.category,
      type:         r.type,
      status:       r.status,
      resource_url: r.resource_url ?? "",
    });
    setMsg(null);
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) {
      setMsg({ text: "Title and description are required.", type: "error" }); return;
    }
    if (needsLink && !form.resource_url.trim()) {
      setMsg({ text: `A link is required for ${form.type === "ARTICLE" ? "Article" : "Video"}.`, type: "error" }); return;
    }
    setSaving(true);

    const payload = {
      title:        form.title.trim(),
      description:  form.description.trim(),
      content:      form.content.trim() || null,
      category:     form.category,
      pillar:       "KNOW_YOURSELF",
      type:         form.type,
      status:       form.status,
      publish_date: new Date().toISOString().slice(0, 10),
      resource_url: needsLink ? form.resource_url.trim() : null,
      updated_at:   new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from("ei_resources").update(payload).eq("id", editingId);
      if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("ei_resources").insert(payload);
      if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; }
    }

    await fetchResources();
    setShowForm(false); setEditingId(null); setForm(EMPTY_RESOURCE); setSaving(false);
    setMsg({ text: editingId ? "Resource updated." : "Resource created.", type: "success" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this resource?")) return;
    setDeletingId(id);
    await supabase.from("ei_resources").delete().eq("id", id);
    await fetchResources();
    setDeletingId(null);
  }

  const filtered = filterTopic === "ALL" ? resources : resources.filter((r) => r.category === filterTopic);

  const statusMeta = (key: string) => RESOURCE_STATUSES.find((s) => s.key === key);
  const typeMeta   = (key: string) => RESOURCE_TYPES.find((t) => t.key === key);

  if (loading) return <div className="text-sm text-slate-500">Loading resources...</div>;

  // Dropdown option shapes
  const typeOptions: DropdownOption[]   = RESOURCE_TYPES.map((t) => ({ key: t.key, label: t.label, icon: t.icon }));
  const statusOptions: DropdownOption[] = RESOURCE_STATUSES.map((s) => ({ key: s.key, label: s.label, icon: s.icon, pillCls: s.cls }));
  const topicOptions: DropdownOption[]  = TOPICS.map((t) => ({ key: t.id, label: t.label }));

  return (
    <div className="space-y-4">

      {/* Topic filter pills + Add button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {[{ id: "ALL", label: "All" }, ...TOPICS].map((t) => (
            <button key={t.id} type="button" onClick={() => setFilterTopic(t.id)}
              className={[
                "rounded-xl px-3 py-1.5 text-xs font-extrabold transition",
                filterTopic === t.id
                  ? "bg-cyan-500 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              ].join(" ")}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-95 transition">
          <Plus size={14} /> Add Resource
        </button>
      </div>

      {/* Flash message */}
      {msg && !showForm && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {msg.text}
        </div>
      )}

      {/* ── Form ── */}
      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 text-sm font-extrabold text-slate-900">
            {editingId ? "Edit Resource" : "Add New Resource"}
          </div>

          <div className="space-y-4">

            {/* Row 1 — Title + Content Type */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Title *</label>
                <input value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Resource title..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Content Type</label>
                <AnimatedDropdown
                  value={form.type}
                  options={typeOptions}
                  onChange={(val) => setForm((p) => ({ ...p, type: val, resource_url: "" }))}
                />
              </div>
            </div>

            {/* Conditional link field */}
            <AnimatePresence>
              {needsLink && (
                <motion.div key="link-field"
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{   opacity: 0, height: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-700 mb-1.5">
                      <Link2 size={12} />
                      {form.type === "ARTICLE" ? "Article URL" : "Video URL"}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input value={form.resource_url}
                      onChange={(e) => setForm((p) => ({ ...p, resource_url: e.target.value }))}
                      placeholder={form.type === "ARTICLE" ? "https://example.com/article" : "https://youtube.com/watch?v=..."}
                      className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
                    <p className="mt-1.5 text-[11px] text-cyan-600">This link will be shown to employees when they open this resource.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Description *</label>
              <textarea value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2} placeholder="Brief description shown on the card..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none" />
            </div>

            {/* Content */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">
                Content <span className="font-normal text-slate-400">(optional — body text in reader)</span>
              </label>
              <textarea value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                rows={4} placeholder="Full content, notes or transcript..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none" />
            </div>

            {/* Row 2 — Topic + Status */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Topic</label>
                <AnimatedDropdown
                  value={form.category}
                  options={topicOptions}
                  onChange={(val) => setForm((p) => ({ ...p, category: val }))}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Status</label>
                <AnimatedDropdown
                  value={form.status}
                  options={statusOptions}
                  onChange={(val) => setForm((p) => ({ ...p, status: val }))}
                />
              </div>
            </div>
          </div>

          {msg && (
            <p className={`mt-3 text-sm font-semibold ${msg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {msg.text}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving..." : editingId ? "Update" : "Publish"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setMsg(null); }}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total",     value: resources.length,                                        icon: <BookOpen     size={14} />, color: "text-slate-600 bg-slate-50"    },
          { label: "Published", value: resources.filter((r) => r.status === "PUBLISHED").length, icon: <CheckCircle2 size={14} />, color: "text-emerald-600 bg-emerald-50" },
          { label: "Archived",  value: resources.filter((r) => r.status === "ARCHIVED").length,  icon: <XCircle      size={14} />, color: "text-slate-400 bg-slate-50"    },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className={`inline-flex h-7 w-7 place-items-center grid rounded-lg ${s.color} mb-2`}>{s.icon}</div>
            <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs font-bold text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Resource list */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-extrabold text-slate-900">{filtered.length} resources</div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No resources yet. Click Add Resource to create one.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((r) => {
              const sm = statusMeta(r.status);
              const tm = typeMeta(r.type);
              return (
                <div key={r.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <div className="text-sm font-extrabold text-slate-900">{r.title}</div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-600">
                        {tm?.icon}{tm?.label ?? r.type}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        r.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700"
                        : r.status === "DRAFT"   ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500"}`}>
                        {sm?.icon}{sm?.label ?? r.status}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-extrabold text-cyan-700">
                        <Tag size={8} className="mr-1" />{TOPIC_LABELS[r.category] ?? r.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{r.description}</p>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1"><Eye      size={10} />{r.view_count}</span>
                      <span className="inline-flex items-center gap-1"><Bookmark size={10} />{r.bookmark_count}</span>
                      <span className="inline-flex items-center gap-1"><Calendar size={10} />{r.publish_date}</span>
                      {r.resource_url && (
                        <span className="inline-flex items-center gap-1 text-cyan-500"><Link2 size={10} /> Link attached</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => openEdit(r)}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50 transition">
                      {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              );
            })}
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

  const fetchQuotes = useCallback(async () => {
    const { data } = await supabase.from("journal_quotes").select("*").order("publish_date", { ascending: false });
    setQuotes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  function openCreate() { setEditingId(null); setForm(EMPTY_QUOTE); setMsg(null); setShowForm(true); }
  function openEdit(q: JournalQuote) {
    setEditingId(q.id);
    setForm({ quote: q.quote, author: q.author, mood_category: q.mood_category, publish_date: q.publish_date, is_active: q.is_active });
    setMsg(null); setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.quote.trim()) { setMsg({ text: "Quote text is required.", type: "error" }); return; }
    setSaving(true);
    const payload = { quote: form.quote.trim(), author: form.author.trim() || "Unknown", mood_category: form.mood_category, publish_date: form.publish_date, is_active: form.is_active };
    if (editingId) {
      const { error } = await supabase.from("journal_quotes").update(payload).eq("id", editingId);
      if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("journal_quotes").insert(payload);
      if (error) { setMsg({ text: error.message, type: "error" }); setSaving(false); return; }
    }
    await fetchQuotes(); setShowForm(false); setEditingId(null); setForm(EMPTY_QUOTE); setSaving(false);
    setMsg({ text: editingId ? "Quote updated." : "Quote added.", type: "success" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this quote?")) return;
    setDeletingId(id);
    await supabase.from("journal_quotes").delete().eq("id", id);
    await fetchQuotes(); setDeletingId(null);
  }

  async function toggleActive(q: JournalQuote) {
    await supabase.from("journal_quotes").update({ is_active: !q.is_active }).eq("id", q.id);
    setQuotes((prev) => prev.map((x) => x.id === q.id ? { ...x, is_active: !x.is_active } : x));
  }

  if (loading) return <div className="text-sm text-slate-500">Loading quotes...</div>;

  const moodOptions: DropdownOption[] = MOOD_CATEGORIES.map((m) => ({ key: m, label: m }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">{quotes.length} quotes in library</div>
        <button type="button" onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-95 transition">
          <Plus size={14} /> Add Quote
        </button>
      </div>

      {msg && !showForm && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-extrabold text-slate-900">{editingId ? "Edit Quote" : "Add New Quote"}</div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Quote *</label>
              <textarea value={form.quote} onChange={(e) => setForm((p) => ({ ...p, quote: e.target.value }))} rows={3}
                placeholder="Enter the quote text..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Author</label>
                <input value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                  placeholder="e.g. Brené Brown"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Mood Category</label>
                <AnimatedDropdown
                  value={form.mood_category}
                  options={moodOptions}
                  onChange={(val) => setForm((p) => ({ ...p, mood_category: val }))}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Publish Date</label>
                <input type="date" value={form.publish_date}
                  onChange={(e) => setForm((p) => ({ ...p, publish_date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300" />
              <span className="text-sm font-semibold text-slate-700">Active (visible in journal)</span>
            </label>
          </div>
          {msg && <p className={`mt-3 text-sm font-semibold ${msg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>{msg.text}</p>}
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving..." : editingId ? "Update" : "Add Quote"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setMsg(null); }}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {quotes.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No quotes yet. Click Add Quote to create one.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {quotes.map((q) => (
              <div key={q.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 italic mb-1 line-clamp-2">&#34;{q.quote}&#34;</div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="font-bold text-slate-700">— {q.author}</span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold">{q.mood_category}</span>
                    <span className="inline-flex items-center gap-1"><Calendar size={10} />{q.publish_date}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => toggleActive(q)}
                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition ${q.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                    <CheckCircle2 size={11} />{q.is_active ? "Active" : "Inactive"}
                  </button>
                  <button type="button" onClick={() => openEdit(q)}
                    className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => handleDelete(q.id)} disabled={deletingId === q.id}
                    className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50 transition">
                    {deletingId === q.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Gamification Tab ─────────────────────────────────────────────────────────
function GamificationTab() {
  const [missions,  setMissions]  = useState<Mission[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);
  const [msg,       setMsg]       = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    const { data } = await supabase.from("daily_missions")
      .select("id, title, description, activity_key, xp_reward, is_active")
      .order("xp_reward", { ascending: false });
    setMissions(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  async function toggleMission(m: Mission) {
    setSaving(m.id);
    await supabase.from("daily_missions").update({ is_active: !m.is_active }).eq("id", m.id);
    setMissions((prev) => prev.map((x) => x.id === m.id ? { ...x, is_active: !x.is_active } : x));
    setSaving(null);
  }

  async function updateXP(id: string, xp: number) {
    if (xp < 1 || xp > 50) return;
    await supabase.from("daily_missions").update({ xp_reward: xp }).eq("id", id);
    setMissions((prev) => prev.map((x) => x.id === id ? { ...x, xp_reward: xp } : x));
    setMsg("XP updated."); setTimeout(() => setMsg(null), 2000);
  }

  if (loading) return <div className="text-sm text-slate-500">Loading missions...</div>;

  const activeMissions   = missions.filter((m) => m.is_active);
  const inactiveMissions = missions.filter((m) => !m.is_active);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Missions", value: missions.length,                                      icon: <Trophy       size={14} />, color: "bg-slate-50 text-slate-600"    },
          { label: "Active",         value: activeMissions.length,                                 icon: <CheckCircle2 size={14} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Total XP Pool",  value: activeMissions.reduce((s, m) => s + m.xp_reward, 0),  icon: <Zap          size={14} />, color: "bg-cyan-50 text-cyan-600"      },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className={`inline-flex h-7 w-7 place-items-center grid rounded-lg ${s.color} mb-2`}>{s.icon}</div>
            <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs font-bold text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
        <span className="font-bold">Note:</span> Toggle missions on/off to control what employees see. Adjust XP values to balance the reward system.
      </div>

      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{msg}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <div className="text-sm font-extrabold text-slate-900">Active Missions ({activeMissions.length})</div>
        </div>
        <div className="divide-y divide-slate-100">
          {activeMissions.map((m) => <MissionRow key={m.id} mission={m} onToggle={toggleMission} onXPChange={updateXP} saving={saving === m.id} />)}
        </div>
      </section>

      {inactiveMissions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <XCircle size={14} className="text-slate-400" />
            <div className="text-sm font-extrabold text-slate-900">Inactive Missions ({inactiveMissions.length})</div>
          </div>
          <div className="divide-y divide-slate-100">
            {inactiveMissions.map((m) => <MissionRow key={m.id} mission={m} onToggle={toggleMission} onXPChange={updateXP} saving={saving === m.id} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function MissionRow({ mission: m, onToggle, onXPChange, saving }: {
  mission: Mission; onToggle: (m: Mission) => void; onXPChange: (id: string, xp: number) => void; saving: boolean;
}) {
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
        <input type="number" value={xpInput} min={1} max={50}
          onChange={(e) => setXpInput(e.target.value)}
          onBlur={() => onXPChange(m.id, Number(xpInput))}
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