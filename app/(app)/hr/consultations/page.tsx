"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus,
  Calendar,
  Clock,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
} from "lucide-react";

type Consultation = {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  scheduled_date: string;
  scheduled_time: string;
  notes: string | null;
  status: "UPCOMING" | "COMPLETED" | "CANCELLED";
  created_at: string;
};

type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  department: string;
};

const STATUS_STYLES: Record<string, string> = {
  UPCOMING: "bg-sky-50 text-sky-700 border-sky-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default function ConsultationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");

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

      const [{ data: consultData }, { data: userData }] = await Promise.all([
        supabase
          .from("hrbp_consultations")
          .select("*")
          .order("scheduled_date", { ascending: false }),
        supabase.auth.admin
          ? Promise.resolve({ data: null })
          : Promise.resolve({ data: null }),
      ]);

      if (!alive) return;
      setConsultations(consultData ?? []);

      // Get users from auth metadata via emotion_checkins
      const { data: checkinUsers } = await supabase
        .from("emotion_checkins")
        .select("user_id, department")
        .order("checked_in_at", { ascending: false });

      // Deduplicate by user_id
      const seen = new Set<string>();
      const uniqueUsers: AuthUser[] = [];
      for (const row of checkinUsers ?? []) {
        if (!seen.has(row.user_id)) {
          seen.add(row.user_id);
          uniqueUsers.push({
            id: row.user_id,
            email: row.user_id,
            full_name: `User ${row.user_id.slice(0, 8)}`,
            department: row.department ?? "—",
          });
        }
      }
      setUsers(uniqueUsers);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  async function handleSubmit() {
    if (!selectedUserId || !scheduledDate || !scheduledTime) {
      setSaveMsg("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    const selectedUser = users.find((u) => u.id === selectedUserId);

    const { error } = await supabase.from("hrbp_consultations").insert({
      employee_id: selectedUserId,
      employee_name: selectedUser?.full_name ?? "Unknown",
      department: selectedUser?.department ?? "—",
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      notes: notes.trim() || null,
      status: "UPCOMING",
      created_by: currentUserId,
    });

    if (error) {
      setSaveMsg("Failed to save. Please try again.");
      setSaving(false);
      return;
    }

    // Send in-app notification to employee
    await supabase.from("notifications").insert({
      user_id: selectedUserId,
      title: "HRBP Consultation Scheduled",
      message: `A consultation has been scheduled for you on ${fmtDate(scheduledDate)} at ${scheduledTime}. ${notes ? `Note: ${notes}` : ""}`,
    });

    // Reload consultations
    const { data: fresh } = await supabase
      .from("hrbp_consultations")
      .select("*")
      .order("scheduled_date", { ascending: false });

    setConsultations(fresh ?? []);
    setShowForm(false);
    setSelectedUserId("");
    setScheduledDate("");
    setScheduledTime("");
    setNotes("");
    setSaveMsg("Consultation scheduled successfully.");
    setSaving(false);
  }

  async function updateStatus(id: string, status: "COMPLETED" | "CANCELLED") {
    await supabase
      .from("hrbp_consultations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    setConsultations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
  }

  const upcoming = consultations.filter((c) => c.status === "UPCOMING");
  const past = consultations.filter((c) => c.status !== "UPCOMING");

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading consultations...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">HRBP Consultations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Schedule and manage employee consultation sessions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setSaveMsg(null); }}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95"
        >
          <Plus size={16} />
          New Consultation
        </button>
      </div>

      {/* New consultation form */}
      {showForm && (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-extrabold text-slate-900">Schedule New Consultation</div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                Employee <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <option value="">Select an employee</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.department}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Notes / Reason</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional reason or agenda..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? "Saving..." : "Schedule Consultation"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>

          {saveMsg && (
            <p className="mt-3 text-sm text-slate-600">{saveMsg}</p>
          )}
        </section>
      )}

      {saveMsg && !showForm && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {saveMsg}
        </div>
      )}

      {/* Upcoming */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-extrabold text-slate-900">
          Upcoming ({upcoming.length})
        </div>

        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming consultations.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((c) => (
              <ConsultationCard
                key={c.id}
                consultation={c}
                onComplete={() => updateStatus(c.id, "COMPLETED")}
                onCancel={() => updateStatus(c.id, "CANCELLED")}
                showActions
              />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-extrabold text-slate-900">
          Past Consultations ({past.length})
        </div>

        {past.length === 0 ? (
          <p className="text-sm text-slate-500">No past consultations yet.</p>
        ) : (
          <div className="space-y-3">
            {past.map((c) => (
              <ConsultationCard key={c.id} consultation={c} showActions={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ConsultationCard({
  consultation: c,
  onComplete,
  onCancel,
  showActions,
}: {
  consultation: Consultation;
  onComplete?: () => void;
  onCancel?: () => void;
  showActions: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <div className="text-sm font-extrabold text-slate-900">{c.employee_name}</div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${STATUS_STYLES[c.status]}`}>
              {c.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Building2 size={12} />
              {c.department}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {fmtDate(c.scheduled_date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {c.scheduled_time}
            </span>
          </div>

          {c.notes && (
            <div className="mt-2 flex items-start gap-1 text-xs text-slate-600">
              <FileText size={12} className="mt-0.5 shrink-0" />
              {c.notes}
            </div>
          )}
        </div>

        {showActions && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-100"
            >
              <CheckCircle2 size={13} />
              Done
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
            >
              <XCircle size={13} />
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}