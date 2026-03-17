"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Settings,
  Bell,
  AlertTriangle,
  Save,
  Loader2,
  Mail,
  Shield,
  Sliders,
} from "lucide-react";

type EmailTemplate = {
  key: string;
  label: string;
  subject: string;
  body: string;
};

type FlagSettings = {
  low_emotion_threshold: number;
  low_emotion_days: number;
  inactivity_days: number;
};

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    key: "welcome",
    label: "Welcome Email",
    subject: "Welcome to BrainUp!",
    body: "Hi {{name}},\n\nWelcome to BrainUp — your emotional intelligence platform.\n\nStart your journey by completing your first EI Assessment.\n\nBest,\nThe BrainUp Team",
  },
  {
    key: "password_reset",
    label: "Password Reset",
    subject: "Reset your BrainUp password",
    body: "Hi {{name}},\n\nClick the link below to reset your password:\n{{reset_link}}\n\nThis link expires in 24 hours.\n\nBest,\nThe BrainUp Team",
  },
  {
    key: "hr_alert",
    label: "HR Flagged Alert",
    subject: "BrainUp: Employee Wellbeing Alert",
    body: "Hi {{hr_name}},\n\nAn employee in your department has been flagged for low emotional wellbeing scores over the past {{days}} days.\n\nPlease consider scheduling a consultation.\n\nBest,\nThe BrainUp Team",
  },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("flagging");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [flagSettings, setFlagSettings] = useState<FlagSettings>({
    low_emotion_threshold: 1,
    low_emotion_days: 7,
    inactivity_days: 14,
  });

  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [activeTemplate, setActiveTemplate] = useState("welcome");

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }
      const md: any = session.user.user_metadata || {};
      if (String(md?.role).toUpperCase() !== "ADMIN") { router.push("/post-login"); return; }

      // Load settings from platform_settings table if it exists
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("*")
          .single();

        if (data && alive) {
          setFlagSettings({
            low_emotion_threshold: data.low_emotion_threshold ?? 1,
            low_emotion_days: data.low_emotion_days ?? 7,
            inactivity_days: data.inactivity_days ?? 14,
          });
          if (data.email_templates) {
            setTemplates(data.email_templates);
          }
        }
      } catch {
        // Table may not exist yet, use defaults
      }

      if (alive) setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  async function saveFlagSettings() {
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("platform_settings")
      .upsert({
        id: 1,
        low_emotion_threshold: flagSettings.low_emotion_threshold,
        low_emotion_days: flagSettings.low_emotion_days,
        inactivity_days: flagSettings.inactivity_days,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      setMsg({ text: `Failed to save: ${error.message}`, type: "error" });
    } else {
      setMsg({ text: "Settings saved successfully.", type: "success" });
    }
    setSaving(false);
  }

  async function saveTemplates() {
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("platform_settings")
      .upsert({
        id: 1,
        email_templates: templates,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      setMsg({ text: `Failed to save: ${error.message}`, type: "error" });
    } else {
      setMsg({ text: "Templates saved successfully.", type: "success" });
    }
    setSaving(false);
  }

  function updateTemplate(key: string, field: "subject" | "body", value: string) {
    setTemplates(prev =>
      prev.map(t => t.key === key ? { ...t, [field]: value } : t)
    );
  }

  const currentTemplate = templates.find(t => t.key === activeTemplate) ?? templates[0];

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">System Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure platform-wide settings, flagging thresholds and email templates.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: "flagging", label: "EI Flagging", icon: <AlertTriangle size={14} /> },
          { key: "email", label: "Email Templates", icon: <Mail size={14} /> },
          { key: "platform", label: "Platform Info", icon: <Shield size={14} /> },
        ].map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => { setActiveSection(s.key); setMsg(null); }}
            className={[
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold border-b-2 transition -mb-px",
              activeSection === s.key
                ? "border-cyan-500 text-cyan-600"
                : "border-transparent text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
          msg.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {msg.text}
        </div>
      )}

      {/* EI FLAGGING SECTION */}
      {activeSection === "flagging" && (
        <section className="glow-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Sliders size={16} className="text-cyan-500" />
            <div className="text-sm font-extrabold text-slate-900">EI Flagging Thresholds</div>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Configure when employees are flagged for HR attention based on their emotional check-in patterns.
          </p>

          <div className="space-y-5">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-slate-900">Low Emotion Threshold</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Flag employees who log emotion level at or below this value.
                    Scale is 1 (Very Low) to 5 (Very High).
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={flagSettings.low_emotion_threshold}
                    onChange={e => setFlagSettings(p => ({ ...p, low_emotion_threshold: Number(e.target.value) }))}
                    className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-center outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                  <span className="text-xs text-slate-500">/ 5</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-slate-900">Low Emotion Window</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Number of days to look back when counting low emotion check-ins.
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="number"
                    min={3}
                    max={30}
                    value={flagSettings.low_emotion_days}
                    onChange={e => setFlagSettings(p => ({ ...p, low_emotion_days: Number(e.target.value) }))}
                    className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-center outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                  <span className="text-xs text-slate-500">days</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-slate-900">Inactivity Flag</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Flag employees who have not logged any check-in for this many days.
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="number"
                    min={7}
                    max={60}
                    value={flagSettings.inactivity_days}
                    onChange={e => setFlagSettings(p => ({ ...p, inactivity_days: Number(e.target.value) }))}
                    className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-center outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                  <span className="text-xs text-slate-500">days</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={saveFlagSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </section>
      )}

      {/* EMAIL TEMPLATES SECTION */}
      {activeSection === "email" && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Template selector */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-extrabold text-slate-900 mb-3">Templates</div>
            <div className="space-y-2">
              {templates.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTemplate(t.key)}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    activeTemplate === t.key
                      ? "bg-cyan-50 border border-cyan-200 text-cyan-700"
                      : "border border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <Mail size={14} />
                  <span className="text-sm font-semibold">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3">
              <div className="text-xs font-bold text-amber-700 mb-1">Available Variables</div>
              <div className="space-y-1 text-[10px] text-amber-600 font-mono">
                <div>{"{{name}}"} — User full name</div>
                <div>{"{{hr_name}}"} — HR manager name</div>
                <div>{"{{reset_link}}"} — Password reset URL</div>
                <div>{"{{days}}"} — Number of days</div>
              </div>
            </div>
          </section>

          {/* Template editor */}
          <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-extrabold text-slate-900">{currentTemplate.label}</div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Bell size={11} />
                Email Template
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Subject Line</label>
                <input
                  value={currentTemplate.subject}
                  onChange={e => updateTemplate(currentTemplate.key, "subject", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Email Body</label>
                <textarea
                  value={currentTemplate.body}
                  onChange={e => updateTemplate(currentTemplate.key, "body", e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 resize-none font-mono"
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={saveTemplates}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : "Save Templates"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* PLATFORM INFO SECTION */}
      {activeSection === "platform" && (
        <section className="glow-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-cyan-500" />
            <div className="text-sm font-extrabold text-slate-900">Platform Information</div>
          </div>

          <div className="space-y-3">
            {[
              { label: "Platform Name", value: "BrainUp" },
              { label: "Version", value: "1.0.0" },
              { label: "Stack", value: "Next.js 16 + Supabase" },
              { label: "Environment", value: "Production" },
              { label: "Database", value: "PostgreSQL (Supabase)" },
              { label: "Auth Provider", value: "Supabase Auth" },
              { label: "Storage", value: "Supabase Storage" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-xs font-bold text-slate-500">{item.label}</span>
                <span className="text-xs font-extrabold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50 p-4">
            <div className="text-xs font-bold text-cyan-700 mb-1">About BrainUp Admin</div>
            <div className="text-xs text-cyan-600">
              This admin panel is for the BrainUp development team only.
              All changes made here affect the live platform immediately.
              Please proceed with caution when modifying settings.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}