"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

type Role = "EMPLOYEE" | "HR";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // signup
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [fullName, setFullName] = useState("");
  const [dept, setDept] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPw, setSignPw] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPw,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push("/post-login");
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        department: role === "EMPLOYEE" ? dept : undefined,
        email: signEmail,
        password: signPw,
        role,
        inviteCode: role === "HR" ? inviteCode : undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!data.ok) {
      setMsg(data.message || "Signup failed.");
      return;
    }

    setMsg(data.message);
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* FORM PANEL (switch left/right using order, keep centered) */}
        <div
          className={[
            "relative flex min-h-screen items-center justify-center px-6 py-12",
            mode === "login" ? "lg:order-1" : "lg:order-2",
          ].join(" ")}
          style={{ perspective: 1200 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{
                opacity: 0,
                x: mode === "login" ? -60 : 60,
                rotateY: mode === "login" ? -12 : 12,
              }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{
                opacity: 0,
                x: mode === "login" ? 60 : -60,
                rotateY: mode === "login" ? 12 : -12,
              }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              style={{ transformStyle: "preserve-3d" }}
              className="w-full max-w-md"
            >
              {/* keep your existing content inside here */}
              <div className="w-full max-w-md">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400 text-white shadow-sm">
                    <span>🧠</span>
                  </div>
                  <div className="text-lg font-extrabold">BrainUp</div>
                </div>

                <h1 className="mt-8 text-3xl font-extrabold text-slate-900">
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  {mode === "login"
                    ? "Login to continue your emotional intelligence journey"
                    : "Get started with BrainUp"}
                </p>

                {/* tabs */}
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => setMode("login")}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold ${
                      mode === "login"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setMode("signup")}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold ${
                      mode === "signup"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Create account
                  </button>
                </div>

                {/* message */}
                {msg && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {msg}
                  </div>
                )}

                {/* forms */}
                {mode === "login" ? (
                  <form onSubmit={onLogin} className="mt-6 space-y-4">
                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Email
                      </label>
                      <input
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300"
                        placeholder="you@company.com"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Password
                      </label>
                      <input
                        type="password"
                        value={loginPw}
                        onChange={(e) => setLoginPw(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300"
                        placeholder="Enter your password"
                      />
                    </div>

                    <button
                      disabled={loading}
                      className="mt-2 w-full rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-6 py-3 text-sm font-extrabold text-white shadow-sm disabled:opacity-60"
                    >
                      {loading ? "Signing in..." : "Login →"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={onSignup} className="mt-6 space-y-4">
                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Select your role
                      </label>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRole("EMPLOYEE")}
                          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold ${
                            role === "EMPLOYEE"
                              ? "border-cyan-400 bg-cyan-50 text-slate-900"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          Employee
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole("HR")}
                          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold ${
                            role === "HR"
                              ? "border-cyan-400 bg-cyan-50 text-slate-900"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          HR Manager
                        </button>
                      </div>
                    </div>

                    {role === "HR" && (
                      <div>
                        <label className="text-sm font-bold text-slate-700">
                          HR Invite Code
                        </label>
                        <input
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300"
                          placeholder="Enter invite code"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Full Name
                      </label>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Work Email
                      </label>
                      <input
                        value={signEmail}
                        onChange={(e) => setSignEmail(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300"
                        placeholder="you@company.com"
                      />
                    </div>

                    {role === "EMPLOYEE" && (
                      <div>
                        <label className="text-sm font-bold text-slate-700">
                          Department
                        </label>
                        <input
                          value={dept}
                          onChange={(e) => setDept(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300"
                          placeholder="e.g. Engineering, Marketing"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Password
                      </label>
                      <input
                        type="password"
                        value={signPw}
                        onChange={(e) => setSignPw(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300"
                        placeholder="Create a strong password"
                      />
                    </div>

                    <button
                      disabled={loading}
                      className="mt-2 w-full rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-6 py-3 text-sm font-extrabold text-white shadow-sm disabled:opacity-60"
                    >
                      {loading ? "Creating..." : "Create Account →"}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* HERO PANEL (switch order too, stays centered) */}
        <div
          className={[
            "hidden lg:flex items-center justify-center bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-400",
            mode === "login" ? "lg:order-2" : "lg:order-1",
          ].join(" ")}
        >
          <div className="text-center text-white px-10">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white/20 backdrop-blur">
              <span className="text-3xl">🧠</span>
            </div>
            <h2 className="mt-8 text-4xl font-extrabold">
              Grow Your Emotional Intelligence
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/90">
              Track emotions, complete daily missions, earn rewards, and build a
              healthier workplace mindset.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
