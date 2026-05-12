"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  CalendarDays, Clock, CheckCircle2, XCircle, Plus, X,
  ChevronRight, Filter, Search, Loader2, Sparkles, Mail,
  AlertTriangle, TrendingDown, Lightbulb, RefreshCw, UserCheck, User,
} from "lucide-react";

type ConsultStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

type Consultation = {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string | null;
  requested_date: string;
  requested_time: string;
  reason: string;
  status: ConsultStatus;
  hr_note: string | null;
  hr_id: string | null;
  hr_name: string | null;
  email_sent_at: string | null;
  ai_brief_cache: AiBrief | null;
  ai_brief_at: string | null;
  created_at: string;
};

type AiBrief = {
  summary: string;
  emotional_themes: string[];
  ei_gaps: { dimension: string; score: number; note: string }[];
  risk_flags: string[];
  talking_points: string[];
  generated_at: string;
};

const STATUS_META: Record<ConsultStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", icon: <Clock size={13} /> },
  CONFIRMED: { label: "Confirmed", bg: "bg-sky-50", text: "text-sky-700", icon: <CalendarDays size={13} /> },
  COMPLETED: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", icon: <CheckCircle2 size={13} /> },
  CANCELLED: { label: "Cancelled", bg: "bg-rose-50", text: "text-rose-700", icon: <XCircle size={13} /> },
};

const ALL_STATUSES: ConsultStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];

