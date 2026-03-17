"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Users,
  Search,
  Filter,
  Download,
  Shield,
  UserCircle2,
  Trash2,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type User = {
  id: string;
  full_name: string;
  role: string;
  department: string;
  last_active: string | null;
  is_flagged: boolean;
};

const ROLE_STYLES: Record<string, string> = {
  EMPLOYEE: "bg-slate-50 text-slate-700 border-slate-200",
  HR: "bg-sky-50 text-sky-700 border-sky-200",
  ADMIN: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const md: any = session.user.user_metadata || {};
      if (String(md?.role).toUpperCase() !== "ADMIN") {
        router.push("/post-login");
        return;
      }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, role, department")
        .order("full_name", { ascending: true });

      // Fetch last active from emotion checkins
      const { data: checkins } = await supabase
        .from("emotion_checkins")
        .select("user_id, checked_in_at")
        .order("checked_in_at", { ascending: false });

      // Fetch flagged users (3+ low emotion checkins in 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: flaggedCheckins } = await supabase
        .from("emotion_checkins")
        .select("user_id")
        .eq("emotion_level", 1)
        .gte("checked_in_at", sevenDaysAgo.toISOString());

      if (!alive) return;

      // Count flags per user
      const flagCount: Record<string, number> = {};
      for (const c of flaggedCheckins ?? []) {
        flagCount[c.user_id] = (flagCount[c.user_id] ?? 0) + 1;
      }

      // Last active per user
      const lastActive: Record<string, string> = {};
      for (const c of checkins ?? []) {
        if (!lastActive[c.user_id]) {
          lastActive[c.user_id] = c.checked_in_at;
        }
      }

      const built: User[] = (profiles ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name ?? "Unknown",
        role: p.role ?? "EMPLOYEE",
        department: p.department ?? "—",
        last_active: lastActive[p.id] ?? null,
        is_flagged: (flagCount[p.id] ?? 0) >= 3,
      }));

      setUsers(built);
      setFiltered(built);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    let result = users;
    if (roleFilter !== "ALL") {
      result = result.filter(u => u.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.full_name.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, roleFilter, users]);

  async function changeRole(userId: string, newRole: string) {
    setChangingRoleId(userId);
    setMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      setMsg({ text: "Failed to update role.", type: "error" });
      setChangingRoleId(null);
      return;
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setMsg({ text: "Role updated successfully.", type: "success" });
    setChangingRoleId(null);
  }

  async function deleteUser(userId: string) {
    if (!confirm("Are you sure you want to remove this user? This cannot be undone.")) return;
    setDeletingId(userId);
    setMsg(null);

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (error) {
      setMsg({ text: "Failed to remove user.", type: "error" });
      setDeletingId(null);
      return;
    }

    setUsers(prev => prev.filter(u => u.id !== userId));
    setMsg({ text: "User removed successfully.", type: "success" });
    setDeletingId(null);
  }

  function exportCSV() {
    const headers = ["Name", "Role", "Department", "Last Active", "Flagged"];
    const rows = filtered.map(u => [
      u.full_name,
      u.role,
      u.department,
      u.last_active ? new Date(u.last_active).toLocaleDateString() : "Never",
      u.is_flagged ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brainup-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalEmployees = users.filter(u => u.role === "EMPLOYEE").length;
  const totalHR = users.filter(u => u.role === "HR").length;
  const totalFlagged = users.filter(u => u.is_flagged).length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage all BrainUp users across roles and departments.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCSV}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Users", value: users.length, icon: <Users size={16} />, color: "bg-slate-50 text-slate-600" },
          { label: "HR Managers", value: totalHR, icon: <Shield size={16} />, color: "bg-sky-50 text-sky-600" },
          { label: "Flagged", value: totalFlagged, icon: <AlertTriangle size={16} />, color: totalFlagged > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="glow-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`inline-grid h-8 w-8 place-items-center rounded-xl ${s.color} mb-2`}>
              {s.icon}
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs font-bold text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
          msg.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or department..."
            className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 transition"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-cyan-300 appearance-none cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="HR">HR Manager</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* User table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-extrabold text-slate-900">
            {filtered.length} {filtered.length === 1 ? "user" : "users"} found
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 mb-3">
              <Users size={20} className="text-slate-400" />
            </div>
            <div className="text-sm font-extrabold text-slate-900">No users found</div>
            <div className="mt-1 text-xs text-slate-500">Try adjusting your search or filter.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition">

                {/* Avatar */}
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white text-sm font-extrabold">
                  {u.full_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-extrabold text-slate-900">{u.full_name}</div>
                    {u.is_flagged && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
                        <AlertTriangle size={9} />
                        Flagged
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{u.department}</div>
                </div>

                {/* Role badge */}
                <span className={`hidden sm:inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${ROLE_STYLES[u.role] ?? ROLE_STYLES.EMPLOYEE}`}>
                  {u.role === "HR" ? "HR Manager" : u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                </span>

                {/* Last active */}
                <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 shrink-0">
                  <CheckCircle2 size={12} />
                  {timeAgo(u.last_active)}
                </div>

                {/* Role change */}
                <div className="relative shrink-0">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    disabled={changingRoleId === u.id || u.role === "ADMIN"}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-cyan-300 appearance-none cursor-pointer disabled:opacity-50 pr-6"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="HR">HR Manager</option>
                    <option value="ADMIN" disabled>Admin</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => deleteUser(u.id)}
                  disabled={deletingId === u.id || u.role === "ADMIN"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 transition disabled:opacity-30"
                  aria-label="Remove user"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}