export default function LandingTop() {
  const modules = [
    {
      icon: "🛡️",
      title: "User Authentication",
      desc: "Secure login, profile management, and role-based access for employees, HR, and admins.",
    },
    {
      icon: "🧠",
      title: "EI Learning Hub",
      desc: "Take EI assessments, view scores, track progress, and access curated learning resources.",
    },
    {
      icon: "📓",
      title: "Journaling Module",
      desc: "Reflect on emotions with private journal entries and daily motivational quotes.",
    },
    {
      icon: "🏆",
      title: "Gamification",
      desc: "Complete daily missions, earn XP, unlock badges, and track your journey roadmap.",
    },
    {
      icon: "📊",
      title: "HR Management",
      desc: "View team emotion insights, filter by department, and schedule HRBP consultations.",
    },
    {
      icon: "🧩",
      title: "Admin Dashboard",
      desc: "Manage users, system settings, and mental health support directory.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fbfb] text-slate-900">
      {/* NAV */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
            <span className="text-lg">🧠</span>
          </div>
          <span className="text-xl font-extrabold tracking-tight">BrainUp</span>
        </div>

        <nav className="hidden items-center gap-10 text-sm font-semibold text-slate-600 md:flex">
          <a href="#home" className="hover:text-slate-900">
            Home
          </a>
          <a href="#features" className="hover:text-slate-900">
            Features
          </a>
          <a href="#about" className="hover:text-slate-900">
            About
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="#login"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            Log In
          </a>
          <a
            href="#get-started"
            className="rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:opacity-95"
          >
            Get Started
          </a>
        </div>
      </header>

      {/* HERO */}
      <section id="home" className="relative overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-100 via-cyan-100 to-sky-100" />
          <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_50%_30%,rgba(45,212,191,0.35),transparent_55%)]" />

          <div className="relative mx-auto max-w-6xl px-6 pb-14 pt-10">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm font-semibold text-teal-700 ring-1 ring-teal-200/60 backdrop-blur">
                <span>✨</span>
                <span>Emotional Intelligence for SMEs</span>
              </div>

              <h1 className="mt-7 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
                <span className="text-slate-900">Boost Your Team&apos;s</span>
                <br />
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 bg-clip-text text-transparent">
                    Emotional Intelligence
                  </span>
                  <span className="pointer-events-none absolute -bottom-2 left-0 h-[6px] w-full rounded-full bg-teal-300/40" />
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                BrainUp helps SME employees track emotions, build self-awareness, and grow their EI
                skills through gamified learning and personalised insights.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href="#get-started"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-8 py-3 font-extrabold text-white shadow-sm hover:opacity-95"
                >
                  Start Your Journey <span aria-hidden>→</span>
                </a>

                <a
                  href="#features"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white/60 px-10 py-3 font-extrabold text-slate-900 shadow-sm backdrop-blur hover:bg-white"
                >
                  Learn More
                </a>
              </div>

              {/* Stats */}
              <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-6">
                <StatItem value="6" label="Core Modules" />
                <StatItem value="24/7" label="Emotional Support" />
                <StatItem value="100%" label="Gamified Learning" />
              </div>
            </div>
          </div>

          <div className="h-12 bg-gradient-to-b from-transparent to-[#f8fbfb]" />
        </div>
      </section>

      {/* CORE MODULES */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex rounded-full bg-teal-50 px-5 py-2 text-sm font-extrabold text-teal-700 ring-1 ring-teal-200/60">
            Core Modules
          </div>

          <h2 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Everything You Need for{" "}
            <span className="bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 bg-clip-text text-transparent">
              Emotional Growth
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600">
            BrainUp combines powerful features designed specifically for SME workplaces to build
            healthier, more emotionally intelligent teams.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.title}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-[2px] hover:shadow-md"
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-xl">
                {m.icon}
              </div>
              <h3 className="mt-6 text-lg font-extrabold">{m.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{m.desc}</p>
              {/* ✅ removed Learn more link */}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 shadow-lg">
          <div className="px-8 py-14 text-center text-white sm:px-16">
            <h3 className="text-3xl font-extrabold sm:text-4xl">
              Ready to Transform Your <br className="hidden sm:block" />
              Workplace Well-being?
            </h3>

            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/90 sm:text-base">
              Join forward-thinking SMEs investing in emotional intelligence and building healthier
              work environments.
            </p>

            {/* ✅ pills row restored */}
            <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3 text-xs text-white/90">
              <Pill>Affordable for SME organizations</Pill>
              <Pill>No credit card required</Pill>
              <Pill>Set up in minutes</Pill>
              <Pill>Full feature access</Pill>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                id="get-started"
                href="#get-started"
                className="rounded-xl bg-white px-8 py-3 text-sm font-extrabold text-teal-700 shadow-sm hover:bg-white/95"
              >
                Get Started Free <span aria-hidden>→</span>
              </a>
              <a
                href="#login"
                className="rounded-xl border border-white/40 bg-white/10 px-10 py-3 text-sm font-extrabold text-white hover:bg-white/15"
              >
                Sign In
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                <span>🧠</span>
              </div>
              <span className="text-lg font-extrabold">BrainUp</span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Empowering SME employees with emotional intelligence tools for a healthier, more
              productive workplace.
            </p>

            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <div>📧 support@brainup.my</div>
              <div>📞 +60 14 372 4652</div>
              <div>📍 Universiti Sains Malaysia (USM), Penang</div>
            </div>
          </div>

          <FooterCol
            title="Product"
            links={[
              { label: "Features", href: "#features" },
              { label: "For HR Teams", href: "#features" },
              { label: "For Employees", href: "#features" },
              { label: "Pricing", href: "#pricing" },
            ]}
          />

          <FooterCol
            title="Company"
            links={[
              { label: "About Us", href: "#about" },
              { label: "Contact", href: "#contact" },
              { label: "Careers", href: "#careers" },
              { label: "Blog", href: "#blog" },
            ]}
          />

          <FooterCol
            title="Resources"
            links={[
              { label: "Documentation", href: "#docs" },
              { label: "Support", href: "#support" },
              { label: "Privacy Policy", href: "#privacy" },
              { label: "Terms of Service", href: "#terms" },
            ]}
          />
        </div>
      </footer>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-600">{label}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">
      {children}
    </span>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-extrabold text-slate-900">{title}</h4>
      <ul className="mt-4 space-y-3 text-sm text-slate-600">
        {links.map((l) => (
          <li key={l.label}>
            <a className="hover:text-slate-900" href={l.href}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
