"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
  Menu,
  Search,
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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hubOpen, setHubOpen] = useState(true);

  // top search (UI only)
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

      // best-effort profiles table fetch
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

      const role: AppRole = (dbProfile?.role ?? md?.role ?? "EMPLOYEE") as AppRole;

      const deptRaw =
        (dbProfile?.department ?? md?.department ?? md?.dept ?? "") as string;

      const department =
        String(role).toUpperCase() === "HR" ? "Human Resources" : deptRaw || "—";

      const joined_at =
        (dbProfile?.joined_at ??
          md?.joined_at ??
          u.created_at ??
          new Date().toISOString()) as string;

      const full_name =
        (dbProfile?.full_name ?? md?.full_name ?? md?.name ?? "User") as string;

      const avatar_url = (dbProfile?.avatar_url ?? md?.avatar_url ?? null) as
        | string
        | null;

      setProfile({
        full_name,
        email: u.email ?? "",
        role,
        department,
        joined_at,
        avatar_url,
      });

      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [router]);

  const roleLabel = useMemo(() => {
    const r = String(profile?.role || "EMPLOYEE").toUpperCase();
    if (r === "HR") return "HR Manager";
    if (r === "ADMIN") return "Admin";
    return "Employee";
  }, [profile?.role]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  function isActive(href: string) {
    if (href === "/post-login") return pathname === "/post-login";
    return pathname === href || pathname.startsWith(href + "/");
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                <Brain size={18} />
              </div>
              <div className="text-base font-extrabold text-slate-900">BrainUp</div>
            </div>
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/2 bg-slate-700" />
            </div>
            <p className="mt-3 text-sm text-slate-600">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7fbff]">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside
          className={[
            "relative hidden md:flex flex-col",
            sidebarOpen ? "w-64" : "w-20",
            "shrink-0 bg-gradient-to-b from-teal-600 via-cyan-600 to-sky-600 text-white",
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/15"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="px-3">
            <div className="mt-2 rounded-2xl bg-white/10 p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15">
                  <UserCircle2 size={18} />
                </div>
                {sidebarOpen && (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{profile.full_name}</div>
                    <div className="text-xs text-white/80">{roleLabel}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <nav className="mt-4 flex-1 px-2">
            <SidebarLink
              open={sidebarOpen}
              href="/post-login"
              icon={<LayoutDashboard size={18} />}
              label="Home"
              active={isActive("/post-login")}
            />

            <SidebarLink
              open={sidebarOpen}
              href="/profile"
              icon={<UserCircle2 size={18} />}
              label="Profile"
              active={isActive("/profile")}
            />

            <SidebarLink
              open={sidebarOpen}
              href="/settings"
              icon={<Settings size={18} />}
              label="Settings"
              active={isActive("/settings")}
            />

            <button
              type="button"
              onClick={() => setHubOpen((v) => !v)}
              className={[
                "mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left",
                "bg-white/0 hover:bg-white/10 transition",
              ].join(" ")}
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
                <BookOpen size={18} />
              </span>
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-sm font-semibold">Learning Hub</span>
                  <ChevronDown
                    size={16}
                    className={hubOpen ? "rotate-0 transition" : "-rotate-90 transition"}
                  />
                </>
              )}
            </button>

            {hubOpen && (
              <div className={sidebarOpen ? "ml-3 mt-1 space-y-1" : "hidden"}>
                <SubLink
                  href="/learning-hub/assessment"
                  icon={<ClipboardList size={16} />}
                  label="Assessment"
                  active={isActive("/learning-hub/assessment")}
                />
                <SubLink
                  href="/learning-hub/resources"
                  icon={<LibraryBig size={16} />}
                  label="Resources"
                  active={isActive("/learning-hub/resources")}
                />
              </div>
            )}

            <SidebarLink
              open={sidebarOpen}
              href="/journal"
              icon={<NotebookPen size={18} />}
              label="Journal"
              active={isActive("/journal")}
            />

            <SidebarLink
              open={sidebarOpen}
              href="/gamification"
              icon={<Trophy size={18} />}
              label="Gamification"
              active={isActive("/gamification")}
            />
          </nav>

          <div className="px-2 pb-4">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-white/95 hover:bg-white/10"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
                <LogOut size={18} />
              </span>
              {sidebarOpen && <span className="text-sm font-semibold">Logout</span>}
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1">
          {/* TOPBAR */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
              <button
                type="button"
                className="md:hidden grid h-10 w-10 place-items-center rounded-xl border border-slate-200"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                  <Brain size={18} />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-extrabold text-slate-900">BrainUp</div>
                  <div className="text-xs text-slate-500">EI Buddy</div>
                </div>
              </div>

              <div className="ml-2 flex-1">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                </div>
              </div>

              <button
                type="button"
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {notiCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-slate-900 px-1 text-xs font-bold text-white">
                    {notiCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
                onClick={() => router.push("/profile")}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <UserCircle2 size={18} />
                </span>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-extrabold text-slate-900">{profile.full_name}</div>
                  <div className="text-[11px] text-slate-500">{roleLabel}</div>
                </div>
                <ChevronDown size={16} className="text-slate-500" />
              </button>
            </div>
          </div>

          {/* PAGE CONTENT WRAPPER */}
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  open,
  href,
  icon,
  label,
  active,
}: {
  open: boolean;
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
        active ? "bg-white/15" : "bg-white/0 hover:bg-white/10",
      ].join(" ")}
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
        {icon}
      </span>
      {open && <span className="text-sm font-semibold">{label}</span>}
    </Link>
  );
}

function SubLink({
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
        "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-white/95",
        active ? "bg-white/15" : "hover:bg-white/10",
      ].join(" ")}
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">
        {icon}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}

export default AppShell;
export { AppShell };