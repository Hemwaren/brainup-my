"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  LifeBuoy, Plus, X, Loader2, CheckCircle2, AlertCircle,
  Clock, CheckSquare, XCircle, Bug, Lock, Sparkles,
  Database, HelpCircle, Paperclip, FileText, Film, File,
} from "lucide-react";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type TicketCategory = "BUG" | "ACCESS" | "FEATURE" | "DATA" | "OTHER";

type Ticket = {
  id: string;
  submitter_id: string;
  submitter_name: string;
  submitter_role: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  admin_response: string | null;
  resolved_at: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
};

const CATEGORY_META: Record<TicketCategory, { label: string; icon: React.ReactNode; color: string }> = {
  BUG:     { label: "Bug Report",      icon: <Bug size={14} />,        color: "text-rose-600" },
  ACCESS:  { label: "Access Issue",    icon: <Lock size={14} />,       color: "text-amber-600" },
  FEATURE: { label: "Feature Request", icon: <Sparkles size={14} />,   color: "text-cyan-600" },
  DATA:    { label: "Data Issue",      icon: <Database size={14} />,   color: "text-violet-600" },
  OTHER:   { label: "Other",           icon: <HelpCircle size={14} />, color: "text-slate-600" },
};

const STATUS_META: Record<TicketStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  OPEN:        { label: "Open",        bg: "bg-amber-50",   text: "text-amber-700",   icon: <Clock size={12} /> },
  IN_PROGRESS: { label: "In Progress", bg: "bg-sky-50",     text: "text-sky-700",     icon: <AlertCircle size={12} /> },
  RESOLVED:    { label: "Resolved",    bg: "bg-emerald-50", text: "text-emerald-700", icon: <CheckSquare size={12} /> },
  CLOSED:      { label: "Closed",      bg: "bg-slate-50",   text: "text-slate-600",   icon: <XCircle size={12} /> },
};

const PRIORITY_META: Record<TicketPriority, { label: string; color: string }> = {
  LOW:    { label: "Low",    color: "bg-slate-100 text-slate-700" },
  MEDIUM: { label: "Medium", color: "bg-cyan-100 text-cyan-800" },
  HIGH:   { label: "High",   color: "bg-amber-100 text-amber-800" },
  URGENT: { label: "Urgent", color: "bg-rose-100 text-rose-800" },
};

const ACCEPTED_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4", "video/webm", "video/quicktime",
].join(",");

const MAX_FILE_SIZE_MB = 20;

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function getFileIcon(name: string | null) {
  if (!name) return <File size={13} />;
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext ?? "")) return <FileText size={13} />;
  if (["mp4", "webm", "mov"].includes(ext ?? "")) return <Film size={13} />;
  if (ext === "pdf") return <FileText size={13} />;
  return <File size={13} />;
}

function SubmitTicketModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (t: Ticket) => void;
}) {
  const [category, setCategory] = useState<TicketCategory>("BUG");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCategory("BUG");
    setPriority("MEDIUM");
    setSubject("");
    setDescription("");
    setFile(null);
    setUploadProgress(0);
    setErr(null);
  }

  function handleClose() { reset(); onClose(); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErr(`File too large. Max size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    setErr(null);
    setFile(f);
  }

  function removeFile() {
    setFile(null);
    setUploadProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!subject.trim()) return setErr("Please enter a subject.");
    if (!description.trim()) return setErr("Please describe the issue.");

    setSubmitting(true);

    let attachment_url: string | null = null;
    let attachment_name: string | null = null;

    if (file) {
      setUploadProgress(10);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id ?? "unknown";
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, file, { upsert: false });

      if (uploadErr) {
        setErr(`Upload failed: ${uploadErr.message}`);
        setSubmitting(false);
        return;
      }

      setUploadProgress(80);
      const { data: urlData } = supabase.storage
        .from("ticket-attachments")
        .getPublicUrl(uploadData.path);

      attachment_url = urlData.publicUrl;
      attachment_name = file.name;
      setUploadProgress(100);
    }

    try {
      const headers = await authHeader();
      const res = await fetch("/api/hr/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          category,
          priority,
          subject: subject.trim(),
          description: description.trim(),
          attachment_url,
          attachment_name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      onCreated(data.ticket);
      reset();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">Submit Support Ticket</div>
            <div className="mt-1 text-sm text-slate-500">
              Report bugs, request features, or escalate platform issues to Admin.
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-extrabold text-slate-700">Category</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_META) as TicketCategory[]).map((c) => {
                const m = CATEGORY_META[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-extrabold transition ${
                      category === c
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className={category === c ? "text-white" : m.color}>{m.icon}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-700">Priority</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(PRIORITY_META) as TicketPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                    priority === p
                      ? "ring-2 ring-slate-900 " + PRIORITY_META[p].color
                      : PRIORITY_META[p].color + " opacity-60"
                  }`}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder="Brief summary"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Include steps to reproduce, screenshots referenced, expected vs actual behaviour..."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-700">
              Attachment <span className="font-normal text-slate-400">(optional · max {MAX_FILE_SIZE_MB}MB)</span>
            </label>
            {!file ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center hover:border-cyan-300 hover:bg-cyan-50/30 transition"
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-500">
                  <Paperclip size={16} />
                </div>
                <div className="text-xs font-bold text-slate-600">Click to attach a file</div>
                <div className="text-[10px] text-slate-400">PDF, Image, Word, PowerPoint, Video</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-100 text-cyan-600">
                  {getFileIcon(file.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-extrabold text-slate-800 truncate">{file.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  {submitting && uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cyan-200">
                      <div
                        className="h-full rounded-full bg-cyan-500 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-cyan-100 hover:text-slate-600 transition"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60 shadow-sm"
          >
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : "Submit Ticket"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "ALL">("ALL");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  useEffect(() => {
    let alive = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }
      await fetchTickets();
      if (!alive) return;
      setLoading(false);
    }
    init();
    return () => { alive = false; };
  }, [router]);

  async function fetchTickets() {
    const headers = await authHeader();
    const res = await fetch("/api/hr/support-tickets", { headers });
    const data = await res.json();
    if (res.ok) setTickets(data.tickets ?? []);
  }

  function handleCreated(t: Ticket) {
    setTickets((prev) => [t, ...prev]);
    setSubmitOpen(false);
    showToast("Ticket submitted to Admin.");
  }

  const filtered = useMemo(() => {
    if (filterStatus === "ALL") return tickets;
    return tickets.filter((t) => t.status === filterStatus);
  }, [tickets, filterStatus]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { ALL: tickets.length };
    for (const s of Object.keys(STATUS_META) as TicketStatus[]) {
      out[s] = tickets.filter((t) => t.status === s).length;
    }
    return out;
  }, [tickets]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading support tickets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-extrabold text-emerald-800 shadow-lg">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            {toast}
          </span>
        </div>
      )}

      <SubmitTicketModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onCreated={handleCreated}
      />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                <LifeBuoy size={18} />
              </span>
              <h1 className="text-xl font-extrabold text-slate-900">Support Tickets</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Report platform issues to Admin or track your past tickets.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubmitOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95"
          >
            <Plus size={15} />
            Submit Ticket
          </button>
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-slate-600 mr-2">Status:</span>
            {(["ALL", ...Object.keys(STATUS_META)] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s as any)}
                className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${
                  filterStatus === s
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_META[s as TicketStatus].label} · {counts[s] ?? 0}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <LifeBuoy size={32} className="mx-auto text-slate-300 mb-3" />
              <div className="text-sm font-bold text-slate-500">No tickets yet.</div>
              <div className="mt-1 text-xs text-slate-400">Click &quot;Submit Ticket&quot; to report an issue.</div>
            </div>
          ) : (
            filtered.map((t) => {
              const cat = CATEGORY_META[t.category];
              const stat = STATUS_META[t.status];
              const pri = PRIORITY_META[t.priority];
              return (
                <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 place-items-center rounded-xl bg-slate-50 ${cat.color}`}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900">{t.subject}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${stat.bg} ${stat.text}`}>
                          {stat.icon}{stat.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${pri.color}`}>
                          {pri.label}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {cat.label} · submitted {fmtDate(t.created_at)}
                      </div>
                      <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {t.description}
                      </p>

                      {t.attachment_url ? (
                        <button
                          type="button"
                          onClick={() => window.open(t.attachment_url!, "_blank")}
                          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-extrabold text-cyan-700 hover:bg-cyan-100 transition"
                        >
                          {getFileIcon(t.attachment_name)}
                          {t.attachment_name ?? "View Attachment"}
                        </button>
                      ) : null}

                      {t.admin_response && (
                        <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                          <div className="text-[10px] font-extrabold uppercase tracking-wide text-cyan-700 mb-1">
                            Admin Response
                          </div>
                          <p className="text-sm text-cyan-900 leading-relaxed whitespace-pre-wrap">
                            {t.admin_response}
                          </p>
                          {t.resolved_at && (
                            <div className="mt-2 text-[10px] font-bold text-cyan-600">
                              Resolved {fmtDate(t.resolved_at)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}