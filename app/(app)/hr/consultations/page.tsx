
"use client";
 
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  User,
  ChevronRight,
  Filter,
  Search,
  ArrowLeft,
  Loader2,
} from "lucide-react";
 
// ─── Types ───────────────────────────────────────────────────────────────────
 
type ConsultStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
 
type Consultation = {
  id: string;
  employee_name: string;
  department: string;
  requested_date: string; // ISO
  requested_time: string; // "HH:MM"
  reason: string;
  status: ConsultStatus;
  hr_note?: string;
  created_at: string; // ISO
};
 
// ─── Mock data (replace with Supabase fetch) ─────────────────────────────────
 
const MOCK_CONSULTATIONS: Consultation[] = [
  {
    id: "c1",
    employee_name: "Ahmad Danial",
    department: "Engineering",
    requested_date: "2025-03-20",
    requested_time: "10:00",
    reason: "Stress management and workload concerns.",
    status: "CONFIRMED",
    created_at: "2025-03-14T08:00:00Z",
  },
  {
    id: "c2",
    employee_name: "Nurul Izzati",
    department: "Marketing",
    requested_date: "2025-03-21",
    requested_time: "14:30",
    reason: "Interpersonal conflict with team member.",
    status: "PENDING",
    created_at: "2025-03-15T09:30:00Z",
  },
  {
    id: "c3",
    employee_name: "Kevin Lim",
    department: "Finance",
    requested_date: "2025-03-18",
    requested_time: "09:00",
    reason: "Career growth and emotional burnout.",
    status: "COMPLETED",
    hr_note: "Session went well. Follow-up in 2 weeks.",
    created_at: "2025-03-10T07:00:00Z",
  },
  {
    id: "c4",
    employee_name: "Siti Rahimah",
    department: "Operations",
    requested_date: "2025-03-17",
    requested_time: "11:00",
    reason: "Anxiety related to recent restructuring.",
    status: "CANCELLED",
    hr_note: "Employee rescheduled.",
    created_at: "2025-03-12T10:00:00Z",
  },
  {
    id: "c5",
    employee_name: "Raj Kumar",
    department: "Engineering",
    requested_date: "2025-03-22",
    requested_time: "15:00",
    reason: "General well-being check-in.",
    status: "PENDING",
    created_at: "2025-03-16T11:00:00Z",
  },
];
 
const STATUS_META: Record<
  ConsultStatus,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-700",
    icon: <Clock size={13} />,
  },
  CONFIRMED: {
    label: "Confirmed",
    bg: "bg-sky-50",
    text: "text-sky-700",
    icon: <CalendarDays size={13} />,
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    icon: <CheckCircle2 size={13} />,
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-rose-50",
    text: "text-rose-700",
    icon: <XCircle size={13} />,
  },
};
 
const ALL_STATUSES: ConsultStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];
 
// ─── Helpers ─────────────────────────────────────────────────────────────────
 
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}
 
function cryptoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
 
// ─── StatusBadge ─────────────────────────────────────────────────────────────
 
function StatusBadge({ status }: { status: ConsultStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold",
        m.bg,
        m.text,
      ].join(" ")}
    >
      {m.icon}
      {m.label}
    </span>
  );
}
 
// ─── BookingModal ─────────────────────────────────────────────────────────────
 
function BookingModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; date: string; time: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
 
  function reset() {
    setReason("");
    setDate("");
    setTime("");
    setErr(null);
    setSubmitting(false);
  }
 
  function handleClose() {
    reset();
    onClose();
  }
 
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!reason.trim()) { setErr("Please describe the reason for your consultation."); return; }
    if (!date) { setErr("Please select a preferred date."); return; }
    if (!time) { setErr("Please select a preferred time."); return; }
    setSubmitting(true);
    // simulate async
    await new Promise((r) => setTimeout(r, 600));
    onSubmit({ reason: reason.trim(), date, time });
    reset();
  }
 
  if (!open) return null;
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">Request Consultation</div>
            <div className="mt-1 text-sm text-slate-500">
              Fill in your details and an HR Manager will confirm your slot.
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
            <label className="text-xs font-extrabold text-slate-700">Reason for consultation</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Briefly describe what you would like to discuss..."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
 
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-700">Preferred date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-700">Preferred time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>
          </div>
 
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
 
// ─── NoteModal (HR only) ──────────────────────────────────────────────────────
 
