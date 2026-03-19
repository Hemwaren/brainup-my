"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, ShieldCheck, Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";

/* ─── Change this to your own secret passphrase ─── */
const SETUP_SECRET = "brainup-admin-2026";

export default function SetupAdminPage() {
  const router = useRouter();

  const [secret, setSecret] = useState("");
  const [secretVerified, setSecretVerified] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [done, setDone] = useState(false);

  function verifySecret() {
    if (secret.trim() === SETUP_SECRET) {
      setSecretVerified(true);
      setMsg(null);
    } else {
      setMsg({ text: "Wrong setup passphrase. Try again.", ok: false });
    }
  }

  async function createAdmin() {
    if (!email.trim() || !password.trim()) {
      setMsg({ text: "Please fill in all fields.", ok: false });
      return;
    }
    if (password.length < 8) {
      setMsg({ text: "Password must be at least 8 characters.", ok: false });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/setup-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          setup_secret: secret,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMsg({ text: data.message || "Something went wrong.", ok: false });
        setLoading(false);
        return;
      }

      setDone(true);
      setMsg({ text: "Admin account created successfully!", ok: true });
    } catch {
      setMsg({ text: "Network error. Please try again.", ok: false });
    }

    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: "linear-gradient(135deg,#0d9488 0%,#0891b2 50%,#0c4a6e 100%)",
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 shadow-2xl"
        style={{
          background: "rgba(255,255,255,0.97)",
          border: "1px solid rgba(255,255,255,0.9)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="grid h-11 w-11 place-items-center rounded-2xl text-white"
            style={{
              background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",
              boxShadow: "0 0 18px rgba(34,211,238,0.4)",
            }}
          >
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-900">BrainUp</div>
            <div className="text-xs font-semibold text-slate-400">Admin Setup</div>
          </div>
        </div>

        {/* Success state */}
        {done ? (
          <div className="text-center py-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">
              Admin Account Created!
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              You can now log in with your admin credentials at the login page.
            </p>
            <button
              type="button"
              onClick={() => router.push("/auth")}
              className="w-full rounded-xl py-3 text-sm font-extrabold text-white transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",
                boxShadow: "0 4px 16px rgba(34,211,238,0.38)",
              }}
            >
              Go to Login →
            </button>
          </div>
        ) : !secretVerified ? (
          /* Step 1 — verify passphrase */
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="h-4 w-4 text-slate-400" />
                <h2 className="text-lg font-extrabold text-slate-900">
                  Enter Setup Passphrase
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                This page is restricted. Enter the setup passphrase to continue.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  Setup Passphrase
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") verifySecret(); }}
                    placeholder="Enter passphrase..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {msg && (
                <div
                  className="rounded-xl px-4 py-3 text-sm font-semibold"
                  style={{
                    background: msg.ok ? "rgba(240,253,244,1)" : "rgba(254,242,242,1)",
                    color: msg.ok ? "#059669" : "#dc2626",
                    border: `1px solid ${msg.ok ? "#a7f3d0" : "#fecaca"}`,
                  }}
                >
                  {msg.text}
                </div>
              )}

              <button
                type="button"
                onClick={verifySecret}
                className="w-full rounded-xl py-3 text-sm font-extrabold text-white transition-all hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",
                  boxShadow: "0 4px 16px rgba(34,211,238,0.38)",
                }}
              >
                Verify →
              </button>
            </div>

            <div
              className="mt-6 rounded-2xl p-4 text-xs text-slate-500 leading-relaxed"
              style={{ background: "rgba(241,245,249,1)", border: "1px solid rgba(226,232,240,1)" }}
            >
              <span className="font-bold text-slate-700">🔒 Security note:</span> This page
              is only for initial admin account setup. Do not share this URL publicly.
              Delete or disable this page after setup is complete.
            </div>
          </div>
        ) : (
          /* Step 2 — create admin */
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <h2 className="text-lg font-extrabold text-slate-900">
                  Create Admin Account
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Fill in the details for the new admin account.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@brainup.my"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createAdmin(); }}
                    placeholder="Min 8 characters"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {msg && (
                <div
                  className="rounded-xl px-4 py-3 text-sm font-semibold"
                  style={{
                    background: msg.ok ? "rgba(240,253,244,1)" : "rgba(254,242,242,1)",
                    color: msg.ok ? "#059669" : "#dc2626",
                    border: `1px solid ${msg.ok ? "#a7f3d0" : "#fecaca"}`,
                  }}
                >
                  {msg.text}
                </div>
              )}

              <button
                type="button"
                onClick={createAdmin}
                disabled={loading}
                className="w-full rounded-xl py-3.5 text-sm font-extrabold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",
                  boxShadow: "0 4px 16px rgba(34,211,238,0.38)",
                }}
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  "Create Admin Account →"
                )}
              </button>

              <button
                type="button"
                onClick={() => { setSecretVerified(false); setMsg(null); }}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}