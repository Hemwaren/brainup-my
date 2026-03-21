"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getLevelFromXP } from "@/lib/gamification";
import OnboardingModal from "@/app/components/OnboardingModal";
import EmotionCard from "@/app/components/EmotionCard"; // ✅ NEW
import Cropper from "react-easy-crop";
import {
  Mail, BadgeCheck, Building2, Flame, Sparkles, Plus, Circle,
  CheckCircle2, BarChart3, Phone, Heart, Wrench, ArrowRight,
  Star, Camera, Loader2, X,
} from "lucide-react";

type AppRole = "EMPLOYEE" | "HR" | "ADMIN" | string;

type Profile = {
  id: string;
  full_name: string;
  nickname: string | null;
  email: string;
  role: AppRole;
  department: string;
  created_at?: string | null;
  avatar_url?: string | null;
  level: number;
  total_xp: number;
  days_streak: number;
  stars: number;
  age?: number | null;
  gender?: string | null;
  ei_identify_level?: string | null;
  one_word_self?: string | null;
  onboarding_completed: boolean;
};

type FocusTask = { id: string; text: string };
type Announcement = { id: string; title: string; content: string; category: string; publish_date: string; status: string; };
type SupportListing = { id: string; title: string; description: string; category: string; contact: string | null; url: string | null; is_urgent: boolean; };
type CropArea = { x: number; y: number; width: number; height: number };

function fmtJoined(iso: string | null | undefined) {
  if (!iso) return "Joined recently";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Joined recently";
  return `Joined ${d.toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric" })}`;
}

function fmtDate(d: string) {
  const date = new Date(d);
  const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function cryptoId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }

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
    canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error("Canvas is empty")); }, "image/jpeg", 0.92);
  });
}

const CATEGORY_BORDER: Record<string, string> = { WELLNESS: "border-l-emerald-400", EVENT: "border-l-sky-400", REMINDER: "border-l-amber-400", GENERAL: "border-l-slate-300" };
const CATEGORY_BADGE: Record<string, string> = { WELLNESS: "bg-emerald-50 text-emerald-700", EVENT: "bg-sky-50 text-sky-700", REMINDER: "bg-amber-50 text-amber-700", GENERAL: "bg-slate-50 text-slate-600" };

