"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import {
  Brain,
  BookOpen,
  ShieldCheck,
  NotebookPen,
  Trophy,
  BarChart3,
  LayoutDashboard,
  Sparkles,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  ArrowRight,
  Zap,
  Star,
  Quote,
} from "lucide-react";

/* ─────────────────────── animation variants ─────────────────────── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

/* ─────────────────────── testimonials data ──────────────────────── */
const TESTIMONIALS = [
  {
    name: "Amirah Zulkifli",
    role: "HR Manager, TechNova Sdn Bhd",
    text: "BrainUp transformed how our team communicates. The EI assessments gave us actionable insights we never had before.",
    stars: 5,
  },
  {
    name: "Daniel Lim",
    role: "Operations Lead, GreenPath SME",
    text: "The gamification feature is genius. Our employees actually look forward to their daily check-ins now!",
    stars: 5,
  },
  {
    name: "Priya Nair",
    role: "Employee, Meridian Group",
    text: "I've grown so much emotionally since using BrainUp. The journaling module helps me reflect every single day.",
    stars: 5,
  },
  {
    name: "Hafiz Rahman",
    role: "CEO, Bumimas Consulting",
    text: "As a small business owner, having an affordable EI platform for my team was a game changer. Highly recommend.",
    stars: 5,
  },
  {
    name: "Siew Mei Tan",
    role: "Team Lead, BrightEdge Solutions",
    text: "The HR dashboard gives me a real-time view of my team's wellbeing. I can proactively support them now.",
    stars: 5,
  },
  {
    name: "Farouk Ismail",
    role: "Software Engineer, DataPulse",
    text: "Never thought an EI tool could feel this engaging. The badge system keeps me motivated to keep growing.",
    stars: 5,
  },
];

