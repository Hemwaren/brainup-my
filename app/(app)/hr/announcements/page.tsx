"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Megaphone,
  Calendar,
  Tag,
} from "lucide-react";

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

const CATEGORY_STYLES: Record<string, string> = {
  WELLNESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EVENT: "bg-sky-50 text-sky-700 border-sky-200",
  REMINDER: "bg-amber-50 text-amber-700 border-amber-200",
  GENERAL: "bg-slate-50 text-slate-700 border-slate-200",
};

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPCOMING: "bg-sky-50 text-sky-700 border-sky-200",
  ARCHIVED: "bg-slate-50 text-slate-500 border-slate-200",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "GENERAL" as Announcement["category"],
  publish_date: new Date().toISOString().slice(0, 10),
  status: "PUBLISHED" as Announcement["status"],
};

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

    if (error) {
      console.error("Fetch error:", error.message);
      return;
    }
    setAnnouncements(data ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const md: any = session.user.user_metadata || {};
      const role = (md?.role ?? "EMPLOYEE") as string;
      if (String(role).toUpperCase() !== "HR" && String(role).toUpperCase() !== "ADMIN") {
        router.push("/post-login");
        return;
      }

      setCurrentUserId(session.user.id);

      const { data, error } = await supabase
        .from("hr_announcements")
        .select("*")
        .order("publish_date", { ascending: false });

      if (!alive) return;

      if (error) {
        console.error("Load error:", error.message);
      }

      setAnnouncements(data ?? []);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

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
        console.error("Update error:", error.message);
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
        console.error("Insert error:", error.message);
        setMsg({ text: `Failed to create: ${error.message}`, type: "error" });
        setSaving(false);
        return;
      }
    }

    // Refetch from Supabase to confirm save
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

    const { error } = await supabase
      .from("hr_announcements")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error.message);
      setDeletingId(null);
      return;
    }

    // Refetch from Supabase to confirm deletion
    await fetchAnnouncements();
    setDeletingId(null);
  }

  const published = announcements.filter((a) => a.status === "PUBLISHED");
  const upcoming = announcements.filter((a) => a.status === "UPCOMING");
  const archived = announcements.filter((a) => a.status === "ARCHIVED");

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading announcements...</p>
      </div>
    );
  }

  return (
    <div>
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
          <Plus size={16} />
          New Announcement
        </button>
      </div>

      {/* Message outside form */}
      {msg && !showForm && (
        <div className={[
          "mb-4 rounded-2xl border px-4 py-3 text-sm font-bold",
          msg.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700",
        ].join(" ")}>
          {msg.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-extrabold text-slate-900">
            {editingId ? "Edit Announcement" : "Create New Announcement"}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Announcement title..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                Content <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Write your announcement here..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Announcement["category"] }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  Publish Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.publish_date}
                  onChange={(e) => setForm((p) => ({ ...p, publish_date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Announcement["status"] }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {msg && (
            <p className={`mt-3 text-sm font-semibold ${msg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {msg.text}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? "Saving..." : editingId ? "Update" : "Publish"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Published */}
      <AnnouncementGroup
        title="Published"
        items={published}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletingId={deletingId}
      />

      {/* Upcoming */}
      <AnnouncementGroup
        title="Upcoming"
        items={upcoming}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletingId={deletingId}
      />

      {/* Archived */}
      <AnnouncementGroup
        title="Archived"
        items={archived}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletingId={deletingId}
      />

      {announcements.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100">
            <Megaphone size={20} className="text-slate-400" />
          </div>
          <div className="mt-4 text-base font-extrabold text-slate-900">No announcements yet</div>
          <div className="mt-1 text-sm text-slate-500">
            Click New Announcement to create your first one.
          </div>
        </div>
      )}
    </div>
  );
}

function AnnouncementGroup({
  title,
  items,
  onEdit,
  onDelete,
  deletingId,
}: {
  title: string;
  items: Announcement[];
  onEdit: (a: Announcement) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-sm font-extrabold text-slate-900">
        {title} ({items.length})
      </div>
      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <div className="text-sm font-extrabold text-slate-900">{a.title}</div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${CATEGORY_STYLES[a.category]}`}>
                    <Tag size={10} className="mr-1" />
                    {a.category}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${STATUS_STYLES[a.status]}`}>
                    {a.status}
                  </span>
                </div>

                <p className="text-sm text-slate-600 mt-1 line-clamp-2">{a.content}</p>

                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  <Calendar size={11} />
                  {fmtDate(a.publish_date)}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(a)}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                  aria-label="Delete"
                >
                  {deletingId === a.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />
                  }
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}