export default function PostLoginPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [supportListings, setSupportListings] = useState<SupportListing[]>([]);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [showAllSupport, setShowAllSupport] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [tasks, setTasks] = useState<FocusTask[]>([
    { id: "t1", text: "Complete EI Assessment module" },
    { id: "t2", text: "Write a short journal entry" },
  ]);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  const onCropComplete = useCallback((_: unknown, croppedPixels: CropArea) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error || !data?.user) { router.push("/auth"); return; }

      const u = data.user;
      const md: any = u.user_metadata || {};

      let dbProfile: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data: p, error: pErr } = await supabase
            .from("profiles")
            .select("id, full_name, nickname, role, department, created_at, avatar_url, age, gender, ei_identify_level, one_word_self, onboarding_completed")
            .eq("id", u.id)
            .maybeSingle();
          if (!pErr && p) { dbProfile = p; break; }
        } catch { /* retry */ }
        await new Promise(res => setTimeout(res, 400));
      }

      let gamRow: any = null;
      try {
        const { data: g } = await supabase
          .from("user_gamification")
          .select("total_xp, level, current_streak, stars")
          .eq("user_id", u.id)
          .maybeSingle();
        gamRow = g || null;
      } catch { gamRow = null; }

      try {
        const { data: ann } = await supabase
          .from("hr_announcements")
          .select("id, title, content, category, publish_date, status")
          .eq("status", "PUBLISHED")
          .order("publish_date", { ascending: false })
          .limit(20);
        if (alive) setAnnouncements(ann ?? []);
      } catch { if (alive) setAnnouncements([]); }

      try {
        const { data: support } = await supabase
          .from("support_directory")
          .select("id, title, description, category, contact, url, is_urgent")
          .eq("is_active", true)
          .order("is_urgent", { ascending: false })
          .limit(30);
        if (alive) setSupportListings(support ?? []);
      } catch { if (alive) setSupportListings([]); }

      const role: AppRole = (dbProfile?.role ?? md?.role ?? "EMPLOYEE") as AppRole;
      const deptRaw = (dbProfile?.department ?? md?.department ?? "") as string;
      const department = String(role).toUpperCase() === "HR" ? "Human Resources" : deptRaw || "—";
      const onboardingDone = dbProfile?.onboarding_completed === true;

      if (alive) {
        setProfile({
          id: u.id,
          full_name: dbProfile?.full_name ?? md?.full_name ?? "User",
          nickname: dbProfile?.nickname ?? null,
          email: u.email ?? "",
          role,
          department,
          created_at: dbProfile?.created_at ?? u.created_at ?? null,
          avatar_url: dbProfile?.avatar_url ?? null,
          level: Number(gamRow?.level ?? 1),
          total_xp: Number(gamRow?.total_xp ?? 0),
          days_streak: Number(gamRow?.current_streak ?? 0),
          stars: Number(gamRow?.stars ?? 0),
          age: dbProfile?.age ?? null,
          gender: dbProfile?.gender ?? null,
          ei_identify_level: dbProfile?.ei_identify_level ?? null,
          one_word_self: dbProfile?.one_word_self ?? null,
          onboarding_completed: onboardingDone,
        });
        if (!onboardingDone) setShowOnboarding(true);
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [router]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }
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
      if (uploadError) { alert("Upload failed: " + uploadError.message); setUploadingAvatar(false); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null;
      await supabase.from("profiles").update({ avatar_url: urlData?.publicUrl ?? null }).eq("id", profile.id);
      setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev);
    } catch (err: any) { alert("Something went wrong: " + err.message); }
    setUploadingAvatar(false);
  }

  const roleLabel = useMemo(() => {
    const r = String(profile?.role || "EMPLOYEE").toUpperCase();
    if (r === "HR") return "HR Manager";
    if (r === "ADMIN") return "Admin";
    return "Employee";
  }, [profile?.role]);

  const levelInfo = useMemo(() => getLevelFromXP(profile?.total_xp ?? 0), [profile?.total_xp]);
  const levelProgress = clamp(Math.round((levelInfo.xpIntoLevel / levelInfo.xpNeeded) * 100), 0, 100);

  function addTask() {
    const text = taskText.trim();
    if (!text) return;
    setTasks((prev) => [{ id: cryptoId(), text }, ...prev]);
    setTaskText("");
  }
  function completeTask(id: string) { setTasks((prev) => prev.filter((t) => t.id !== id)); }

  if (loading || !profile) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading your dashboard…</p>
      </div>
    );
  }

  const supportColorMap: Record<string, "teal" | "rose" | "amber"> = { CRISIS: "rose", COUNSELLING: "teal", SELF_HELP: "amber", ONLINE: "teal", IN_PERSON: "rose" };
  const supportIconMap: Record<string, React.ReactNode> = { CRISIS: <Phone size={18} />, COUNSELLING: <Heart size={18} />, SELF_HELP: <Wrench size={18} />, ONLINE: <Phone size={18} />, IN_PERSON: <Heart size={18} /> };

  const displayName = profile.nickname || profile.full_name;
  const ageGenderValue = profile.age && profile.gender ? `${profile.age} · ${profile.gender}` : profile.age ? String(profile.age) : profile.gender ?? "—";

  return (
    <div className="space-y-5">

      {/* Onboarding modal */}
      {showOnboarding && (
        <OnboardingModal
          userId={profile.id}
          onComplete={(data) => {
            setProfile((prev) => prev ? {
              ...prev,
              nickname: data.nickname,
              age: data.age,
              gender: data.gender,
              ei_identify_level: data.ei_identify_level,
              one_word_self: data.one_word_self,
              onboarding_completed: true,
            } : prev);
            setShowOnboarding(false);
          }}
        />
      )}

      {/* Image Cropper Modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="text-sm font-extrabold text-slate-900">Adjust your photo</div>
              <button type="button" onClick={() => setCropSrc(null)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                <X size={14} />
              </button>
            </div>
            <div className="relative w-full bg-black" style={{ height: 320 }}>
              <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
                onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}
                style={{ containerStyle: { width: "100%", height: "100%" }, cropAreaStyle: { border: "3px solid #22d3ee" } }} />
            </div>
            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500">Zoom</label>
                <span className="text-xs font-bold text-cyan-600">{zoom.toFixed(1)}x</span>
              </div>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-cyan-500" />
              <p className="mt-2 text-xs text-slate-400 text-center">Drag to reposition · Slider to zoom</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button type="button" onClick={() => setCropSrc(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button type="button" onClick={handleCropConfirm} className="flex-1 rounded-xl py-2.5 text-sm font-extrabold text-white hover:opacity-95 transition" style={{ background: "linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)" }}>Apply Photo</button>
            </div>
          </div>
        </div>
      )}

      {/* Announcements popup */}
      {showAllAnnouncements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="text-base font-extrabold text-slate-900">All Announcements</div>
              <button type="button" onClick={() => setShowAllAnnouncements(false)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition font-bold">✕</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-3">
              {announcements.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No announcements yet.</p>
                : announcements.map((a) => (
                  <div key={a.id} className={["rounded-xl border border-slate-200 border-l-4 bg-white p-4", CATEGORY_BORDER[a.category] ?? "border-l-slate-300"].join(" ")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-extrabold text-slate-900">{a.title}</div>
                      <div className="text-[11px] font-bold text-slate-400 shrink-0">{fmtDate(a.publish_date)}</div>
                    </div>
                    <div className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${CATEGORY_BADGE[a.category] ?? "bg-slate-50 text-slate-600"}`}>{a.category}</div>
                    <div className="mt-2 text-sm text-slate-600">{a.content}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Support popup */}
      {showAllSupport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="text-base font-extrabold text-slate-900">Mental Health Support Directory</div>
              <button type="button" onClick={() => setShowAllSupport(false)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition font-bold">✕</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-3">
              {supportListings.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No support resources available yet.</p>
                : supportListings.map((s) => (
                  <div key={s.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${supportColorMap[s.category] === "rose" ? "bg-rose-50 text-rose-600" : supportColorMap[s.category] === "amber" ? "bg-amber-50 text-amber-600" : "bg-teal-50 text-teal-600"}`}>
                      {supportIconMap[s.category] ?? <Heart size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="text-sm font-extrabold text-slate-900">{s.title}</div>
                        {s.is_urgent && <span className="inline-flex rounded-full bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-700">URGENT</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{s.description}</div>
                      {s.contact && <div className="mt-1 text-xs font-bold text-cyan-600">{s.contact}</div>}
                      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs font-bold text-cyan-600 hover:underline block truncate">{s.url}</a>}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Home</h1>
        <p className="mt-1 text-sm text-slate-600">Welcome back, {displayName}. Here is your overview.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">

        {/* Profile card */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="relative h-28 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute right-4 -bottom-6 h-20 w-20 rounded-full bg-white/10" />
            <div className="absolute -bottom-10 left-5">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-gradient-to-br from-teal-400 to-cyan-400">
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                    : <div className="h-full w-full flex items-center justify-center text-white text-2xl font-extrabold">{displayName.charAt(0).toUpperCase()}</div>
                  }
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-white border-2 border-white hover:bg-slate-700 transition disabled:opacity-50">
                  {uploadingAvatar ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => router.push("/profile")}
              className="absolute top-3 right-4 rounded-xl border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-white/30 transition backdrop-blur-sm">
              Edit Profile
            </button>
          </div>

          <div className="px-5 pt-14 pb-5">
            <div className="mb-4">
              <div className="text-xl font-extrabold text-slate-900">{displayName}</div>
              {profile.one_word_self && (
                <span className="inline-flex mt-1 rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 text-xs font-bold text-cyan-700">{profile.one_word_self}</span>
              )}
              <div className="mt-1 text-xs text-slate-500">{roleLabel} · {profile.department} · {fmtJoined(profile.created_at)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <InfoBox label="Email" value={profile.email || "—"} icon={<Mail size={14} className="text-slate-400" />} />
              <InfoBox label="Role" value={roleLabel} icon={<BadgeCheck size={14} className="text-slate-400" />} />
              <InfoBox label="Department" value={profile.department || "—"} icon={<Building2 size={14} className="text-slate-400" />} />
              <InfoBox label="Age / Gender" value={ageGenderValue} icon={<Sparkles size={14} className="text-slate-400" />} />
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Gamification Stats</div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Level", value: profile.level, icon: <Sparkles size={13} className="text-cyan-500" /> },
                  { label: "XP", value: profile.total_xp, icon: <BarChart3 size={13} className="text-sky-500" /> },
                  { label: "Streak", value: `${profile.days_streak}d`, icon: <Flame size={13} className="text-orange-400" /> },
                  { label: "Stars", value: profile.stars, icon: <Star size={13} className="text-amber-400" /> },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white border border-slate-100 p-2 text-center">
                    <div className="flex justify-center mb-1">{s.icon}</div>
                    <div className="text-sm font-extrabold text-slate-900">{s.value}</div>
                    <div className="text-[10px] font-bold text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-500">Level {profile.level} — {levelInfo.title}</span>
                  <span className="font-extrabold text-slate-700">{levelInfo.xpIntoLevel} / {levelInfo.xpNeeded} XP</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 transition-all" style={{ width: `${levelProgress}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {levelInfo.nextLevel ? `${levelInfo.xpNeeded - levelInfo.xpIntoLevel} XP to Level ${levelInfo.nextLevel.level}` : "Max level reached!"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ✅ RIGHT COLUMN — Emotion Card above Today's Focus */}
        <div className="flex flex-col gap-4">

          {/* ✅ NEW: Emotion Check-in Card */}
          <EmotionCard userId={profile.id} department={profile.department} />

          {/* Today's Focus */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-extrabold text-slate-900">Today&#39;s Focus</div>
              <div className="text-xs text-slate-400">{tasks.length} remaining</div>
            </div>
            <p className="text-xs text-slate-500 mb-4">Add tasks and tick them off when done.</p>
            <div className="flex gap-2">
              <input value={taskText} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} placeholder="Add a task..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 focus:bg-white transition" />
              <button type="button" onClick={addTask} className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white hover:opacity-95 transition">
                <Plus size={16} />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {tasks.length === 0
                ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">All done! 🎉</div>
                : tasks.map((t) => (
                  <button key={t.id} type="button" onClick={() => completeTask(t.id)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50 hover:border-cyan-200 transition">
                    <span className="text-slate-300 group-hover:text-cyan-400 transition shrink-0"><Circle size={16} /></span>
                    <span className="text-sm font-semibold text-slate-800 group-hover:text-cyan-700 transition flex-1">{t.text}</span>
                    <CheckCircle2 size={14} className="text-slate-200 group-hover:text-cyan-400 transition shrink-0" />
                  </button>
                ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">Click a task to mark it complete.</p>
          </section>

        </div>
      </div>

      {/* Announcements */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-extrabold text-slate-900">Announcement Board</div>
            <div className="mt-0.5 text-xs text-slate-500">Updates posted by HR.</div>
          </div>
          <button type="button" onClick={() => setShowAllAnnouncements(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition shrink-0">
            View all <ArrowRight size={12} />
          </button>
        </div>
        {announcements.length === 0
          ? <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">No announcements yet.</div>
          : <div className="grid gap-3 md:grid-cols-2">
            {announcements.slice(0, 4).map((a) => (
              <div key={a.id} className={["rounded-xl border border-slate-200 border-l-4 bg-white p-4 hover:shadow-sm transition-shadow", CATEGORY_BORDER[a.category] ?? "border-l-slate-300"].join(" ")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-extrabold text-slate-900">{a.title}</div>
                  <div className="text-[11px] font-bold text-slate-400 shrink-0">{fmtDate(a.publish_date)}</div>
                </div>
                <div className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${CATEGORY_BADGE[a.category] ?? "bg-slate-50 text-slate-600"}`}>{a.category}</div>
                <div className="mt-2 text-sm text-slate-600 line-clamp-2">{a.content}</div>
              </div>
            ))}
          </div>
        }
      </section>

      {/* Support */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-extrabold text-slate-900">Mental Health Support</div>
            <div className="mt-0.5 text-xs text-slate-500">Verified resources from BrainUp admin.</div>
          </div>
          <button type="button" onClick={() => setShowAllSupport(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition shrink-0">
            Open directory <ArrowRight size={12} />
          </button>
        </div>
        {supportListings.length === 0
          ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">No support resources available yet.</div>
          : <div className="grid gap-3 md:grid-cols-3">
            {supportListings.slice(0, 3).map((s) => {
              const color = supportColorMap[s.category] ?? "teal";
              const colorCls = color === "rose" ? "bg-rose-50 text-rose-600" : color === "amber" ? "bg-amber-50 text-amber-600" : "bg-teal-50 text-teal-600";
              return (
                <div key={s.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm hover:border-slate-300 transition-all">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${colorCls}`}>{supportIconMap[s.category] ?? <Heart size={18} />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="text-sm font-extrabold text-slate-900">{s.title}</div>
                      {s.is_urgent && <span className="inline-flex rounded-full bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-700">URGENT</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{s.description}</div>
                    {s.contact && <div className="mt-1 text-xs font-bold text-cyan-600">{s.contact}</div>}
                    {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs font-bold text-cyan-600 hover:underline block truncate">{s.url}</a>}
                  </div>
                </div>
              );
            })}
          </div>
        }
      </section>

    </div>
  );
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <div className="text-xs font-bold text-slate-400">{label}</div>
      </div>
      <div className="text-sm font-extrabold text-slate-900 truncate">{value}</div>
    </div>
  );
}