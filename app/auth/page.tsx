"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

type Role = "EMPLOYEE" | "HR";
type InviteStatus = "IDLE" | "CHECKING" | "VALID" | "INVALID";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // signup
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [fullName, setFullName] = useState("");
  const [dept, setDept] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPw, setSignPw] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // ✅ split messages so they don't carry over
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const [signupMsg, setSignupMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // password visibility toggles
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignPw, setShowSignPw] = useState(false);

  // ✅ HR invite validation state
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("IDLE");
  const [inviteHint, setInviteHint] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const isHrLocked =
    role === "HR" && (inviteStatus !== "VALID" || !inviteCode.trim());

  // ============================
  // Password strength (SIGNUP)
  // ============================
  const pwRules = useMemo(() => {
    const pw = signPw || "";
    return {
      minLen: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      number: /[0-9]/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw),
    };
  }, [signPw]);

  const pwScore = useMemo(
    () => Object.values(pwRules).filter(Boolean).length,
    [pwRules]
  );

  function pwBarColor() {
    if (pwScore <= 2) return "bg-red-500";
    if (pwScore <= 4) return "bg-yellow-500";
    return "bg-green-500";
  }

  function canSignup() {
    // require all rules true
    return pwScore === 5;
  }

  // ✅ HR invite: instant validation (debounced) while typing
  useEffect(() => {
    // only relevant for signup+HR
    if (mode !== "signup" || role !== "HR") {
      setInviteStatus("IDLE");
      setInviteHint(null);
      return;
    }

    const code = inviteCode.trim();
    if (!code) {
      setInviteStatus("IDLE");
      setInviteHint(null);
      return;
    }

    // debounce
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      setInviteStatus("CHECKING");
      setInviteHint("Checking invite code...");

      try {
        const res = await fetch("/api/auth/validate-hr-invite", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ inviteCode: code }),
        });

        const data = await res.json();

        if (!data.ok) {
          setInviteStatus("INVALID");
          setInviteHint(data.message || "Wrong HR Invite Code, Retry");
          return;
        }

        setInviteStatus("VALID");
        setInviteHint("Invite verified ✅");
      } catch {
        setInviteStatus("INVALID");
        setInviteHint("Could not validate invite. Try again.");
      }
    }, 450);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [inviteCode, role, mode]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginMsg(null);
    setLoading(true);

    // ✅ custom validation message BEFORE Supabase
    if (!loginEmail.trim() || !loginPw.trim()) {
      setLoginMsg("Please enter your email and password.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPw,
    });

    setLoading(false);

    if (error) {
      setLoginMsg(error.message);
      return;
    }

    // "Remember me" best-effort:
    // Supabase persists session by default. If user unchecks rememberMe,
    // we clear the stored session after successful login so it won't survive browser restart.
    if (!rememberMe) {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith("sb-") && k.includes("-auth-token")) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        // ignore
      }
    }

    router.push("/post-login");
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupMsg(null);

    // ✅ HR must validate invite first
    if (role === "HR") {
      if (!inviteCode.trim()) {
        setSignupMsg("Please enter HR Invite Code.");
        return;
      }
      if (inviteStatus === "CHECKING") {
        setSignupMsg("Please wait, verifying invite code...");
        return;
      }
      if (inviteStatus !== "VALID") {
        setSignupMsg("Wrong HR Invite Code, Retry");
        return;
      }
    }

    // ✅ enforce strong password
    if (!canSignup()) {
      setSignupMsg("Kindly complete all fields before continuing");
      return;
    }

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
      setSignupMsg(data.message || "Signup failed.");
      return;
    }

    setSignupMsg(data.message);
  }

  async function onForgotPassword() {
    setLoginMsg(null);

    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      setLoginMsg("Please enter your email first, then click “Forgot password?”.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      setLoginMsg(error.message);
      return;
    }

    setLoginMsg("Password reset email sent. Please check your inbox.");
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
                    onClick={() => {
                      setMode("login");
                      setLoginMsg(null);
                      setSignupMsg(null);
                    }}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold ${
                      mode === "login"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setMode("signup");
                      setLoginMsg(null);
                      setSignupMsg(null);
                    }}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold ${
                      mode === "signup"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Create account
                  </button>
                </div>

                {/* message (separate per tab) */}
                {mode === "login" && loginMsg && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {loginMsg}
                  </div>
                )}
                {mode === "signup" && signupMsg && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {signupMsg}
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

                    {/* login password with icon toggle */}
                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Password
                      </label>
                      <div className="mt-2 relative">
                        <input
                          type={showLoginPw ? "text" : "password"}
                          value={loginPw}
                          onChange={(e) => setLoginPw(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-cyan-300"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                          aria-label={
                            showLoginPw ? "Hide password" : "Show password"
                          }
                        >
                          {showLoginPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember me + Forgot password row */}
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400"
                        />
                        Remember me
                      </label>

                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="font-semibold text-cyan-600 hover:text-cyan-700"
                      >
                        Forgot password?
                      </button>
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
                          onClick={() => {
                            setRole("EMPLOYEE");
                            setInviteCode("");
                            setInviteStatus("IDLE");
                            setInviteHint(null);
                            setSignupMsg(null);
                          }}
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
                          onClick={() => {
                            setRole("HR");
                            setSignupMsg(null);
                          }}
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

                        {inviteHint && (
                          <div
                            className={`mt-2 text-sm font-semibold ${
                              inviteStatus === "VALID"
                                ? "text-green-700"
                                : inviteStatus === "INVALID"
                                ? "text-red-600"
                                : "text-slate-600"
                            }`}
                          >
                            {inviteHint}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Full Name
                      </label>
                      <input
                        disabled={isHrLocked}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300 disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Work Email
                      </label>
                      <input
                        disabled={isHrLocked}
                        value={signEmail}
                        onChange={(e) => setSignEmail(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-300 disabled:bg-slate-100 disabled:text-slate-500"
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

                    {/* signup password with icon toggle */}
                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Password
                      </label>
                      <div className="mt-2 relative">
                        <input
                          disabled={isHrLocked}
                          type={showSignPw ? "text" : "password"}
                          value={signPw}
                          onChange={(e) => setSignPw(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-cyan-300 disabled:bg-slate-100 disabled:text-slate-500"
                          placeholder="Create a strong password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                          aria-label={
                            showSignPw ? "Hide password" : "Show password"
                          }
                        >
                          {showSignPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      {/* Strength meter */}
                      <div className="mt-3">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full ${pwBarColor()} transition-all`}
                            style={{ width: `${(pwScore / 5) * 100}%` }}
                          />
                        </div>

                        <div className="mt-2 grid gap-1 text-xs">
                          <Rule ok={pwRules.minLen} text="Min 8 characters" />
                          <Rule ok={pwRules.upper} text="Uppercase letter (A-Z)" />
                          <Rule ok={pwRules.lower} text="Lowercase letter (a-z)" />
                          <Rule ok={pwRules.number} text="Number (0-9)" />
                          <Rule ok={pwRules.symbol} text="Symbol (!@#$...)" />
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={loading || isHrLocked}
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

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`flex items-center gap-2 ${
        ok ? "text-green-700" : "text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ok ? "bg-green-600" : "bg-slate-300"
        }`}
      />
      <span>{text}</span>
    </div>
  );
}
