"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  Heart,
  Globe,
  MapPin,
  Tag,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type SupportListing = {
  id: string;
  title: string;
  description: string;
  category: "CRISIS" | "COUNSELLING" | "SELF_HELP" | "ONLINE" | "IN_PERSON";
  contact: string | null;
  url: string | null;
  is_urgent: boolean;
  is_active: boolean;
  created_at: string;
};

const CATEGORIES = ["CRISIS", "COUNSELLING", "SELF_HELP", "ONLINE", "IN_PERSON"] as const;

const CATEGORY_STYLES: Record<string, string> = {
  CRISIS: "bg-rose-50 text-rose-700 border-rose-200",
  COUNSELLING: "bg-sky-50 text-sky-700 border-sky-200",
  SELF_HELP: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ONLINE: "bg-violet-50 text-violet-700 border-violet-200",
  IN_PERSON: "bg-amber-50 text-amber-700 border-amber-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  CRISIS: "Crisis",
  COUNSELLING: "Counselling",
  SELF_HELP: "Self Help",
  ONLINE: "Online",
  IN_PERSON: "In Person",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "COUNSELLING" as SupportListing["category"],
  contact: "",
  url: "",
  is_urgent: false,
  is_active: true,
};

export default function AdminSupportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<SupportListing[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchListings = useCallback(async () => {
    const { data } = await supabase
      .from("support_directory")
      .select("*")
      .order("is_urgent", { ascending: false })
      .order("created_at", { ascending: false });
    setListings(data ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }
      const md: any = session.user.user_metadata || {};
      if (String(md?.role).toUpperCase() !== "ADMIN") { router.push("/post-login"); return; }
      await fetchListings();
      if (alive) setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router, fetchListings]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
    setShowForm(true);
  }

  function openEdit(l: SupportListing) {
    setEditingId(l.id);
    setForm({
      title: l.title,
      description: l.description,
      category: l.category,
      contact: l.contact ?? "",
      url: l.url ?? "",
      is_urgent: l.is_urgent,
      is_active: l.is_active,
    });
    setMsg(null);
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) {
      setMsg({ text: "Please fill in title and description.", type: "error" });
      return;
    }
    setSaving(true);
    setMsg(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      contact: form.contact.trim() || null,
      url: form.url.trim() || null,
      is_urgent: form.is_urgent,
      is_active: form.is_active,
    };

    if (editingId) {
      const { error } = await supabase
        .from("support_directory")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        setMsg({ text: `Failed to update: ${error.message}`, type: "error" });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("support_directory")
        .insert(payload);
      if (error) {
        setMsg({ text: `Failed to create: ${error.message}`, type: "error" });
        setSaving(false);
        return;
      }
    }

    await fetchListings();
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaving(false);
    setMsg({ text: editingId ? "Listing updated." : "Listing created.", type: "success" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this listing?")) return;
    setDeletingId(id);
    await supabase.from("support_directory").delete().eq("id", id);
    await fetchListings();
    setDeletingId(null);
  }

  async function toggleActive(l: SupportListing) {
    await supabase
      .from("support_directory")
      .update({ is_active: !l.is_active })
      .eq("id", l.id);
    setListings(prev => prev.map(x => x.id === l.id ? { ...x, is_active: !x.is_active } : x));
  }

  const urgent = listings.filter(l => l.is_urgent && l.is_active);
  const active = listings.filter(l => !l.is_urgent && l.is_active);
  const inactive = listings.filter(l => !l.is_active);

  if (loading) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-600">Loading support directory...</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Support Directory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage mental health listings shown on the employee home page.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-95 transition"
        >
          <Plus size={15} />
          Add Listing
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
        <span className="font-bold">Live connection:</span> Active listings automatically appear on the employee home page under Mental Health Support.
      </div>

      {/* Message */}
      {msg && !showForm && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
          msg.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-extrabold text-slate-900">
            {editingId ? "Edit Listing" : "Add New Listing"}
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Title <span className="text-rose-500">*</span></label>
                <input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Befrienders Malaysia"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value as SupportListing["category"] }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Description <span className="text-rose-500">*</span></label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of the resource..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Contact / Phone</label>
                <input
                  value={form.contact}
                  onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
                  placeholder="e.g. 03-7956 8145"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Website URL</label>
                <input
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_urgent}
                  onChange={e => setForm(p => ({ ...p, is_urgent: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-rose-500"
                />
                <span className="text-sm font-semibold text-slate-700">Mark as urgent (appears at top)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-500"
                />
                <span className="text-sm font-semibold text-slate-700">Active (visible to employees)</span>
              </label>
            </div>
          </div>

          {msg && (
            <p className={`mt-3 text-sm font-semibold ${msg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {msg.text}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving..." : editingId ? "Update" : "Add Listing"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setMsg(null); }}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Urgent listings */}
      {urgent.length > 0 && (
        <ListingGroup
          title="Urgent / Hotlines"
          items={urgent}
          onEdit={openEdit}
          onDelete={handleDelete}
          onToggle={toggleActive}
          deletingId={deletingId}
          accent="rose"
        />
      )}

      {/* Active listings */}
      <ListingGroup
        title="Active Listings"
        items={active}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggle={toggleActive}
        deletingId={deletingId}
        accent="teal"
      />

      {/* Inactive listings */}
      {inactive.length > 0 && (
        <ListingGroup
          title="Inactive (Hidden from employees)"
          items={inactive}
          onEdit={openEdit}
          onDelete={handleDelete}
          onToggle={toggleActive}
          deletingId={deletingId}
          accent="slate"
        />
      )}

      {listings.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 mb-3">
            <Heart size={20} className="text-slate-400" />
          </div>
          <div className="text-sm font-extrabold text-slate-900">No listings yet</div>
          <div className="mt-1 text-xs text-slate-500">Click Add Listing to create your first entry.</div>
        </div>
      )}
    </div>
  );
}

function ListingGroup({
  title, items, onEdit, onDelete, onToggle, deletingId, accent,
}: {
  title: string;
  items: SupportListing[];
  onEdit: (l: SupportListing) => void;
  onDelete: (id: string) => void;
  onToggle: (l: SupportListing) => void;
  deletingId: string | null;
  accent: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="glow-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-sm font-extrabold text-slate-900">
        {title} ({items.length})
      </div>
      <div className="space-y-3">
        {items.map(l => (
          <div key={l.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {l.is_urgent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-extrabold text-rose-700">
                      <AlertTriangle size={9} /> Urgent
                    </span>
                  )}
                  <div className="text-sm font-extrabold text-slate-900">{l.title}</div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${CATEGORY_STYLES[l.category]}`}>
                    <Tag size={9} className="mr-1" />
                    {CATEGORY_LABELS[l.category]}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mb-2">{l.description}</p>

                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  {l.contact && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} /> {l.contact}
                    </span>
                  )}
                  {l.url && (
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-600 hover:underline">
                      <Globe size={11} /> {l.url}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggle(l)}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition ${
                    l.is_active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  <CheckCircle2 size={12} />
                  {l.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(l)}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(l.id)}
                  disabled={deletingId === l.id}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50 transition"
                >
                  {deletingId === l.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />
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