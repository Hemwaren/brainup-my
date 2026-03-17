"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getLevelFromXP } from "@/lib/gamification";
import {
  Bell,
  Brain,
  ChevronDown,
  LayoutDashboard,
  UserCircle2,
  Settings,
  BookOpen,
  ClipboardList,
  LibraryBig,
  NotebookPen,
  Trophy,
  LogOut,
  Search,
  BarChart3,
  Gift,
  Users,
  LayoutGrid,
  Sparkles,
} from "lucide-react";

type AppRole = "EMPLOYEE" | "HR" | "ADMIN" | string;

type Profile = {
  full_name: string;
  email: string;
  role: AppRole;
  department: string;
  joined_at: string;
  avatar_url?: string | null;
};

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalXP, setTotalXP] = useState(0);
  const [level, setLevel] = useState(1);

  const [hubOpen, setHubOpen] = useState(true);
  const [gamificationOpen, setGamificationOpen] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
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

      let dbProfile: any = null;
      try {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, role, department, joined_at, avatar_url")
          .eq("id", u.id)
          .maybeSingle();
        dbProfile = p || null;
      } catch {
        dbProfile = null;
      }

      try {
        const { data: g } = await supabase
          .from("user_gamification")
          .select("total_xp, level")
          .eq("user_id", u.id)
          .maybeSingle();
        if (alive && g) {
          setTotalXP(g.total_xp ?? 0);
          setLevel(g.level ?? 1);
        }
      } catch {
        // silent
      }

      const role: AppRole = (dbProfile?.role ?? md?.role ?? "EMPLOYEE") as AppRole;
      const deptRaw = (dbProfile?.department ?? md?.department ?? md?.dept ?? "") as string;
      const department = String(role).toUpperCase() === "HR" ? "Human Resources" : deptRaw || "—";
      const joined_at = (dbProfile?.joined_at ?? md?.joined_at ?? u.created_at ?? new Date().toISOString()) as string;
      const full_name = (dbProfile?.full_name ?? md?.full_name ?? md?.name ?? "User") as string;
      const avatar_url = (dbProfile?.avatar_url ?? md?.avatar_url ?? null) as string | null;

      setProfile({ full_name, email: u.email ?? "", role, department, joined_at, avatar_url });
      setLoading(false);
    }

    load();
    return () => { alive = false; };
  }, [router]);

  const roleLabel = useMemo(() => {
    const r = String(profile?.role || "EMPLOYEE").toUpperCase();
    if (r === "HR") return "HR Manager";
    if (r === "ADMIN") return "Admin";
    return "Employee";
  }, [profile?.role]);

  const levelInfo = useMemo(() => getLevelFromXP(totalXP), [totalXP]);
  const xpPct = levelInfo.xpNeeded > 0
    ? Math.round((levelInfo.xpIntoLevel / levelInfo.xpNeeded) * 100)
    : 100;

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  function isActive(href: string) {
    if (href === "/post-login") return pathname === "/post-login";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const isHR = String(profile?.role).toUpperCase() === "HR" || String(profile?.role).toUpperCase() === "ADMIN";

  // ✅ FIXED — removed bg-[#f0f4f8]
  if (loading || !profile) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                <Brain size={18} />
              </div>
              <div className="text-base font-extrabold text-slate-900">BrainUp</div>
            </div>
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400" />
            </div>
            <p className="mt-3 text-sm text-slate-500">Loading your workspace…</p>
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
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">EI Platform</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-none">
        <SectionLabel label="Main" />
        <NavLink href="/post-login" icon={<LayoutDashboard size={16} />} label="Home" active={isActive("/post-login")} />
        <NavLink href="/profile" icon={<UserCircle2 size={16} />} label="Profile" active={isActive("/profile")} />
        <NavLink href="/settings" icon={<Settings size={16} />} label="Settings" active={isActive("/settings")} />

        <SectionLabel label="Learning" />
        <CollapseGroup
          icon={<BookOpen size={16} />}
          label="Learning Hub"
          open={hubOpen}
          onToggle={() => setHubOpen(v => !v)}
          active={isActive("/learning-hub")}
        >
          <SubNavLink href="/learning-hub/assessment" icon={<ClipboardList size={14} />} label="Assessment" active={isActive("/learning-hub/assessment")} />
          <SubNavLink href="/learning-hub/resources" icon={<LibraryBig size={14} />} label="Resources" active={isActive("/learning-hub/resources")} />
        </CollapseGroup>
        <NavLink href="/journal" icon={<NotebookPen size={16} />} label="Journal" active={isActive("/journal")} />

        <SectionLabel label="Growth" />
        <CollapseGroup
          icon={<Trophy size={16} />}
          label="Gamification"
          open={gamificationOpen}
          onToggle={() => setGamificationOpen(v => !v)}
          active={isActive("/gamification")}
        >
          <SubNavLink href="/gamification/stats" icon={<BarChart3 size={14} />} label="Stats" active={isActive("/gamification/stats")} />
          <SubNavLink href="/gamification/rewards" icon={<Gift size={14} />} label="Rewards" active={isActive("/gamification/rewards")} />
        </CollapseGroup>

        {isHR && (
          <>
            <SectionLabel label="HR Tools" />
            <CollapseGroup
              icon={<Users size={16} />}
              label="HR Management"
              open={hrOpen}
              onToggle={() => setHrOpen(v => !v)}
              active={isActive("/hr")}
            >
              <SubNavLink href="/hr/dashboard" icon={<LayoutGrid size={14} />} label="Dashboard" active={isActive("/hr/dashboard")} />
              <SubNavLink href="/hr/consultations" icon={<Users size={14} />} label="Consultations" active={isActive("/hr/consultations")} />
              <SubNavLink href="/hr/announcements" icon={<Bell size={14} />} label="Announcements" active={isActive("/hr/announcements")} />
            </CollapseGroup>
          </>
        )}
      </nav>

      <div className="mx-3 mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white text-xs font-extrabold">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-extrabold text-slate-900">{profile.full_name}</div>
            <div className="text-[10px] text-slate-500">{roleLabel}</div>
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

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Sparkles size={10} className="text-cyan-500" />
              Level {level} — {levelInfo.title}
            </div>
            <div className="text-[10px] font-bold text-slate-400">{totalXP} XP</div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400 transition-all"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            {levelInfo.nextLevel
              ? `${levelInfo.xpNeeded - levelInfo.xpIntoLevel} XP to Level ${levelInfo.nextLevel.level}`
              : "Max level reached"}
          </div>
        </div>
      </div>
    </div>
  );

  // ✅ FIXED — removed bg-[#f0f4f8]
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
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
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
                  aria-label="Open menu"
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
                    placeholder="Search..."
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

                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 transition"
                  onClick={() => router.push("/profile")}
                >
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white text-xs font-extrabold">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <div className="text-xs font-extrabold text-slate-900">{profile.full_name}</div>
                    <div className="text-[10px] text-slate-500">{roleLabel}</div>
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
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

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
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

function CollapseGroup({
  icon,
  label,
  open,
  onToggle,
  active,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={[
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
          active && !open
            ? "bg-slate-100 text-slate-900 font-extrabold"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold",
        ].join(" ")}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100">
          {icon}
        </span>
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          size={14}
          className={[
            "text-slate-400 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          ].join(" ")}
        />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 border-l-2 border-slate-100 pl-3 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function SubNavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
        active
          ? "bg-cyan-50 text-cyan-700 font-extrabold"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-semibold",
      ].join(" ")}
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}

export default AppShell;
export { AppShell };