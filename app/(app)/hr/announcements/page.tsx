"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus, Pencil, Trash2, Loader2, Megaphone, Calendar, Tag, ChevronDown, Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

type Announcement = {
  id: string;
  title: string;
  content: string;
  category: "WELLNESS" | "EVENT" | "REMINDER" | "GENERAL";
  publish_date: string;
  status: "PUBLISHED" | "UPCOMING" | "ARCHIVED";
  created_by: string;
  created_at: string;
};

const CATEGORIES = ["WELLNESS", "EVENT", "REMINDER", "GENERAL"] as const;
const STATUSES = ["PUBLISHED", "UPCOMING", "ARCHIVED"] as const;

const CATEGORY_META: Record<string, { color: string; dot: string }> = {
  WELLNESS: { color: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500" },
  EVENT:    { color: "bg-sky-50 text-sky-700 border-sky-200",   dot: "bg-sky-400" },
  REMINDER: { color: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  GENERAL:  { color: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

const STATUS_META: Record<string, { color: string; dot: string }> = {
  PUBLISHED: { color: "bg-cyan-50 text-cyan-700 border-cyan-200",   dot: "bg-cyan-500" },
  UPCOMING:  { color: "bg-sky-50 text-sky-700 border-sky-200",      dot: "bg-sky-400" },
  ARCHIVED:  { color: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function fmtDateDisplay(iso: string) {
  if (!iso) return "Select date";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "GENERAL" as Announcement["category"],
  publish_date: new Date().toISOString().slice(0, 10),
  status: "PUBLISHED" as Announcement["status"],
};

// ─── Custom Dropdown ──────────────────────────────────────────────

function StyledDropdown<T extends string>({
  value, onChange, options, label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  label: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
          open
            ? "border-cyan-400 bg-white shadow-[0_0_0_3px_rgba(6,182,212,0.15)]"
            : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/30"
        } text-slate-800`}
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
          {label(value)}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="p-1">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold transition ${
                  value === opt
                    ? "bg-cyan-500 text-white"
                    : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${value === opt ? "bg-white" : "bg-cyan-400"}`} />
                {label(opt)}
                {value === opt && <Check size={12} className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styled Date Input ────────────────────────────────────────────

function StyledDateInput({
  value, onChange, label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-1">
      {label && (
        <div className="text-xs font-bold text-slate-500">{label}</div>
      )}
      <div className={`relative inline-flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
        focused
          ? "border-cyan-400 bg-white shadow-[0_0_0_3px_rgba(6,182,212,0.15)]"
          : "border-slate-200 bg-white hover:border-cyan-300"
      }`}>
        <Calendar size={14} className="text-cyan-500 flex-shrink-0" />
        <span className="text-sm font-bold text-slate-700 flex-1 select-none pointer-events-none">
          {fmtDateDisplay(value)}
        </span>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from("hr_announcements")
      .select("*")
      .order("publish_date", { ascending: false });
    if (error) { console.error("Fetch error:", error.message); return; }
    setAnnouncements(data ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const role = String(profile?.role || "EMPLOYEE").toUpperCase();
      if (role !== "HR" && role !== "ADMIN") { router.push("/post-login"); return; }

      setCurrentUserId(session.user.id);
      await fetchAnnouncements();
      if (!alive) return;
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router, fetchAnnouncements]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
    setShowForm(true);
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      category: a.category,
      publish_date: a.publish_date,
      status: a.status,
    });
    setMsg(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.content.trim() || !form.publish_date) {
      setMsg({ text: "Please fill in title, content and publish date.", type: "error" });
      return;
    }
    if (!currentUserId) {
      setMsg({ text: "Session expired. Please log in again.", type: "error" });
      return;
    }

    setSaving(true);
    setMsg(null);

    if (editingId) {
      const { error } = await supabase
        .from("hr_announcements")
        .update({
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category,
          publish_date: form.publish_date,
          status: form.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);

      if (error) {
        setMsg({ text: `Failed to update: ${error.message}`, type: "error" });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("hr_announcements")
        .insert({
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category,
          publish_date: form.publish_date,
          status: form.status,
          created_by: currentUserId,
        });

      if (error) {
        setMsg({ text: `Failed to create: ${error.message}`, type: "error" });
        setSaving(false);
        return;
      }
    }

    await fetchAnnouncements();
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaving(false);
    setMsg({
      text: editingId ? "Announcement updated successfully." : "Announcement published successfully.",
      type: "success",
    });
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("hr_announcements").delete().eq("id", id);
    if (error) { console.error("Delete error:", error.message); setDeletingId(null); return; }
    await fetchAnnouncements();
    setDeletingId(null);
  }

  const published = announcements.filter((a) => a.status === "PUBLISHED");
  const upcoming  = announcements.filter((a) => a.status === "UPCOMING");
  const archived  = announcements.filter((a) => a.status === "ARCHIVED");

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading announcements...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">HR Announcements</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and manage announcements shown to all employees.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95"
        >
          <Plus size={16} />New Announcement
        </button>
      </div>

      {/* Toast message outside form */}
      {msg && !showForm && (
        <div className={[
          "mb-4 rounded-2xl border px-4 py-3 text-sm font-bold",
          msg.type === "success"
            ? "border-cyan-200 bg-cyan-50 text-cyan-700"
            : "border-rose-200 bg-rose-50 text-rose-700",
        ].join(" ")}>
          {msg.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Form header */}
          <div className="flex items-center gap-2 mb-5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
              <Megaphone size={14} />
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              {editingId ? "Edit Announcement" : "Create New Announcement"}
            </div>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                Title <span className="text-rose-400 normal-case tracking-normal">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Announcement title..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition placeholder:text-slate-400"
              />
            </div>

            {/* Content */}
            <div>
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                Content <span className="text-rose-400 normal-case tracking-normal">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Write your announcement here..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Row — Category, Status, Date */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Category
                </label>
                <StyledDropdown
                  value={form.category}
                  onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                  options={CATEGORIES}
                  label={(v) => v.charAt(0) + v.slice(1).toLowerCase()}
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Status
                </label>
                <StyledDropdown
                  value={form.status}
                  onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                  options={STATUSES}
                  label={(v) => v.charAt(0) + v.slice(1).toLowerCase()}
                />
              </div>

              <StyledDateInput
                value={form.publish_date}
                onChange={(v) => setForm((p) => ({ ...p, publish_date: v }))}
                label="PUBLISH DATE *"
              />
            </div>
          </div>

          {/* Form error message */}
          {msg && (
            <p className={`mt-3 text-sm font-semibold ${msg.type === "error" ? "text-rose-600" : "text-cyan-700"}`}>
              {msg.text}
            </p>
          )}

          {/* Form actions */}
          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 shadow-sm"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? "Saving..." : editingId ? "Update Announcement" : "Publish Announcement"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Announcement groups */}
      <AnnouncementGroup title="Published" items={published} onEdit={openEdit} onDelete={handleDelete} deletingId={deletingId} />
      <AnnouncementGroup title="Upcoming" items={upcoming} onEdit={openEdit} onDelete={handleDelete} deletingId={deletingId} />
      <AnnouncementGroup title="Archived" items={archived} onEdit={openEdit} onDelete={handleDelete} deletingId={deletingId} />

      {announcements.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100">
            <Megaphone size={20} className="text-slate-400" />
          </div>
          <div className="mt-4 text-base font-extrabold text-slate-900">No announcements yet</div>
          <div className="mt-1 text-sm text-slate-500">Click New Announcement to create your first one.</div>
        </div>
      )}
    </div>
  );
}

// ─── Announcement Group ───────────────────────────────────────────

function AnnouncementGroup({
  title, items, onEdit, onDelete, deletingId,
}: {
  title: string;
  items: Announcement[];
  onEdit: (a: Announcement) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  if (items.length === 0) return null;

  const groupAccent: Record<string, string> = {
    Published: "from-cyan-400 to-sky-500",
    Upcoming: "from-teal-400 to-cyan-500",
    Archived: "from-slate-300 to-slate-400",
  };

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className={`h-1 w-4 rounded-full bg-gradient-to-r ${groupAccent[title] ?? "from-cyan-400 to-sky-400"}`} />
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <span className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-extrabold text-cyan-700">
          {items.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {items.map((a) => {
          const cat = CATEGORY_META[a.category];
          const stat = STATUS_META[a.status];
          return (
            <div
              key={a.id}
              className="group rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-cyan-100 hover:shadow-sm p-4 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Title + badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <div className="text-sm font-extrabold text-slate-900">{a.title}</div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${cat.color}`}>
                      <span className={`h-1 w-1 rounded-full ${cat.dot}`} />
                      {a.category}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${stat.color}`}>
                      <span className={`h-1 w-1 rounded-full ${stat.dot}`} />
                      {a.status}
                    </span>
                  </div>

                  {/* Content preview */}
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{a.content}</p>

                  {/* Date */}
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-extrabold text-slate-500">
                    <Calendar size={10} className="text-cyan-500" />
                    {fmtDate(a.publish_date)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => onEdit(a)}
                    className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 transition"
                    aria-label="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={deletingId === a.id}
                    className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 transition disabled:opacity-50"
                    aria-label="Delete"
                  >
                    {deletingId === a.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}