function NoteModal({
  open,
  consultation,
  onClose,
  onSave,
}: {
  open: boolean;
  consultation: Consultation | null;
  onClose: () => void;
  onSave: (id: string, note: string, status: ConsultStatus) => void;
}) {
  const [note, setNote] = useState(consultation?.hr_note ?? "");
  const [status, setStatus] = useState<ConsultStatus>(consultation?.status ?? "PENDING");
  const [saving, setSaving] = useState(false);
 
  // sync when consultation changes
  if (consultation && note === "" && consultation.hr_note) setNote(consultation.hr_note);
 
  if (!open || !consultation) return null;
 
  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    onSave(consultation!.id, note, status);
    setSaving(false);
    onClose();
  }
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">Update Consultation</div>
            <div className="mt-1 text-sm text-slate-500">{consultation.employee_name} — {fmtDate(consultation.requested_date)}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>
 
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-extrabold text-slate-700">Status</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={[
                    "rounded-xl border px-3 py-2 text-xs font-extrabold transition",
                    status === s
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
 
          <div>
            <label className="text-xs font-extrabold text-slate-700">HR Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note for your records..."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
 
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
 
// ─── Main page ────────────────────────────────────────────────────────────────
 
export default function ConsultationsPage() {
  const router = useRouter();
 
  // In production, fetch from Supabase and detect role from auth context
  const isHR = true; // swap with real role check
 
  const [consultations, setConsultations] = useState<Consultation[]>(MOCK_CONSULTATIONS);
  const [filterStatus, setFilterStatus] = useState<ConsultStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
 
  const [bookingOpen, setBookingOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<Consultation | null>(null);
 
  const [toast, setToast] = useState<string | null>(null);
 
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }
 
  function handleBookingSubmit(data: { reason: string; date: string; time: string }) {
    const newC: Consultation = {
      id: cryptoId(),
      employee_name: "You", // replace with auth user name
      department: "—",
      requested_date: data.date,
      requested_time: data.time,
      reason: data.reason,
      status: "PENDING",
      created_at: new Date().toISOString(),
    };
    setConsultations((prev) => [newC, ...prev]);
    setBookingOpen(false);
    showToast("Consultation request submitted.");
  }
 
  function handleNoteSave(id: string, note: string, status: ConsultStatus) {
    setConsultations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, hr_note: note, status } : c))
    );
    setNoteTarget(null);
    showToast("Consultation updated.");
  }
 
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consultations.filter((c) => {
      const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
      const matchSearch =
        !q ||
        c.employee_name.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.reason.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [consultations, filterStatus, search]);
 
  const counts = useMemo(() => {
    const out: Record<string, number> = { ALL: consultations.length };
    for (const s of ALL_STATUSES) {
      out[s] = consultations.filter((c) => c.status === s).length;
    }
    return out;
  }, [consultations]);
 
  return (
    <div className="min-h-screen bg-[#f7fbff]">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-extrabold text-emerald-800 shadow-lg">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            {toast}
          </span>
        </div>
      )}
 
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSubmit={handleBookingSubmit}
      />
 
      <NoteModal
        open={!!noteTarget}
        consultation={noteTarget}
        onClose={() => setNoteTarget(null)}
        onSave={handleNoteSave}
      />
 
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                <CalendarDays size={18} />
              </span>
              <h1 className="text-xl font-extrabold text-slate-900">
                {isHR ? "HRBP Consultations" : "My Consultations"}
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {isHR
                ? "Review, confirm, and manage employee consultation requests."
                : "Request a confidential session with an HR Manager."}
            </p>
          </div>
 
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Back
            </button>
 
            {!isHR && (
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95"
              >
                <Plus size={16} />
                Request Session
              </button>
            )}
          </div>
        </div>
 
        {/* Stats row */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {ALL_STATUSES.map((s) => {
            const m = STATUS_META[s];
            return (
              <div key={s} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className={["text-xs font-bold", m.text].join(" ")}>{m.label}</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">{counts[s]}</div>
              </div>
            );
          })}
        </div>
 
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Search size={15} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee, department..."
              className="w-44 bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
 
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700">
            <Filter size={13} />
            Status
          </span>
 
          {(["ALL", ...ALL_STATUSES] as (ConsultStatus | "ALL")[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-extrabold transition",
                filterStatus === s
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {s === "ALL" ? `All (${counts.ALL})` : `${STATUS_META[s].label} (${counts[s]})`}
            </button>
          ))}
        </div>
 
        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-400">
              <CalendarDays size={22} />
            </div>
            <div className="mt-4 text-base font-extrabold text-slate-900">No consultations found</div>
            <div className="mt-1 text-sm text-slate-500">
              {search || filterStatus !== "ALL"
                ? "Try adjusting your filters."
                : "No consultation requests yet."}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                      <User size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">{c.employee_name}</div>
                      <div className="text-xs text-slate-500">{c.department}</div>
                    </div>
                  </div>
 
                  <StatusBadge status={c.status} />
                </div>
 
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {c.reason}
                </div>
 
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={13} />
                    {fmtDate(c.requested_date)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={13} />
                    {c.requested_time}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    Requested: {fmtDate(c.created_at)}
                  </span>
                </div>
 
                {c.hr_note && (
                  <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-800">
                    HR Note: {c.hr_note}
                  </div>
                )}
 
                {isHR && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setNoteTarget(c)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-50"
                    >
                      Manage
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
 