/* ─────────────────────────── component ──────────────────────────── */
export default function LandingTop() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const container = document.getElementById("snap-container");
    if (!container) return;
    const onScroll = () => setScrolled(container.scrollTop > 20);
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const container = document.getElementById("snap-container");
    if (!container) return;
    const sections = ["home", "features", "about"];
    const observers: IntersectionObserver[] = [];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { root: container, threshold: 0.5 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const modules = [
    {
      icon: ShieldCheck,
      title: "User Authentication",
      desc: "Secure login, profile management, and role-based access for employees, HR, and admins.",
    },
    {
      icon: BookOpen,
      title: "EI Learning Hub",
      desc: "Take EI assessments, view scores, track progress, and access curated learning resources.",
    },
    {
      icon: NotebookPen,
      title: "Journaling Module",
      desc: "Reflect on emotions with private journal entries and daily motivational quotes.",
    },
    {
      icon: Trophy,
      title: "Gamification",
      desc: "Complete daily missions, earn XP, unlock badges, and track your journey roadmap.",
    },
    {
      icon: BarChart3,
      title: "HR Management",
      desc: "View team emotion insights, filter by department, and schedule HRBP consultations.",
    },
    {
      icon: LayoutDashboard,
      title: "Admin Dashboard",
      desc: "Manage users, system settings, and mental health support directory.",
    },
  ];

  return (
    <>
      <style jsx global>{`
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee 34s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        .marquee-wrapper {
          overflow: hidden;
          mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          );
        }
      `}</style>

      <div
        id="snap-container"
        className="text-slate-900"
        style={{
          height: "100vh",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
        }}
      >
        {/* ── Glassmorphism sticky nav ─────────────────────────── */}
        <header
          className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
          style={{
            background: scrolled ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.35)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: scrolled
              ? "1px solid rgba(148,163,184,0.2)"
              : "1px solid transparent",
            boxShadow: scrolled ? "0 4px 28px rgba(0,0,0,0.07)" : "none",
          }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl overflow-hidden">
  <img src="/brainup-offlogo.png" alt="BrainUp" className="h-11 w-11 object-contain" />
</div>
              <span className="text-xl font-extrabold tracking-tight">BrainUp</span>
            </motion.div>

            <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
              {["home", "features", "about"].map((id) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="relative capitalize transition-colors hover:text-slate-900"
                >
                  {id}
                  <span
                    className="absolute -bottom-1 left-0 h-0.5 rounded-full bg-cyan-500 transition-all duration-300"
                    style={{ width: activeSection === id ? "100%" : "0%" }}
                  />
                </a>
              ))}
            </nav>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <Link
                href="/auth"
                className="text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900"
              >
                Log In
              </Link>
              <Link
                href="/auth"
                className="rounded-xl px-5 py-2.5 text-sm font-extrabold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
                style={{
                  background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",
                  boxShadow: "0 4px 14px rgba(34,211,238,0.4)",
                }}
              >
                Get Started
              </Link>
            </motion.div>
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════
            SECTION 1 — HERO
        ══════════════════════════════════════════════════════ */}
        <section
          id="home"
          style={{
            scrollSnapAlign: "start",
            scrollSnapStop: "always",
            minHeight: "100vh",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            background: "linear-gradient(160deg,#f0fdfa 0%,#ecfeff 50%,#f0f9ff 100%)",
          }}
        >
          <Orb size={520} color="rgba(45,212,191,0.16)" style={{ top: "-12%", right: "-6%", filter: "blur(65px)" }} />
          <Orb size={420} color="rgba(56,189,248,0.14)" style={{ bottom: "4%", left: "-9%", filter: "blur(72px)" }} />
          <Orb size={260} color="rgba(139,92,246,0.09)" style={{ top: "28%", left: "8%", filter: "blur(54px)" }} />

          {[...Array(7)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 5 + i * 3,
                height: 5 + i * 3,
                background: `rgba(20,184,166,${0.15 + i * 0.04})`,
                left: `${8 + i * 13}%`,
                top: `${18 + (i % 3) * 24}%`,
              }}
              animate={{ y: [0, -20, 0], opacity: [0.3, 0.85, 0.3] }}
              transition={{ duration: 3 + i * 0.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
            />
          ))}

          <div className="relative mx-auto max-w-6xl px-6 pt-28 pb-10 text-center w-full">
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.div variants={fadeUp} className="flex justify-center">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-teal-700"
                  style={{
                    background: "rgba(255,255,255,0.72)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(20,184,166,0.32)",
                    boxShadow: "0 2px 14px rgba(20,184,166,0.14)",
                  }}
                >
                  <Sparkles className="h-4 w-4 text-teal-500" />
                  Emotional Intelligence for SMEs
                </div>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="mt-7 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl"
              >
                <span className="text-slate-900">Boost Your Team&apos;s</span>
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8,#818cf8)",
                    backgroundSize: "300% 300%",
                    animation: "gradientShift 4s ease-in-out infinite alternate",
                  }}
                >
                  Emotional Intelligence
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg"
              >
                BrainUp helps SME employees track emotions, build self-awareness,
                and grow their EI skills through gamified learning and personalised insights.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
              >
                <Link
                  href="/auth"
                  className="group inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-extrabold text-white transition-all duration-300 hover:scale-105"
                  style={{
                    background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",
                    boxShadow: "0 6px 22px rgba(34,211,238,0.45)",
                  }}
                >
                  Start Your Journey
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-8 py-3.5 text-sm font-extrabold text-slate-900 transition-all duration-300 hover:scale-105 hover:border-cyan-400 hover:shadow-md"
                  style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(10px)" }}
                >
                  Explore Features
                </a>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-4"
              >
                {[
                  { value: "6", label: "Core Modules" },
                  { value: "24/7", label: "Always Available" },
                  { value: "100%", label: "Gamified" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl p-4 text-center transition-transform duration-300 hover:-translate-y-1"
                    style={{
                      background: "rgba(255,255,255,0.65)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(20,184,166,0.18)",
                      boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div className="text-2xl font-extrabold text-slate-900">{s.value}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">{s.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              className="mt-10 flex flex-col items-center gap-1 text-slate-400"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-xs font-semibold">Scroll to explore</span>
              <ChevronDown className="h-5 w-5" />
            </motion.div>
          </div>

          <div
            className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{ background: "linear-gradient(to bottom,transparent,rgba(240,253,250,0.8))" }}
          />
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — FEATURES
        ══════════════════════════════════════════════════════ */}
        <section
          id="features"
          style={{
            scrollSnapAlign: "start",
            scrollSnapStop: "always",
            minHeight: "100vh",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            background: "linear-gradient(160deg,#f8fbfb 0%,#f0fdfa 55%,#f0f9ff 100%)",
          }}
        >
          <Orb size={460} color="rgba(34,211,238,0.11)" style={{ top: "2%", right: "-10%", filter: "blur(70px)" }} />
          <Orb size={360} color="rgba(45,212,191,0.09)" style={{ bottom: "5%", left: "-6%", filter: "blur(62px)" }} />

          <div className="relative mx-auto w-full max-w-6xl px-6 py-16">
            <AnimatedSection>
              <div className="mx-auto max-w-3xl text-center">
                <motion.div variants={fadeUp}>
                  <div
                    className="mx-auto inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-extrabold text-teal-700 mb-4"
                    style={{
                      background: "rgba(240,253,250,0.92)",
                      border: "1px solid rgba(20,184,166,0.3)",
                    }}
                  >
                    <Zap className="h-4 w-4 text-teal-500" />
                    Core Modules
                  </div>
                </motion.div>

                <motion.h2
                  variants={fadeUp}
                  className="text-4xl font-extrabold tracking-tight sm:text-5xl"
                >
                  Everything You Need for{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}
                  >
                    Emotional Growth
                  </span>
                </motion.h2>

                <motion.p
                  variants={fadeUp}
                  className="mt-4 text-base leading-relaxed text-slate-600"
                >
                  BrainUp combines powerful features designed specifically for SME workplaces
                  to build healthier, more emotionally intelligent teams.
                </motion.p>
              </div>
            </AnimatedSection>

            {/* Module cards — ALL icons use the same teal/cyan brand gradient */}
            <AnimatedSection className="mt-10">
              <motion.div variants={stagger} className="grid gap-5 md:grid-cols-3">
                {modules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <motion.div
                      key={m.title}
                      variants={fadeUp}
                      whileHover={{ y: -5, scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 280, damping: 20 }}
                      className="group relative overflow-hidden rounded-2xl p-6 cursor-default"
                      style={{
                        background: "rgba(255,255,255,0.75)",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.92)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                        transition: "box-shadow 0.3s ease, border-color 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.boxShadow = "0 12px 40px rgba(20,184,166,0.22), 0 4px 16px rgba(0,0,0,0.07)";
                        el.style.borderColor = "rgba(20,184,166,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)";
                        el.style.borderColor = "rgba(255,255,255,0.92)";
                      }}
                    >
                      {/* Hover shimmer */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        style={{
                          background: "radial-gradient(circle at 50% 0%,rgba(20,184,166,0.1) 0%,transparent 65%)",
                        }}
                      />

                      {/* Icon — same brand color for ALL modules */}
                      <div
                        className="relative grid h-14 w-14 place-items-center rounded-2xl text-white shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                        style={{
                          background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",
                          boxShadow: "0 4px 14px rgba(34,211,238,0.38)",
                        }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>

                      <h3 className="relative mt-5 text-base font-extrabold text-slate-900">
                        {m.title}
                      </h3>
                      <p className="relative mt-2 text-sm leading-relaxed text-slate-500">
                        {m.desc}
                      </p>

                      {/* Bottom accent line */}
                      <div
                        className="absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-500 group-hover:w-full"
                        style={{
                          width: "0%",
                          background: "linear-gradient(90deg,#14b8a6,#22d3ee,#38bdf8)",
                        }}
                      />
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatedSection>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 3 — TESTIMONIALS + CTA + FOOTER
        ══════════════════════════════════════════════════════ */}
        <section
          id="about"
          style={{
            scrollSnapAlign: "start",
            scrollSnapStop: "always",
            minHeight: "100vh",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "linear-gradient(160deg,#f0fdfa 0%,#ecfeff 40%,#f0f9ff 100%)",
          }}
        >
          <Orb size={480} color="rgba(20,184,166,0.14)" style={{ top: "-10%", left: "-4%", filter: "blur(75px)" }} />
          <Orb size={380} color="rgba(56,189,248,0.12)" style={{ bottom: "15%", right: "-6%", filter: "blur(65px)" }} />

          {/* ── Testimonials marquee ─────────────────────────── */}
          <div className="relative pt-24 pb-8 flex-shrink-0">
            <AnimatedSection>
              <motion.div variants={fadeUp} className="text-center mb-6 px-6">
                <div
                  className="mx-auto inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-extrabold text-teal-700 mb-3"
                  style={{
                    background: "rgba(255,255,255,0.72)",
                    border: "1px solid rgba(20,184,166,0.28)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  User Testimonials
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  Loved by{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}
                  >
                    Teams Across Malaysia
                  </span>
                </h2>
                <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
                  Real feedback from employees and HR managers building emotionally
                  healthier workplaces with BrainUp.
                </p>
              </motion.div>
            </AnimatedSection>

            {/* Infinite scrolling marquee — 6 cards, loops seamlessly */}
            <div className="marquee-wrapper py-2">
              <div className="marquee-track">
                {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                  <div
                    key={i}
                    className="mx-3 flex-shrink-0 rounded-2xl p-5"
                    style={{
                      width: "320px",
                      background: "rgba(255,255,255,0.78)",
                      backdropFilter: "blur(14px)",
                      WebkitBackdropFilter: "blur(14px)",
                      border: "1px solid rgba(20,184,166,0.16)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="flex gap-1 mb-3">
                      {[...Array(t.stars)].map((_, si) => (
                        <Star key={si} className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <Quote className="h-5 w-5 text-teal-300 mb-2" />
                    <p className="text-sm leading-relaxed text-slate-700 italic">
                      &ldquo;{t.text}&rdquo;
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <div
                        className="grid h-9 w-9 place-items-center rounded-full text-white text-xs font-extrabold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}
                      >
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">{t.name}</div>
                        <div className="text-[11px] text-slate-500">{t.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CTA Banner ───────────────────────────────────── */}
          <div className="relative mx-auto w-full max-w-6xl px-6 pb-6 pt-6 flex-shrink-0">
            <AnimatedSection>
              <motion.div
                variants={fadeUp}
                className="relative overflow-hidden rounded-3xl px-8 py-10 text-center text-white sm:px-14"
                style={{
                  background: "linear-gradient(135deg,#0d9488,#0891b2,#0369a1)",
                  boxShadow: "0 20px 56px rgba(8,145,178,0.38), inset 0 1px 0 rgba(255,255,255,0.14)",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 18% 50%,rgba(255,255,255,0.18) 0%,transparent 48%), radial-gradient(circle at 80% 15%,rgba(255,255,255,0.12) 0%,transparent 45%)",
                  }}
                />

                <h3 className="relative text-2xl font-extrabold sm:text-3xl">
                  Ready to Transform Your Workplace Well-being?
                </h3>
                <p className="relative mx-auto mt-2 max-w-xl text-sm text-white/85">
                  Join forward-thinking SMEs investing in emotional intelligence
                  and building healthier work environments.
                </p>

                <div className="relative mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-xs text-white/85">
                  {[
                    "Affordable for SME organizations",
                    "No credit card required",
                    "Set up in minutes",
                    "Full feature access",
                  ].map((t) => (
                    <span
                      key={t}
                      className="rounded-full px-3 py-1 transition-all duration-200 hover:bg-white/25"
                      style={{
                        background: "rgba(255,255,255,0.13)",
                        border: "1px solid rgba(255,255,255,0.24)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="relative mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/auth"
                    className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3 text-sm font-extrabold text-teal-700 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/auth"
                    className="rounded-xl px-10 py-3 text-sm font-extrabold text-white transition-all duration-300 hover:scale-105"
                    style={{
                      background: "rgba(255,255,255,0.13)",
                      border: "1px solid rgba(255,255,255,0.32)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    Sign In
                  </Link>
                </div>
              </motion.div>
            </AnimatedSection>
          </div>

          {/* ── Footer ───────────────────────────────────────── */}
          <footer
            className="relative w-full flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderTop: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl overflow-hidden">
  <img src="/brainup-offlogo.png" alt="BrainUp" className="h-9 w-9 object-contain" />
</div>
                  <span className="text-base font-extrabold">BrainUp</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  Empowering SME employees with emotional intelligence tools for
                  a healthier, more productive workplace.
                </p>
                <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                  {[
                    { icon: Mail, text: "support@brainup.my" },
                    { icon: Phone, text: "+60 14 372 4652" },
                    { icon: MapPin, text: "Universiti Sains Malaysia (USM), Penang" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-start gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-teal-500 mt-0.5" />
                      <span>{text}</span>
                    </div>
                  ))}
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

            <div
              className="border-t px-6 py-3"
              style={{ borderColor: "rgba(148,163,184,0.15)" }}
            >
              <div className="mx-auto flex max-w-6xl items-center justify-between">
                <p className="text-xs text-slate-400">
                  © {new Date().getFullYear()} BrainUp. All rights reserved.
                </p>
                <p className="text-xs text-slate-400">Built with ❤️ for Malaysian SMEs</p>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </>
  );
}

/* ─────────────────────────── helpers ────────────────────────────── */

function Orb({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

function AnimatedSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
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
      <ul className="mt-3 space-y-2 text-xs text-slate-500">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="group inline-flex items-center gap-1.5 transition-colors hover:text-teal-600"
            >
              <span className="inline-block h-0.5 w-0 rounded-full bg-teal-500 transition-all duration-200 group-hover:w-3" />
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}