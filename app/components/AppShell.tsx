"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getLevelFromXP } from "@/lib/gamification";
import {
  Bell, Brain, ChevronDown, LayoutDashboard, UserCircle2,
  Settings, BookOpen, ClipboardList, LibraryBig, NotebookPen,
  Trophy, LogOut, Search, BarChart3, Gift, Users, LayoutGrid,
  Sparkles, X, FileText, Megaphone, HeartHandshake, ArrowRight, LifeBuoy,
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

// ─── STATIC PAGES (always available) ─────────────────────────────────────────
const NAV_PAGES = [
  { label: "Home", href: "/post-login", icon: <LayoutDashboard size={15} />, desc: "Your dashboard overview" },
  { label: "Profile", href: "/profile", icon: <UserCircle2 size={15} />, desc: "Edit your profile" },
  { label: "Settings", href: "/settings", icon: <Settings size={15} />, desc: "Account settings" },
  { label: "Assessment", href: "/learning-hub/assessment", icon: <ClipboardList size={15} />, desc: "EI Assessment module" },
  { label: "Learning Resources", href: "/learning-hub/resources", icon: <LibraryBig size={15} />, desc: "Browse learning resources" },
  { label: "Journal", href: "/journal", icon: <NotebookPen size={15} />, desc: "Your journal entries" },
  { label: "Gamification Stats", href: "/gamification/stats", icon: <BarChart3 size={15} />, desc: "XP and level progress" },
  { label: "Rewards", href: "/gamification/rewards", icon: <Gift size={15} />, desc: "Redeem stars for rewards" },
  { label: "Social Area", href: "/gamification/social", icon: <Users size={15} />, desc: "Virtual HQ and social interaction" },
  { label: "HR Dashboard", href: "/hr/dashboard", icon: <LayoutGrid size={15} />, desc: "HR overview and analytics" },
  { label: "Consultations", href: "/hr/consultations", icon: <Users size={15} />, desc: "Schedule consultations" },
  { label: "Announcements", href: "/hr/announcements", icon: <Megaphone size={15} />, desc: "Manage announcements" },
];

type SearchResult = {
  id: string;
  type: "page" | "announcement" | "resource" | "journal" | "support";
  label: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
};

// ─── SEARCH BAR COMPONENT ─────────────────────────────────────────────────────
function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    setOpen(true);

    const q = query.toLowerCase();
    const found: SearchResult[] = [];

    // 1. Pages
    NAV_PAGES.filter(p =>
      p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
    ).forEach(p => found.push({
      id: `page-${p.href}`,
      type: "page",
      label: p.label,
      desc: p.desc,
      href: p.href,
      icon: p.icon,
    }));

    // 2. Announcements
    try {
      const { data } = await supabase
        .from("hr_announcements")
        .select("id, title, content, category")
        .eq("status", "PUBLISHED")
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .limit(3);
      (data ?? []).forEach(a => found.push({
        id: `ann-${a.id}`,
        type: "announcement",
        label: a.title,
        desc: a.category,
        href: "/post-login",
        icon: <Megaphone size={15} />,
      }));
    } catch { /* silent */ }

    // 3. Learning Resources
    try {
      const { data } = await supabase
        .from("ei_resources")
        .select("id, title, description, category")
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(3);
      (data ?? []).forEach(r => found.push({
        id: `res-${r.id}`,
        type: "resource",
        label: r.title,
        desc: r.category ?? "Resource",
        href: "/learning-hub/resources",
        icon: <LibraryBig size={15} />,
      }));
    } catch { /* silent */ }

    // 4. Journal entries
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("journal_entries")
          .select("id, title, content")
          .eq("user_id", user.id)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(3);
        (data ?? []).forEach(j => found.push({
          id: `journal-${j.id}`,
          type: "journal",
          label: j.title ?? "Journal Entry",
          desc: (j.content ?? "").slice(0, 60) + "...",
          href: "/journal",
          icon: <NotebookPen size={15} />,
        }));
      }
    } catch { /* silent */ }

    // 5. Support Directory
    try {
      const { data } = await supabase
        .from("support_directory")
        .select("id, title, description, category")
        .eq("is_active", true)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(3);
      (data ?? []).forEach(s => found.push({
        id: `support-${s.id}`,
        type: "support",
        label: s.title,
        desc: s.description ?? s.category,
        href: "/post-login",
        icon: <HeartHandshake size={15} />,
      }));
    } catch { /* silent */ }

    setResults(found);
    setSelected(0);
    setLoading(false);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => search(q), 300);
    return () => clearTimeout(timer);
  }, [q, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (results[selected]) { router.push(results[selected].href); setOpen(false); setQ(""); }
    }
    if (e.key === "Escape") { setOpen(false); }
  }

  const TYPE_LABELS: Record<string, string> = {
    page: "Page",
    announcement: "Announcement",
    resource: "Resource",
    journal: "Journal",
    support: "Support",
  };

  const TYPE_COLORS: Record<string, string> = {
    page: "bg-cyan-50 text-cyan-600",
    announcement: "bg-amber-50 text-amber-600",
    resource: "bg-violet-50 text-violet-600",
    journal: "bg-emerald-50 text-emerald-600",
    support: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="flex-1 relative">
      {/* Input */}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
      <input
        ref={inputRef}
        value={q}
        onChange={e => { setQ(e.target.value); if (!e.target.value) { setResults([]); setOpen(false); } }}
        onFocus={() => { if (q && results.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Search pages, announcements, resources..."
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"
      />
      {q && (
        <button type="button" onClick={() => { setQ(""); setResults([]); setOpen(false); inputRef.current?.focus(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          <X size={13} />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">

          {loading && (
            <div className="px-4 py-3 text-xs text-slate-400 font-semibold">Searching...</div>
          )}

          {!loading && results.length === 0 && q && (
            <div className="px-4 py-6 text-center">
              <div className="text-2xl mb-1">🔍</div>
              <div className="text-sm font-bold text-slate-500">No results for "{q}"</div>
              <div className="text-xs text-slate-400 mt-0.5">Try a different keyword</div>
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  {results.length} result{results.length !== 1 ? "s" : ""} for "{q}"
                </div>
              </div>

              <div className="p-2">
                {results.map((r, i) => (
                  <button key={r.id} type="button"
                    onClick={() => { router.push(r.href); setOpen(false); setQ(""); }}
                    onMouseEnter={() => setSelected(i)}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      selected === i ? "bg-slate-50" : "hover:bg-slate-50",
                    ].join(" ")}>
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TYPE_COLORS[r.type]}`}>
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">{r.label}</div>
                      <div className="text-xs text-slate-500 truncate">{r.desc}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_COLORS[r.type]}`}>
                        {TYPE_LABELS[r.type]}
                      </span>
                      <ArrowRight size={12} className="text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-3 text-[10px] text-slate-400">
                <span><kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono">↵</kbd> select</span>
                <span><kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono">esc</kbd> close</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APPSHELL ────────────────────────────────────────────────────────────
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
  const [notiCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error || !data?.user) { setLoading(false); router.push("/auth"); return; }

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
      } catch { dbProfile = null; }

      try {
        const { data: g } = await supabase
          .from("user_gamification")
          .select("total_xp, level")
          .eq("user_id", u.id)
          .maybeSingle();
        if (alive && g) { setTotalXP(g.total_xp ?? 0); setLevel(g.level ?? 1); }
      } catch { /* silent */ }

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
  const xpPct = levelInfo.xpNeeded > 0 ? Math.round((levelInfo.xpIntoLevel / levelInfo.xpNeeded) * 100) : 100;

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  function isActive(href: string) {
    if (href === "/post-login") return pathname === "/post-login";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const isHR = String(profile?.role).toUpperCase() === "HR" || String(profile?.role).toUpperCase() === "ADMIN";

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
        <CollapseGroup icon={<BookOpen size={16} />} label="Learning Hub" open={hubOpen} onToggle={() => setHubOpen(v => !v)} active={isActive("/learning-hub")}>
          <SubNavLink href="/learning-hub/assessment" icon={<ClipboardList size={14} />} label="Assessment" active={isActive("/learning-hub/assessment")} />
          <SubNavLink href="/learning-hub/resources" icon={<LibraryBig size={14} />} label="Resources" active={isActive("/learning-hub/resources")} />
        </CollapseGroup>
        <NavLink href="/journal" icon={<NotebookPen size={16} />} label="Journal" active={isActive("/journal")} />

        <SectionLabel label="Growth" />
<CollapseGroup icon={<Trophy size={16} />} label="Gamification" open={gamificationOpen} onToggle={() => setGamificationOpen(v => !v)} active={isActive("/gamification")}>
  <SubNavLink href="/gamification/stats" icon={<BarChart3 size={14} />} label="Stats" active={isActive("/gamification/stats")} />
  <SubNavLink href="/gamification/rewards" icon={<Gift size={14} />} label="Rewards" active={isActive("/gamification/rewards")} />
  <SubNavLink href="/gamification/social" icon={<Users size={14} />} label="Social Area" active={isActive("/gamification/social")} />
</CollapseGroup>

        {isHR && (
          <>
            <SectionLabel label="HR Tools" />
            <CollapseGroup icon={<Users size={16} />} label="HR Management" open={hrOpen} onToggle={() => setHrOpen(v => !v)} active={isActive("/hr")}>
              <SubNavLink href="/hr/dashboard" icon={<LayoutGrid size={14} />} label="Dashboard" active={isActive("/hr/dashboard")} />
              <SubNavLink href="/hr/consultations" icon={<Users size={14} />} label="Consultations" active={isActive("/hr/consultations")} />
              <SubNavLink href="/hr/announcements" icon={<Bell size={14} />} label="Announcements" active={isActive("/hr/announcements")} />
              <SubNavLink href="/hr/support" icon={<HeartHandshake size={14} />} label="Support" active={isActive("/hr/support")} />
            </CollapseGroup>
          </>
        )}
        {!isHR && (
          <>
            <SectionLabel label="Wellbeing" />
            <NavLink href="/hr/consultations" icon={<HeartHandshake size={16} />} label="My Consultations" active={isActive("/hr/consultations")} />
            <NavLink href="/hr/support" icon={<LifeBuoy size={16} />} label="Support" active={isActive("/hr/support")} />
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
          <button type="button" onClick={onLogout}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
            aria-label="Logout">
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
            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400 transition-all"
              style={{ width: `${xpPct}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            {levelInfo.nextLevel ? `${levelInfo.xpNeeded - levelInfo.xpIntoLevel} XP to Level ${levelInfo.nextLevel.level}` : "Max level reached"}
          </div>
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
                <button type="button"
                  className="md:hidden grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600"
                  onClick={() => setMobileOpen(true)} aria-label="Open menu">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>

                {/* ✅ Search component */}
                <GlobalSearch />

                <button type="button"
                  className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                  aria-label="Notifications">
                  <Bell size={16} />
                  {notiCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {notiCount}
                    </span>
                  )}
                </button>

                <button type="button"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 transition"
                  onClick={() => router.push("/profile")}>
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

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link href={href} className={[
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition mb-0.5",
      active ? "bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 text-white shadow-sm font-extrabold"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold",
    ].join(" ")}>
      <span className={["grid h-7 w-7 place-items-center rounded-lg transition", active ? "bg-white/20" : "bg-slate-100"].join(" ")}>
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
      <button type="button" onClick={onToggle} className={[
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
        active && !open ? "bg-slate-100 text-slate-900 font-extrabold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold",
      ].join(" ")}>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={14} className={["text-slate-400 transition-transform", open ? "rotate-0" : "-rotate-90"].join(" ")} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 border-l-2 border-slate-100 pl-3 space-y-0.5">{children}</div>
      )}
    </div>
  );
}

function SubNavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link href={href} className={[
      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
      active ? "bg-cyan-50 text-cyan-700 font-extrabold" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-semibold",
    ].join(" ")}>
      <span>{icon}</span>
      {label}
    </Link>
  );
}

export default AppShell;
export { AppShell };