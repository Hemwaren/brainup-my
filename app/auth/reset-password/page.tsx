"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error">("error");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Check if URL has an error (expired or invalid link)
    const hash = window.location.hash;
    if (hash.includes("error=access_denied") || hash.includes("otp_expired")) {
      setLinkError("This reset link has expired or is invalid. Please request a new one.");
      return;
    }

    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const pwRules = useMemo(() => {
    return {
      minLen: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const pwScore = useMemo(
    () => Object.values(pwRules).filter(Boolean).length,
    [pwRules]
  );

  function pwBarColor() {
    if (pwScore <= 2) return "#ef4444";
    if (pwScore <= 4) return "#f59e0b";
    return "#10b981";
  }

  function pwBarLabel() {
    if (pwScore <= 2) return "Weak";
    if (pwScore <= 4) return "Medium";
    return "Strong";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwScore < 5) {
      setMsg("Please meet all password requirements.");
      setMsgType("error");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match.");
      setMsgType("error");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMsg(error.message);
      setMsgType("error");
      return;
    }
    setMsg("Password updated! Redirecting to login...");
    setMsgType("success");
    setTimeout(() => router.push("/auth"), 2000);
  }

  // Show error state if link is expired
  if (linkError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-8 shadow-sm text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-lg font-extrabold text-slate-900 mb-2">
            Link expired
          </h1>
          <p className="text-sm text-slate-500 mb-6">{linkError}</p>
          <button
            type="button"
            onClick={() => router.push("/auth")}
            className="w-full rounded-xl py-3 text-sm font-extrabold text-white hover:opacity-95 transition"
            style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Show loading state while waiting for Supabase token
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500">Verifying your reset link...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-extrabold text-slate-900 mb-2">
          Set new password
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Choose a strong password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* New Password */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password strength bar */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Password strength</span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: pwBarColor() }}
                  >
                    {pwBarLabel()}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(pwScore / 5) * 100}%`,
                      background: pwBarColor(),
                    }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    { ok: pwRules.minLen, text: "Min 8 characters" },
                    { ok: pwRules.upper,  text: "Uppercase (A-Z)" },
                    { ok: pwRules.lower,  text: "Lowercase (a-z)" },
                    { ok: pwRules.number, text: "Number (0-9)" },
                    { ok: pwRules.symbol, text: "Symbol (!@#$…)" },
                  ].map((r) => (
                    <div
                      key={r.text}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: r.ok ? "#059669" : "#94a3b8" }}
                    >
                      <CheckCircle2 size={11} />
                      {r.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Match indicator */}
            {confirm.length > 0 && (
              <p
                className="mt-1.5 text-xs font-semibold"
                style={{ color: password === confirm ? "#059669" : "#ef4444" }}
              >
                {password === confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
              </p>
            )}
          </div>

          {/* Message */}
          {msg && (
            <p
              className="text-sm font-semibold"
              style={{ color: msgType === "success" ? "#059669" : "#ef4444" }}
            >
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition"
            style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}