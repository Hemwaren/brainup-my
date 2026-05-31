"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Cropper from "react-easy-crop";
import {
  Camera, Loader2, Save, X, CheckCircle2, ArrowLeft,
} from "lucide-react";

type CropArea = { x: number; y: number; width: number; height: number };

type Profile = {
  id: string;
  full_name: string;
  nickname: string | null;
  email: string;
  role: string;
  department: string;
  age: number | null;
  gender: string | null;
  one_word_self: string | null;
  avatar_url: string | null;
};

const DEPARTMENTS = [
  "Operation", "Human Resources", "Engineering",
  "Marketing", "Finance", "Sales", "Design", "Legal", "Other",
];

const GENDERS = ["Male", "Female", "Prefer not to say"];

async function getCroppedImg(imageSrc: string, cropArea: CropArea): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cropArea.width, cropArea.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => { if (blob) resolve(blob); else reject(new Error("Canvas empty")); }, "image/jpeg", 0.92);
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    nickname: "",
    department: "",
    age: "",
    gender: "",
    one_word_self: "",
  });
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const onCropComplete = useCallback((_: unknown, cropped: CropArea) => {
    setCroppedAreaPixels(cropped);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push("/auth"); return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, role, department, age, gender, one_word_self, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      const loaded: Profile = {
        id: user.id,
        full_name: p?.full_name ?? "",
        nickname: p?.nickname ?? null,
        email: user.email ?? "",
        role: p?.role ?? "EMPLOYEE",
        department: p?.department ?? "",
        age: p?.age ?? null,
        gender: p?.gender ?? null,
        one_word_self: p?.one_word_self ?? null,
        avatar_url: p?.avatar_url ?? null,
      };

      setProfile(loaded);
      setForm({
        full_name: loaded.full_name,
        nickname: loaded.nickname ?? "",
        department: loaded.department,
        age: loaded.age ? String(loaded.age) : "",
        gender: loaded.gender ?? "",
        one_word_self: loaded.one_word_self ?? "",
      });
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg({ text: "Image must be under 5MB.", type: "error" }); return; }
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setCrop({ x: 0, y: 0 }); setZoom(1); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels || !profile) return;
    setUploadingAvatar(true);
    setCropSrc(null);
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels);
      const filePath = `avatars/${profile.id}.jpg`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) { setMsg({ text: "Upload failed: " + uploadError.message, type: "error" }); setUploadingAvatar(false); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null;
      await supabase.from("profiles").update({ avatar_url: urlData?.publicUrl ?? null }).eq("id", profile.id);
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev);
      if (publicUrl) {
        localStorage.setItem("brainup_avatar", publicUrl);
        window.dispatchEvent(new CustomEvent("brainup_avatar_updated", { detail: publicUrl }));
      }
      setMsg({ text: "Profile photo updated! ✅", type: "success" });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg({ text: "Something went wrong.", type: "error" });
    }
    setUploadingAvatar(false);
  }

  async function handleSave() {
    if (!profile) return;
    if (!form.full_name.trim()) { setMsg({ text: "Full name is required.", type: "error" }); return; }
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim(),
      nickname: form.nickname.trim() || null,
      department: form.department,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      one_word_self: form.one_word_self.trim() || null,
    }).eq("id", profile.id);

    if (error) {
      setMsg({ text: "Failed to save: " + error.message, type: "error" });
      setSaving(false);
      return;
    }

    setProfile(prev => prev ? {
      ...prev,
      full_name: form.full_name.trim(),
      nickname: form.nickname.trim() || null,
      department: form.department,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      one_word_self: form.one_word_self.trim() || null,
    } : prev);

    setMsg({ text: "Profile saved successfully! ✅", type: "success" });
    setSaving(false);
    setTimeout(() => router.push("/post-login"), 1500);
  }

  if (loading || !profile) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading profile...</p>
      </div>
    );
  }

  const displayName = profile.nickname || profile.full_name;
  const roleLabel = profile.role === "HR"
    ? "Human Resource (HR)"
    : profile.role === "ADMIN"
    ? "Admin"
    : "Employee";

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* Image Crop Modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="text-sm font-extrabold text-slate-900">Adjust your photo</div>
              <button type="button" onClick={() => setCropSrc(null)}
                className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                <X size={14} />
              </button>
            </div>
            <div className="relative w-full bg-black" style={{ height: 320 }}>
              <Cropper
                image={cropSrc} crop={crop} zoom={zoom} aspect={1}
                cropShape="round" showGrid={false}
                onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}
                style={{ containerStyle: { width: "100%", height: "100%" }, cropAreaStyle: { border: "3px solid #22d3ee" } }}
              />
            </div>
            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">Zoom</span>
                <span className="text-xs font-bold text-cyan-600">{zoom.toFixed(1)}x</span>
              </div>
              <input type="range" min={1} max={3} step={0.01} value={zoom}
                onChange={e => setZoom(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button type="button" onClick={() => setCropSrc(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button type="button" onClick={handleCropConfirm}
                className="flex-1 rounded-xl py-2.5 text-sm font-extrabold text-white hover:opacity-95 transition"
                style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>
                Apply Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push("/post-login")}
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Edit Profile</h1>
          <p className="text-sm text-slate-500">Update your personal information</p>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={[
          "rounded-2xl border px-4 py-3 text-sm font-bold flex items-center gap-2",
          msg.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700",
        ].join(" ")}>
          {msg.type === "success" && <CheckCircle2 size={16} />}
          {msg.text}
        </div>
      )}

      {/* 2-column layout — equal height cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" style={{ alignItems: "stretch" }}>

        {/* Left column */}
        <div className="flex flex-col gap-4">

          {/* Avatar card — fully centered */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-center text-center">
            <div className="text-sm font-extrabold text-slate-900 mb-4 w-full text-left">Profile Photo</div>
            <div className="relative mb-4">
              <div className="h-28 w-28 rounded-2xl border-2 border-slate-200 overflow-hidden bg-gradient-to-br from-teal-400 to-cyan-400">
                {profile.avatar_url
                  ? <img src={`${profile.avatar_url}?t=${Date.now()}`} alt="Avatar" className="h-full w-full object-cover" />
                  : <div className="h-full w-full flex items-center justify-center text-white text-4xl font-extrabold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                }
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-white border-2 border-white hover:bg-slate-700 transition disabled:opacity-50">
                {uploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              </button>
            </div>
            <div className="mb-4">
              <div className="text-base font-extrabold text-slate-900">{displayName}</div>
              <div className="text-xs text-slate-500 mt-0.5">{roleLabel}</div>
              <div className="text-xs text-slate-400">{form.department || "—"}</div>
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition">
              <Camera size={12} /> Change photo
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </section>

          {/* Account info card — flex-1 to fill remaining height */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col">
            <div className="text-sm font-extrabold text-slate-900 mb-4">Account Info</div>
            <div className="space-y-0 flex-1">
              {[
                { label: "Email", value: profile.email },
                { label: "Role", value: roleLabel },
                { label: "Department", value: form.department || "—" },
                { label: "Gender", value: form.gender || "—" },
                { label: "Age", value: form.age || "—" },
                { label: "One Word", value: form.one_word_self || "—" },
              ].map((item, idx, arr) => (
                <div key={item.label}
                  className={`flex items-center justify-between py-2.5 ${idx < arr.length - 1 ? "border-b border-slate-50" : ""}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">{item.label}</p>
                  <p className="text-xs text-slate-700 font-semibold truncate max-w-[55%] text-right">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Connected accounts */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Connected Accounts</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-xs text-slate-600 font-semibold">Google Workspace</span>
                </div>
                <a href="/settings" className="text-[10px] font-bold text-cyan-600 hover:underline">Manage →</a>
              </div>
            </div>
          </section>
        </div>

        {/* Right column — Form spans 2 cols */}
        <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="text-sm font-extrabold text-slate-900 mb-5">Personal Information</div>
          <div className="space-y-4 flex-1">

            {/* Full name + Nickname */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">
                  Nickname / Preferred Name
                </label>
                <input
                  value={form.nickname}
                  onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))}
                  placeholder="e.g. Alex, Kak Ani"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Email</label>
              <input
                value={profile.email}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
              <p className="mt-1 text-[10px] text-slate-400">Email cannot be changed here. Contact admin.</p>
            </div>

            {/* Role + Department */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Role</label>
                <input
                  value={roleLabel}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Department</label>
                <select
                  value={form.department}
                  onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition">
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Age + Gender */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Age</label>
                <input
                  type="number" min={16} max={80}
                  value={form.age}
                  onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                  placeholder="Your age"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Gender</label>
                <div className="flex gap-2">
                  {GENDERS.map(g => (
                    <button key={g} type="button" onClick={() => setForm(p => ({ ...p, gender: g }))}
                      className={[
                        "flex-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition",
                        form.gender === g
                          ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      ].join(" ")}>
                      {g === "Prefer not to say" ? "Prefer not" : g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* One word */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">
                One word to describe yourself
              </label>
              <input
                value={form.one_word_self}
                onChange={e => setForm(p => ({ ...p, one_word_self: e.target.value.split(" ")[0] }))}
                placeholder="e.g. Curious, Resilient, Creative"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition"
              />
            </div>

          </div>

          {/* Actions pinned to bottom */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex gap-3">
            <button type="button" onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition"
              style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                : <><Save size={14} /> Save Changes</>
              }
            </button>
            <button type="button" onClick={() => router.push("/post-login")}
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}