const DIMENSION_LABELS: Record<string, string> = {
  EA: "Emotional Awareness", EU: "Emotion Usage",
  EUS: "Emotional Understanding", EC: "Emotional Controlling",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function StatusBadge({ status }: { status: ConsultStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${m.bg} ${m.text}`}>
      {m.icon}{m.label}
    </span>
  );
}

// ─── Booking Modal ────────────────────────────────────────────────
function BookingModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (c: Consultation) => void;
}) {
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() { setReason(""); setDate(""); setTime(""); setErr(null); setSubmitting(false); }
  function handleClose() { reset(); onClose(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!reason.trim()) return setErr("Please describe the reason.");
    if (!date) return setErr("Please select a date.");
    if (!time) return setErr("Please select a time.");
    setSubmitting(true);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/hr/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ reason: reason.trim(), requested_date: date, requested_time: time }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      onCreated(data.consultation);
      reset();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">Request Consultation</div>
            <div className="mt-1 text-sm text-slate-500">Fill in your details and an HR Manager will confirm your slot.</div>
          </div>
          <button type="button" onClick={handleClose} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={16} /></button>
        </div>
        {err && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{err}</div>}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-extrabold text-slate-700">Reason for consultation</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Briefly describe what you would like to discuss..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-700">Preferred date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-700">Preferred time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── AI Brief Modal ───────────────────────────────────────────────
function AiBriefModal({ open, consultation, onClose, onUpdated }: {
  open: boolean; consultation: Consultation | null; onClose: () => void; onUpdated: (c: Consultation) => void;
}) {
  const [brief, setBrief] = useState<AiBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [meta, setMeta] = useState<{ journals_count: number; checkins_count: number; has_ei: boolean } | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!consultation) return;
    setLoading(true); setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch(`/api/hr/consultations/${consultation.id}/ai-brief${refresh ? "?refresh=1" : ""}`, {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate brief");
      setBrief(data.brief); setCached(!!data.cached); setMeta(data.meta ?? null);
      onUpdated({ ...consultation, ai_brief_cache: data.brief, ai_brief_at: data.brief.generated_at });
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate brief.");
    } finally { setLoading(false); }
  }, [consultation, onUpdated]);

  useEffect(() => {
    if (open && consultation) {
      if (consultation.ai_brief_cache) { setBrief(consultation.ai_brief_cache); setCached(true); setMeta(null); }
      else { setBrief(null); load(false); }
    }
    if (!open) { setBrief(null); setError(null); setMeta(null); }
  }, [open, consultation, load]);

  if (!open || !consultation) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm"><Sparkles size={18} /></div>
            <div>
              <div className="text-base font-extrabold text-slate-900">AI Consultation Brief</div>
              <div className="mt-0.5 text-xs text-slate-600">{consultation.employee_name} · {fmtDate(consultation.requested_date)} at {consultation.requested_time}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => load(true)} disabled={loading} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && !brief && (
            <div className="flex items-center justify-center gap-3 py-12">
              <Loader2 size={20} className="animate-spin text-cyan-500" />
              <span className="text-sm font-bold text-slate-600">Analysing emotional data with Groq...</span>
            </div>
          )}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
          {brief && (
            <div className="space-y-5">
              {(meta || cached) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {cached && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">Cached · {fmtDateTime(brief.generated_at)}</span>}
                  {meta && (<>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">{meta.journals_count} journals</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">{meta.checkins_count} check-ins</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">{meta.has_ei ? "EI on record" : "No EI yet"}</span>
                  </>)}
                </div>
              )}
              <section>
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-2">Summary</div>
                <p className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-800">{brief.summary}</p>
              </section>
              {brief.risk_flags.length > 0 && (
                <section>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-rose-600 mb-2 flex items-center gap-1.5"><AlertTriangle size={13} />Sensitivity Flags</div>
                  <ul className="space-y-1.5">{brief.risk_flags.map((f, i) => <li key={i} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800">{f}</li>)}</ul>
                </section>
              )}
              {brief.emotional_themes.length > 0 && (
                <section>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-2">Recurring Emotional Themes</div>
                  <div className="flex flex-wrap gap-2">{brief.emotional_themes.map((t, i) => <span key={i} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800">{t}</span>)}</div>
                </section>
              )}
              {brief.ei_gaps.length > 0 && (
                <section>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5"><TrendingDown size={13} />EI Dimension Gaps</div>
                  <div className="space-y-2">{brief.ei_gaps.map((g, i) => (
                    <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-extrabold text-amber-900">{DIMENSION_LABELS[g.dimension] ?? g.dimension}</div>
                        <div className="text-xs font-extrabold text-amber-700">{g.score}/100</div>
                      </div>
                      <p className="mt-1 text-xs text-amber-800 leading-relaxed">{g.note}</p>
                    </div>
                  ))}</div>
                </section>
              )}
              {brief.talking_points.length > 0 && (
                <section>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5"><Lightbulb size={13} />Suggested Talking Points</div>
                  <ol className="space-y-2 list-none">{brief.talking_points.map((p, i) => (
                    <li key={i} className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800">
                      <span className="text-xs font-extrabold text-cyan-600">{i + 1}.</span>
                      <span className="flex-1 leading-relaxed">{p}</span>
                    </li>
                  ))}</ol>
                </section>
              )}
              <p className="text-[11px] text-slate-400 italic border-t border-slate-100 pt-3">Generated by Groq AI from anonymised employee data. Use as a starting point — always rely on direct conversation with the employee.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Note Modal ───────────────────────────────────────────────────
function NoteModal({ open, consultation, onClose, onSaved }: {
  open: boolean; consultation: Consultation | null; onClose: () => void; onSaved: (c: Consultation, emailed: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<ConsultStatus>("PENDING");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (consultation) { setNote(consultation.hr_note ?? ""); setStatus(consultation.status); setErr(null); }
  }, [consultation]);

  if (!open || !consultation) return null;

  async function handleSave() {
    if (!consultation) return;
    setSaving(true); setErr(null);
    try {
      const headers = await authHeader();
      const res = await fetch(`/api/hr/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ status, hr_note: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onSaved(data.consultation, !!data.emailed);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">Update Consultation</div>
            <div className="mt-1 text-sm text-slate-500">{consultation.employee_name} — {fmtDate(consultation.requested_date)}</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={16} /></button>
        </div>
        {err && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{err}</div>}
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-extrabold text-slate-700">Status</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
            {status === "CONFIRMED" && !consultation.email_sent_at && (
              <p className="mt-2 text-xs font-semibold text-cyan-700">✉ A confirmation email will be sent automatically when you save.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-extrabold text-slate-700">HR Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Add a note for your records..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={handleSave} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-800 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function ConsultationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isHR, setIsHR] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [filterStatus, setFilterStatus] = useState<ConsultStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<Consultation | null>(null);
  const [briefTarget, setBriefTarget] = useState<Consultation | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  useEffect(() => {
    let alive = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const role = String((session.user.user_metadata as any)?.role ?? "EMPLOYEE").toUpperCase();

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const actualRole = String(profile?.role || role).toUpperCase();
      const hrLike = actualRole === "HR" || actualRole === "ADMIN";

      if (!alive) return;
      setIsHR(hrLike);
      setCurrentUserId(session.user.id);
      await fetchData();
      if (!alive) return;
      setLoading(false);
    }
    init();

    // Realtime subscription — auto-refresh when any consultation changes
    const channel = supabase
      .channel("consultations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations" },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [router]);

  async function fetchData() {
    const headers = await authHeader();
    const res = await fetch("/api/hr/consultations", { headers });
    const data = await res.json();
    if (res.ok) setConsultations(data.consultations ?? []);
  }

  async function handleClaim(c: Consultation) {
    setClaimingId(c.id);
    try {
      const headers = await authHeader();
      const res = await fetch(`/api/hr/consultations/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ action: "claim" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to claim");
      setConsultations((prev) => prev.map((x) => (x.id === c.id ? data.consultation : x)));
      showToast("Consultation claimed — it's now assigned to you.");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to claim.");
    } finally {
      setClaimingId(null);
    }
  }

  async function handleResendEmail(c: Consultation) {
    setResendingId(c.id);
    try {
      const headers = await authHeader();
      const res = await fetch(`/api/hr/consultations/${c.id}/resend-email`, {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      showToast("Email resent.");
      await fetchData();
    } catch (e: any) {
      showToast(e?.message ?? "Failed to resend.");
    } finally { setResendingId(null); }
  }

  function handleCreated(c: Consultation) { setConsultations((prev) => [c, ...prev]); setBookingOpen(false); showToast("Consultation request submitted."); }
  function handleSaved(c: Consultation, emailed: boolean) { setConsultations((prev) => prev.map((x) => (x.id === c.id ? c : x))); setNoteTarget(null); showToast(emailed ? "Saved · confirmation email sent." : "Consultation updated."); }
  function handleBriefUpdated(c: Consultation) { setConsultations((prev) => prev.map((x) => (x.id === c.id ? c : x))); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consultations.filter((c) => {
      const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
      const matchSearch = !q || c.employee_name.toLowerCase().includes(q) || (c.department ?? "").toLowerCase().includes(q) || c.reason.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [consultations, filterStatus, search]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { ALL: consultations.length };
    for (const s of ALL_STATUSES) { out[s] = consultations.filter((c) => c.status === s).length; }
    return out;
  }, [consultations]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-600">Loading consultations...</p></div>;

  return (
    <div className="min-h-screen bg-[#f7fbff]">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-extrabold text-emerald-800 shadow-lg">
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} />{toast}</span>
        </div>
      )}

      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onCreated={handleCreated} />
      <NoteModal open={!!noteTarget} consultation={noteTarget} onClose={() => setNoteTarget(null)} onSaved={handleSaved} />
      <AiBriefModal open={!!briefTarget} consultation={briefTarget} onClose={() => setBriefTarget(null)} onUpdated={handleBriefUpdated} />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm"><CalendarDays size={18} /></span>
              <h1 className="text-xl font-extrabold text-slate-900">{isHR ? "HRBP Consultations" : "My Consultations"}</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">{isHR ? "Review, claim, and manage employee consultation requests." : "Request a confidential session with an HR Manager."}</p>
          </div>
          {!isHR && (
            <button type="button" onClick={() => setBookingOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95">
              <Plus size={15} />New Request
            </button>
          )}
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 mr-2"><Filter size={14} className="text-slate-500" /><span className="text-xs font-extrabold text-slate-600">Status:</span></div>
            {(["ALL", ...ALL_STATUSES] as const).map((s) => (
              <button key={s} type="button" onClick={() => setFilterStatus(s as any)} className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${filterStatus === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                {s === "ALL" ? "All" : STATUS_META[s as ConsultStatus].label} · {counts[s] ?? 0}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <div className="text-sm font-bold text-slate-500">No consultations to show.</div>
            </div>
          ) : (
            filtered.map((c) => {
              const isClaimed = !!c.hr_id;
              const isMyCase = c.hr_id === currentUserId;

              return (
                <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-900">{c.employee_name}</span>
                        {c.department && <span className="text-xs text-slate-500">· {c.department}</span>}
                        <StatusBadge status={c.status} />
                        {c.email_sent_at && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-extrabold">
                            <Mail size={10} /> Emailed
                          </span>
                        )}
                        {c.ai_brief_cache && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 text-cyan-700 px-2 py-0.5 text-[10px] font-extrabold">
                            <Sparkles size={10} /> Brief ready
                          </span>
                        )}
                      </div>

                      {/* HR assignment badge */}
                      {isClaimed ? (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-extrabold text-teal-700">
                          <UserCheck size={11} />
                          {isMyCase ? "Assigned to you" : `Assigned to ${c.hr_name || "HR"}`}
                        </div>
                      ) : isHR ? (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-extrabold text-amber-700">
                          <User size={11} /> Unassigned
                        </div>
                      ) : null}

                      {/* Employee sees HR name */}
                      {!isHR && isClaimed && (
                        <div className="mt-1.5 text-xs text-slate-500">
                          Handled by <span className="font-extrabold text-slate-700">{c.hr_name || "HR Team"}</span>
                        </div>
                      )}

                      <div className="mt-1.5 text-xs text-slate-500">{fmtDate(c.requested_date)} at {c.requested_time} · requested {fmtDate(c.created_at)}</div>
                      <p className="mt-2 text-sm text-slate-700 leading-relaxed">{c.reason}</p>
                      {c.hr_note && <p className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600 italic">HR note: {c.hr_note}</p>}
                    </div>

                    {isHR && (
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Claim button — only show if unclaimed */}
                        {!isClaimed && (
                          <button type="button" onClick={() => handleClaim(c)} disabled={claimingId === c.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-extrabold text-teal-700 hover:bg-teal-100 disabled:opacity-50">
                            {claimingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                            Claim
                          </button>
                        )}

                        {/* AI brief — only for claimed cases */}
                        {isMyCase && (
                          <button type="button" onClick={() => setBriefTarget(c)} disabled={c.status === "CANCELLED"}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-500 px-3 py-2 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-50 shadow-sm">
                            <Sparkles size={13} />Prepare with AI
                          </button>
                        )}

                        {c.status === "CONFIRMED" && c.email_sent_at && isMyCase && (
                          <button type="button" onClick={() => handleResendEmail(c)} disabled={resendingId === c.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                            {resendingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                            Resend Email
                          </button>
                        )}

                        {isMyCase && (
                          <button type="button" onClick={() => setNoteTarget(c)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                            Update <ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                    )}
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