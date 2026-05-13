"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  LifeBuoy, Loader2, CheckCircle2, Clock, AlertCircle,
  CheckSquare, XCircle, Bug, Lock, Sparkles, Database,
  HelpCircle, ChevronDown, Check, MessageSquare, X, File,
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

const CATEGORY_META: Record<TicketCategory, { label: string; icon: React.ReactNode }> = {
  BUG:     { label: "Bug Report",       icon: <Bug size={13} /> },
  ACCESS:  { label: "Access Issue",     icon: <Lock size={13} /> },
  FEATURE: { label: "Feature Request",  icon: <Sparkles size={13} /> },
  DATA:    { label: "Data Issue",       icon: <Database size={13} /> },
  OTHER:   { label: "Other",            icon: <HelpCircle size={13} /> },
};

const STATUS_META: Record<TicketStatus, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  OPEN:        { label: "Open",        color: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500",  icon: <Clock size={11} /> },
  IN_PROGRESS: { label: "In Progress", color: "bg-cyan-50 text-cyan-700 border-cyan-200",      dot: "bg-cyan-500",   icon: <AlertCircle size={11} /> },
  RESOLVED:    { label: "Resolved",    color: "bg-teal-50 text-teal-700 border-teal-200",      dot: "bg-teal-500",   icon: <CheckSquare size={11} /> },
  CLOSED:      { label: "Closed",      color: "bg-slate-50 text-slate-500 border-slate-200",   dot: "bg-slate-400",  icon: <XCircle size={11} /> },
};

