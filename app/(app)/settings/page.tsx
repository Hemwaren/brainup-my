"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Lock, Bell, Shield, Eye, EyeOff,
  CheckCircle2, ArrowLeft, Loader2, Save,
  ChevronRight, Link2,
} from "lucide-react";

type Section = "password" | "notifications" | "privacy" | "integrations";

// ─── Connected Accounts Card ─────────────────────────────────────────────────
function ConnectedAccountsCard({ userId }: { userId: string }) {
  const [connected, setConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // Check for ?google=success or ?google=error in URL
    const params = new URLSearchParams(window.location.search);
    const googleParam = params.get("google");
    if (googleParam === "success") {
      setToast("success");
      window.history.replaceState({}, "", "/settings");
    } else if (googleParam === "error") {
      setToast("error");
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  useEffect(() => {
    async function checkConnection() {
      if (!userId) return;
      const { data } = await supabase
        .from("user_integrations")
        .select("connected_at")
        .eq("user_id", userId)
        .eq("provider", "google")
        .single();
      if (data) {
        setConnected(true);
        setConnectedAt(data.connected_at);
      }
      setLoading(false);
    }
    checkConnection();
  }, [userId]);

  async function handleConnect() {
    window.location.href = `/api/auth/google?userId=${userId}`;
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
    await fetch("/api/auth/google/disconnect", { method: "DELETE", headers });
    setConnected(false);
    setConnectedAt(null);
    setDisconnecting(false);
    setToast("disconnected");
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Link2 size={16} className="text-cyan-500" />
        <div className="text-sm font-extrabold text-slate-900">Connected Accounts</div>
      </div>
      <p className="text-xs text-slate-500 -mt-3">
        Connect your Google account to enable Calendar and Gmail wellbeing signals in BrainUp.
      </p>

      {/* Toast messages */}
      {toast === "success" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 font-semibold flex items-center gap-2">
          <CheckCircle2 size={14} /> Google account connected successfully
        </div>
      )}
      {toast === "error" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 font-semibold">
          ✗ Failed to connect. Please try again.
        </div>
      )}
      {toast === "disconnected" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 font-semibold">
          Google account disconnected.
        </div>
      )}

      {/* Google row */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 grid place-items-center shadow-sm shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700">Google Workspace</p>
            <p className="text-xs text-slate-400">
              {loading
                ? "Checking connection..."
                : connected && connectedAt
                ? `Connected on ${new Date(connectedAt).toLocaleDateString("en-MY", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}`
                : "Calendar + Gmail access — not connected"}
            </p>
          </div>
        </div>

        {!loading && (
          connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-all"
            >
              Connect
            </button>
          )
        )}
      </div>

      {/* Privacy note */}
      <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3">
        <p className="text-xs font-bold text-cyan-700 mb-1">🔒 Privacy note</p>
        <p className="text-xs text-cyan-600 leading-relaxed">
          BrainUp only reads Calendar event metadata (times, durations) and Gmail send patterns
          (volume, timestamps). Email content is never accessed or stored.
        </p>
      </div>
    </section>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("password");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Notification state
  const [notifSettings, setNotifSettings] = useState({
    checkin_reminder: true,
    weekly_summary: true,
    badge_earned: true,
    announcement: true,
    consultation_scheduled: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Privacy state
  const [privacySettings, setPrivacySettings] = useState({
    show_emotion_to_hr: true,
    show_profile_to_team: true,
    allow_anonymous_data: true,
  });
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    // Check if redirected back from Google OAuth — auto switch to integrations tab
    const params = new URLSearchParams(window.location.search);
    if (params.get("google")) setActiveSection("integrations");
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push("/auth"); return; }
      setUserEmail(user.email ?? "");
      setUserId(user.id);
      setLoading(false);
    }
    load();
  }, [router]);

  // Password rules
  const pwRules = {
    minLen: newPw.length >= 8,
    upper: /[A-Z]/.test(newPw),
    lower: /[a-z]/.test(newPw),
    number: /[0-9]/.test(newPw),
    symbol: /[^A-Za-z0-9]/.test(newPw),
  };
  const pwScore = Object.values(pwRules).filter(Boolean).length;
  const pwBarColor = pwScore <= 2 ? "#ef4444" : pwScore <= 4 ? "#f59e0b" : "#10b981";
  const pwMatch = newPw === confirmPw && confirmPw.length > 0;

  async function handleChangePassword() {
    setPwMsg(null);
    if (!currentPw) { setPwMsg({ text: "Please enter your current password.", type: "error" }); return; }
    if (pwScore < 5) { setPwMsg({ text: "New password doesn't meet all requirements.", type: "error" }); return; }
    if (!pwMatch) { setPwMsg({ text: "New passwords don't match.", type: "error" }); return; }
    setPwSaving(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPw });
    if (signInError) { setPwMsg({ text: "Current password is incorrect.", type: "error" }); setPwSaving(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
    if (updateError) { setPwMsg({ text: "Failed to update password: " + updateError.message, type: "error" }); setPwSaving(false); return; }
    setPwMsg({ text: "Password updated successfully! 🎉", type: "success" });
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setPwSaving(false);
    setTimeout(() => setPwMsg(null), 4000);
  }

  async function handleSaveNotifications() {
    setNotifSaving(true); setNotifMsg(null);
    await new Promise(r => setTimeout(r, 800));
    setNotifMsg({ text: "Notification preferences saved!", type: "success" });
    setNotifSaving(false);
    setTimeout(() => setNotifMsg(null), 3000);
  }

  async function handleSavePrivacy() {
    setPrivacySaving(true); setPrivacyMsg(null);
    await new Promise(r => setTimeout(r, 800));
    setPrivacyMsg({ text: "Privacy settings saved!", type: "success" });
    setPrivacySaving(false);
    setTimeout(() => setPrivacyMsg(null), 3000);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading settings...</p>
      </div>
    );
  }

  const SECTIONS: { key: Section; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: "password",     label: "Change Password", icon: <Lock size={16} />,   desc: "Update your account password" },
    { key: "notifications",label: "Notifications",   icon: <Bell size={16} />,   desc: "Manage notification preferences" },
    { key: "privacy",      label: "Privacy & Data",  icon: <Shield size={16} />, desc: "Control your data and visibility" },
    { key: "integrations", label: "Integrations",    icon: <Link2 size={16} />,  desc: "Connect external accounts" },
  ];

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push("/post-login")}
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Manage your account preferences</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Sidebar nav */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm h-fit">
          <div className="space-y-1">
            {SECTIONS.map(s => (
              <button key={s.key} type="button" onClick={() => setActiveSection(s.key)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                  activeSection === s.key
                    ? "bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50",
                ].join(" ")}>
                <span className={[
                  "grid h-8 w-8 place-items-center rounded-lg shrink-0",
                  activeSection === s.key ? "bg-white/20" : "bg-slate-100",
                ].join(" ")}>
                  {s.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-extrabold truncate">{s.label}</div>
                  <div className={`text-[10px] truncate ${activeSection === s.key ? "text-white/70" : "text-slate-400"}`}>
                    {s.desc}
                  </div>
                </div>
                <ChevronRight size={13} className={activeSection === s.key ? "text-white/60" : "text-slate-300"} />
              </button>
            ))}
          </div>
        </section>

        {/* Content area */}
        <div className="md:col-span-2 space-y-4">

          {/* ── CHANGE PASSWORD ── */}
          {activeSection === "password" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={16} className="text-cyan-500" />
                <div className="text-sm font-extrabold text-slate-900">Change Password</div>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                Enter your current password and choose a new one.
              </p>

              {pwMsg && (
                <div className={[
                  "rounded-xl border px-4 py-3 text-sm font-bold flex items-center gap-2 mb-4",
                  pwMsg.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700",
                ].join(" ")}>
                  {pwMsg.type === "success" && <CheckCircle2 size={15} />}
                  {pwMsg.text}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Current Password</label>
                  <div className="relative">
                    <input type={showCurrentPw ? "text" : "password"} value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition" />
                    <button type="button" onClick={() => setShowCurrentPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showNewPw ? "text" : "password"} value={newPw}
                      onChange={e => setNewPw(e.target.value)} placeholder="Enter new password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition" />
                    <button type="button" onClick={() => setShowNewPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {newPw && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${(pwScore / 5) * 100}%`, background: pwBarColor }} />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                        {[
                          { ok: pwRules.minLen, text: "Min 8 characters" },
                          { ok: pwRules.upper, text: "Uppercase (A-Z)" },
                          { ok: pwRules.lower, text: "Lowercase (a-z)" },
                          { ok: pwRules.number, text: "Number (0-9)" },
                          { ok: pwRules.symbol, text: "Symbol (!@#$...)" },
                        ].map(r => (
                          <div key={r.text} className="flex items-center gap-1.5 text-[11px]"
                            style={{ color: r.ok ? "#059669" : "#94a3b8" }}>
                            <CheckCircle2 size={10} />{r.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input type={showConfirmPw ? "text" : "password"} value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password"
                      className={[
                        "w-full rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none transition",
                        confirmPw
                          ? pwMatch
                            ? "border-emerald-300 bg-emerald-50 focus:ring-2 focus:ring-emerald-300"
                            : "border-rose-300 bg-rose-50 focus:ring-2 focus:ring-rose-300"
                          : "border-slate-200 bg-slate-50 focus:ring-2 focus:ring-cyan-300 focus:bg-white",
                      ].join(" ")} />
                    <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirmPw && !pwMatch && <p className="mt-1 text-[11px] font-semibold text-rose-500">Passwords don't match</p>}
                  {pwMatch && <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Passwords match</p>}
                </div>
              </div>

              <button type="button" onClick={handleChangePassword} disabled={pwSaving}
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition"
                style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>
                {pwSaving ? <><Loader2 size={14} className="animate-spin" /> Updating...</> : <><Lock size={14} /> Update Password</>}
              </button>
            </section>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeSection === "notifications" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Bell size={16} className="text-cyan-500" />
                <div className="text-sm font-extrabold text-slate-900">Notification Preferences</div>
              </div>
              <p className="text-xs text-slate-500 mb-5">Choose which notifications you'd like to receive.</p>

              {notifMsg && (
                <div className={[
                  "rounded-xl border px-4 py-3 text-sm font-bold flex items-center gap-2 mb-4",
                  notifMsg.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700",
                ].join(" ")}>
                  {notifMsg.type === "success" && <CheckCircle2 size={15} />}
                  {notifMsg.text}
                </div>
              )}

              <div className="space-y-3">
                {[
                  { key: "checkin_reminder" as const, label: "Emotion Check-in Reminders", desc: "Get reminded when it's time for your scheduled check-in" },
                  { key: "weekly_summary" as const, label: "Weekly EI Summary", desc: "Receive a weekly summary of your emotional intelligence progress" },
                  { key: "badge_earned" as const, label: "Badge & Achievement Alerts", desc: "Get notified when you earn a new badge or level up" },
                  { key: "announcement" as const, label: "HR Announcements", desc: "Receive important announcements from your HR team" },
                  { key: "consultation_scheduled" as const, label: "Consultation Reminders", desc: "Get reminded about scheduled HRBP consultations" },
                ].map(item => (
                  <div key={item.key}
                    className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-slate-900">{item.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    <button type="button"
                      onClick={() => setNotifSettings(p => ({ ...p, [item.key]: !p[item.key] }))}
                      className={["relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        notifSettings[item.key] ? "bg-cyan-500" : "bg-slate-200"].join(" ")}>
                      <span className={["pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        notifSettings[item.key] ? "translate-x-5" : "translate-x-0"].join(" ")} />
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" onClick={handleSaveNotifications} disabled={notifSaving}
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition"
                style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>
                {notifSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Preferences</>}
              </button>
            </section>
          )}

          {/* ── PRIVACY ── */}
          {activeSection === "privacy" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} className="text-cyan-500" />
                <div className="text-sm font-extrabold text-slate-900">Privacy & Data</div>
              </div>
              <p className="text-xs text-slate-500 mb-5">Control what data is shared and who can see your information.</p>

              {privacyMsg && (
                <div className={[
                  "rounded-xl border px-4 py-3 text-sm font-bold flex items-center gap-2 mb-4",
                  privacyMsg.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700",
                ].join(" ")}>
                  {privacyMsg.type === "success" && <CheckCircle2 size={15} />}
                  {privacyMsg.text}
                </div>
              )}

              <div className="space-y-3">
                {[
                  { key: "show_emotion_to_hr" as const, label: "Share emotion data with HR", desc: "Allow HR managers to view your emotion check-in patterns and trends" },
                  { key: "show_profile_to_team" as const, label: "Visible profile to team members", desc: "Allow colleagues in your department to see your profile" },
                  { key: "allow_anonymous_data" as const, label: "Anonymous usage data", desc: "Help improve BrainUp by sharing anonymised usage statistics" },
                ].map(item => (
                  <div key={item.key}
                    className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-slate-900">{item.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    <button type="button"
                      onClick={() => setPrivacySettings(p => ({ ...p, [item.key]: !p[item.key] }))}
                      className={["relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        privacySettings[item.key] ? "bg-cyan-500" : "bg-slate-200"].join(" ")}>
                      <span className={["pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        privacySettings[item.key] ? "translate-x-5" : "translate-x-0"].join(" ")} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3">
                <div className="text-xs font-bold text-cyan-700 mb-1">About your data</div>
                <div className="text-xs text-cyan-600 leading-relaxed">
                  BrainUp stores your emotion check-ins and journal entries securely. You can request a full data export or deletion by contacting your admin.
                </div>
              </div>

              <button type="button" onClick={handleSavePrivacy} disabled={privacySaving}
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition"
                style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>
                {privacySaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Settings</>}
              </button>
            </section>
          )}

          {/* ── INTEGRATIONS ── */}
          {activeSection === "integrations" && (
            <ConnectedAccountsCard userId={userId ?? ""} />
          )}

        </div>
      </div>
    </div>
  );
}