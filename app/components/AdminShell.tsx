"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Brain,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  HeartHandshake,
  LogOut,
  Bell,
  Search,
  ChevronDown,
  BookOpen,
  Trophy,
  NotebookPen,
  Shield,
} from "lucide-react";

type Profile = {
  full_name: string;
  email: string;
};

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contentOpen, setContentOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const [notiCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;

      if (error || !data?.user) {
        setLoading(false);
        router.push("/auth");
        return;
      }

      const u = data.user;
      const md: any = u.user_metadata || {};
      const role = (md?.role ?? "EMPLOYEE") as string;

      if (String(role).toUpperCase() !== "ADMIN") {
        router.push("/post-login");
        return;
      }

      setProfile({
        full_name: md?.full_name ?? "Admin",
        email: u.email ?? "",
      });

      setLoading(false);
    }

    load();
    return () => { alive = false; };
  }, [router]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                <Brain size={18} />
              </div>
              <div className="text-base font-extrabold text-slate-900">BrainUp Admin</div>
            </div>
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 animate-pulse" />
            </div>
            <p className="mt-3 text-sm text-slate-500">Loading admin workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
          <Brain size={16} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-extrabold text-slate-900">BrainUp</div>
          <div className="text-[10px] font-semibold text-cyan-500 uppercase tracking-wider">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-none">
        <SectionLabel label="Overview" />
        <NavLink href="/admin/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" active={isActive("/admin/dashboard")} />

        <SectionLabel label="Management" />
        <NavLink href="/admin/users" icon={<Users size={16} />} label="User Management" active={isActive("/admin/users")} />

        <SectionLabel label="Content" />
        <CollapseGroup
          icon={<FileText size={16} />}
          label="Content Management"
          open={contentOpen}
          onToggle={() => setContentOpen(v => !v)}
          active={isActive("/admin/content")}
        >
          <SubNavLink href="/admin/content?tab=resources" icon={<BookOpen size={14} />} label="EI Resources" active={false} />
          <SubNavLink href="/admin/content?tab=journal" icon={<NotebookPen size={14} />} label="Journal Quotes" active={false} />
          <SubNavLink href="/admin/content?tab=gamification" icon={<Trophy size={14} />} label="Gamification" active={false} />
        </CollapseGroup>

        <SectionLabel label="System" />
        <NavLink href="/admin/settings" icon={<Settings size={16} />} label="System Settings" active={isActive("/admin/settings")} />
        <NavLink href="/admin/support" icon={<HeartHandshake size={16} />} label="Support Directory" active={isActive("/admin/support")} />
      </nav>

      <div className="mx-3 mb-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white text-xs font-extrabold">
            <Shield size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-extrabold text-slate-900">{profile.full_name}</div>
            <div className="text-[10px] text-cyan-600 font-bold">Administrator</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
            aria-label="Logout"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen gap-0 p-0 md:gap-4 md:p-4">

        <aside className="hidden md:flex w-64 shrink-0">
          <div className="sticky top-4 h-[calc(100vh-2rem)] w-full overflow-hidden rounded-3xl border border-white/30 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            {SidebarContent}
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-3 top-3 bottom-3 w-64 overflow-hidden rounded-3xl border border-white/30 bg-white shadow-2xl">
              {SidebarContent}
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0">
          <div className="sticky top-0 z-20 md:top-4">
            <div className="md:rounded-2xl border-b border-white/20 md:border bg-white/95 backdrop-blur md:shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  className="md:hidden grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600"
                  onClick={() => setMobileOpen(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>

                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search admin panel..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"
                  />
                </div>

                <button
                  type="button"
                  className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  {notiCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {notiCount}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white text-xs font-extrabold">
                    <Shield size={12} />
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <div className="text-xs font-extrabold text-slate-900">{profile.full_name}</div>
                    <div className="text-[10px] text-cyan-600 font-bold">Administrator</div>
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 md:px-0 md:pt-4">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-4 mb-1 px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
      {label}
    </div>
  );
}

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition mb-0.5",
        active
          ? "bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 text-white shadow-sm font-extrabold"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold",
      ].join(" ")}
    >
      <span className={[
        "grid h-7 w-7 place-items-center rounded-lg transition",
        active ? "bg-white/20" : "bg-slate-100",
      ].join(" ")}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function CollapseGroup({ icon, label, open, onToggle, active, children }: {
  icon: React.ReactNode; label: string; open: boolean; onToggle: () => void; active?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={[
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
          active && !open ? "bg-slate-100 text-slate-900 font-extrabold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold",
        ].join(" ")}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={14} className={["text-slate-400 transition-transform", open ? "rotate-0" : "-rotate-90"].join(" ")} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 border-l-2 border-slate-100 pl-3 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function SubNavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
        active ? "bg-cyan-50 text-cyan-700 font-extrabold" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-semibold",
      ].join(" ")}
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}

export default AdminShell;
export { AdminShell };