const PRIORITY_META: Record<TicketPriority, { label: string; color: string }> = {
  LOW:    { label: "Low",    color: "bg-slate-100 text-slate-600" },
  MEDIUM: { label: "Medium", color: "bg-sky-100 text-sky-700" },
  HIGH:   { label: "High",   color: "bg-cyan-100 text-cyan-800" },
  URGENT: { label: "Urgent", color: "bg-teal-100 text-teal-900" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Status Dropdown ──────────────────────────────────────
function StatusDropdown({ value, onChange }: { value: TicketStatus; onChange: (v: TicketStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const m = STATUS_META[value];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition ${m.color} hover:opacity-90`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
        {m.label}
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[150px] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-1">
            {(Object.keys(STATUS_META) as TicketStatus[]).map(s => {
              const sm = STATUS_META[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { onChange(s); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                    value === s ? "bg-cyan-500 text-white" : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${value === s ? "bg-white" : sm.dot}`} />
                  {sm.label}
                  {value === s && <Check size={11} className="ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Response Modal ───────────────────────────────────────
function ResponseModal({ open, ticket, onClose, onSaved }: {
  open: boolean;
  ticket: Ticket | null;
  onClose: () => void;
  onSaved: (t: Ticket) => void;
}) {
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<TicketStatus>("IN_PROGRESS");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setResponse(ticket.admin_response ?? "");
      setStatus(ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status);
      setErr(null);
    }
  }, [ticket]);

  if (!open || !ticket) return null;

  async function handleSave() {
    if (!ticket) return;
    setSaving(true);
    setErr(null);

    const update: any = {
      admin_response: response.trim() || null,
      status,
    };
    if (status === "RESOLVED" && !ticket.resolved_at) {
      update.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .update(update)
      .eq("id", ticket.id)
      .select()
      .single();

    setSaving(false);
    if (error) { setErr(error.message); return; }
    if (data) onSaved(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Modal header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-50 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
              <MessageSquare size={15} />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">Respond to Ticket</div>
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.subject}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Ticket info */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-extrabold text-slate-500 w-20">From</span>
              <span className="font-bold text-slate-800">{ticket.submitter_name}</span>
              <span className="text-slate-400">({ticket.submitter_role})</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-extrabold text-slate-500 w-20">Category</span>
              <span className="font-bold text-slate-700">{CATEGORY_META[ticket.category].label}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-extrabold text-slate-500 w-20">Submitted</span>
              <span className="font-bold text-slate-700">{fmtDate(ticket.created_at)}</span>
            </div>
          </div>

          {/* Original description */}
          <div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Original Description</div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</div>
          </div>

          {/* Status */}
          <div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Update Status</div>
            <StatusDropdown value={status} onChange={setStatus} />
          </div>

          {/* Response */}
          <div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Your Response</div>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={5}
              placeholder="Type your response to the HR user..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 resize-none"
            />
          </div>

          {err && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{err}</div>
          )}
        </div>

        {/* Modal footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? "Saving..." : "Save Response"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function AdminTicketsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<TicketStatus | "ALL">("ALL");
  const [responseTarget, setResponseTarget] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  const fetchTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setTickets(data ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (String(profile?.role || "").toUpperCase() !== "ADMIN") {
        router.push("/post-login");
        return;
      }

      await fetchTickets();
      if (!alive) return;
      setLoading(false);
    }
    init();
    return () => { alive = false; };
  }, [router, fetchTickets]);

  function handleSaved(t: Ticket) {
    setTickets(prev => prev.map(x => x.id === t.id ? t : x));
    setResponseTarget(null);
    showToast("Response saved successfully.");
  }

  const filtered = filter === "ALL" ? tickets : tickets.filter(t => t.status === filter);

  const counts: Record<string, number> = { ALL: tickets.length };
  for (const s of Object.keys(STATUS_META) as TicketStatus[]) {
    counts[s] = tickets.filter(t => t.status === s).length;
  }

  const openCount = counts["OPEN"] ?? 0;

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading tickets...</div>;

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 text-sm font-extrabold text-cyan-700 shadow-lg">
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} />{toast}</span>
        </div>
      )}

      <ResponseModal
        open={!!responseTarget}
        ticket={responseTarget}
        onClose={() => setResponseTarget(null)}
        onSaved={handleSaved}
      />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
            <LifeBuoy size={18} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Support Tickets</h1>
            <p className="text-sm text-slate-600">Review and respond to tickets submitted by HR users.</p>
          </div>
        </div>

        {openCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-700">
            <Clock size={13} />
            {openCount} ticket{openCount !== 1 ? "s" : ""} waiting for response
          </div>
        )}
      </div>

      {/* Filter pills */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mr-1">Filter</span>
          {(["ALL", ...Object.keys(STATUS_META)] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s as any)}
              className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${
                filter === s
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {s === "ALL" ? "All" : STATUS_META[s as TicketStatus].label} · {counts[s] ?? 0}
            </button>
          ))}
        </div>
      </section>

      {/* Ticket list */}
      <section className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <LifeBuoy size={28} className="mx-auto text-slate-300 mb-2" />
            <div className="text-sm font-bold text-slate-500">No tickets to show.</div>
            <div className="text-xs text-slate-400 mt-1">
              {filter === "ALL" ? "HR users haven't submitted any tickets yet." : `No ${STATUS_META[filter as TicketStatus]?.label} tickets.`}
            </div>
          </div>
        ) : (
          filtered.map(t => {
            const cat = CATEGORY_META[t.category];
            const stat = STATUS_META[t.status];
            const pri = PRIORITY_META[t.priority];
            return (
              <article
                key={t.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-cyan-100 transition"
              >
                <div className="flex items-start gap-3">
                  {/* Category icon */}
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-600">
                    {cat.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title + badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <div className="text-sm font-extrabold text-slate-900">{t.subject}</div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${stat.color}`}>
                        <span className={`h-1 w-1 rounded-full ${stat.dot}`} />
                        {stat.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${pri.color}`}>
                        {pri.label}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="text-[11px] text-slate-500 mb-2">
                      <strong className="text-slate-700">{t.submitter_name}</strong>
                      {" "}({t.submitter_role}) · {cat.label} · {fmtDate(t.created_at)}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-700 leading-relaxed line-clamp-2 whitespace-pre-wrap">{t.description}</p>

                    {/* Attachment */}
                    {t.attachment_url ? (
                      <button
                        type="button"
                        onClick={() => window.open(t.attachment_url!, "_blank")}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-extrabold text-cyan-700 hover:bg-cyan-100 transition"
                      >
                        <File size={12} />
                        {t.attachment_name ?? "View Attachment"}
                      </button>
                    ) : null}

                    {/* Admin response preview */}
                    {t.admin_response && (
                      <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5">
                        <div className="text-[10px] font-extrabold uppercase tracking-wide text-cyan-700 mb-1">Your Response</div>
                        <p className="text-sm text-cyan-900 leading-relaxed line-clamp-2 whitespace-pre-wrap">{t.admin_response}</p>
                        {t.resolved_at && (
                          <div className="text-[10px] font-bold text-cyan-600 mt-1">Resolved {fmtDate(t.resolved_at)}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Respond button */}
                  <button
                    type="button"
                    onClick={() => setResponseTarget(t)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 transition shrink-0"
                  >
                    <MessageSquare size={13} />
                    {t.admin_response ? "Update" : "Respond"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}