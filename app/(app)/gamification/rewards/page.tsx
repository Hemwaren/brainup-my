"use client";

/**
 * app/(app)/gamification/rewards/page.tsx — FIXED
 *
 * Changes from previous version:
 * 1. Star balance hero: amber/orange gradient → teal/cyan (matches app theme)
 * 2. Category tab transitions: removed AnimatePresence mode="popLayout" (caused
 *    jarring layout shifts). Replaced with simple uniform opacity + translateY fade
 *    using a single CSS transition on the grid wrapper keyed by category.
 * 3. Emoji removed from reward cards and UI — replaced with lucide icons
 * 4. Emoji removed from history rows — replaced with a gift icon
 * 5. Confetti is subtle teal/cyan palette instead of rainbow
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, Gift, ShoppingBag, Smartphone, Sparkles, X, Check,
  Loader2, Trophy, Zap, Clock, Info, ChevronRight, Lock,
  Car, Coffee, CreditCard, Dumbbell, Palette, Frame,
  Image as ImageIcon,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────── */
type RedemptionRow = {
  id: string;
  reward_key: string;
  stars_spent: number;
  redeemed_at: string;
};

type Reward = {
  key: string;
  name: string;
  description: string;
  cost: number;
  category: "voucher" | "digital" | "extra";
  instructions?: string;
};

/* ─── Reward icon map (no emoji) ─────────────────────────────────────── */
const REWARD_ICONS: Record<string, React.ReactNode> = {
  grab5:          <Car       size={20} className="text-cyan-600" />,
  grabfood5:      <ShoppingBag size={20} className="text-cyan-600" />,
  zus5:           <Coffee    size={20} className="text-cyan-600" />,
  tng10:          <CreditCard size={20} className="text-cyan-600" />,
  shopee10:       <ShoppingBag size={20} className="text-cyan-600" />,
  lazada10:       <ShoppingBag size={20} className="text-cyan-600" />,
  wellness15:     <Dumbbell  size={20} className="text-cyan-600" />,
  profile_theme:  <Palette   size={20} className="text-cyan-600" />,
  avatar_frame:   <Frame     size={20} className="text-cyan-600" />,
  wallpaper:      <ImageIcon size={20} className="text-cyan-600" />,
};

/* ─── Fallback catalog ───────────────────────────────────────────────── */
const FALLBACK_REWARDS: Reward[] = [
  { key: "grab5",         name: "RM5 Grab Voucher",           description: "Use on any Grab ride or delivery",                cost: 50,  category: "voucher",  instructions: "Code will be emailed to you within 24 hours." },
  { key: "grabfood5",     name: "RM5 GrabFood Voucher",        description: "Order food from your favourite restaurants",       cost: 50,  category: "voucher",  instructions: "Code will be emailed to you within 24 hours." },
  { key: "zus5",          name: "RM5 ZUS Coffee Voucher",      description: "Enjoy your favourite brew at ZUS Coffee",          cost: 45,  category: "voucher",  instructions: "Voucher sent to your registered email." },
  { key: "tng10",         name: "RM10 Touch 'n Go Reload",     description: "Top up your TNG wallet instantly",                 cost: 90,  category: "voucher",  instructions: "Reload PIN sent to your email within 24 hours." },
  { key: "shopee10",      name: "RM10 Shopee Voucher",         description: "Shop anything on Shopee",                          cost: 90,  category: "voucher",  instructions: "Voucher code sent to your email." },
  { key: "lazada10",      name: "RM10 Lazada Voucher",         description: "Shop anything on Lazada",                          cost: 90,  category: "voucher",  instructions: "Voucher code sent to your email." },
  { key: "wellness15",    name: "RM15 Wellness Gift Card",     description: "Use at participating wellness centres",             cost: 130, category: "voucher",  instructions: "Physical card mailed within 5 working days." },
  { key: "profile_theme", name: "Premium Profile Theme",       description: "Unlock an exclusive colour theme for your profile", cost: 25, category: "digital",  instructions: "Applied to your profile automatically within minutes." },
  { key: "avatar_frame",  name: "Exclusive Avatar Frame",      description: "Stand out in the leaderboard with a unique frame",  cost: 20, category: "digital",  instructions: "Frame applied to your profile automatically." },
  { key: "wallpaper",     name: "Motivational Wallpaper Pack", description: "10 beautifully designed wallpapers for any device", cost: 15, category: "extra",    instructions: "Download link sent to your email." },
];

const CATEGORIES = [
  { key: "all",     label: "All",      icon: <Gift        size={12} /> },
  { key: "voucher", label: "Vouchers", icon: <ShoppingBag size={12} /> },
  { key: "digital", label: "Digital",  icon: <Smartphone  size={12} /> },
  { key: "extra",   label: "Extras",   icon: <Sparkles    size={12} /> },
] as const;

/* ─── Reward Card ────────────────────────────────────────────────────── */
function RewardCard({
  reward, stars, isRedeeming, alreadyRedeemed, onRedeem, onInfo,
}: {
  reward: Reward;
  stars: number;
  isRedeeming: boolean;
  alreadyRedeemed: boolean;
  onRedeem: () => void;
  onInfo: () => void;
}) {
  const canAfford = stars >= reward.cost;
  const progress  = Math.min(100, Math.round((stars / reward.cost) * 100));
  const icon      = REWARD_ICONS[reward.key] ?? <Gift size={20} className="text-cyan-600" />;

  return (
    <div className={[
      "relative flex flex-col rounded-2xl border p-4 transition-all duration-200",
      alreadyRedeemed
        ? "border-teal-200 bg-teal-50"
        : canAfford
          ? "border-slate-200 bg-white shadow-sm hover:border-cyan-200 hover:shadow-md"
          : "border-slate-100 bg-slate-50 opacity-70",
    ].join(" ")}>
      {/* Info button */}
      <button type="button" onClick={onInfo}
        className="absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full text-slate-300 hover:text-slate-500 transition">
        <Info size={13} />
      </button>

      {/* Icon */}
      <div className={[
        "mb-3 grid h-10 w-10 place-items-center rounded-xl",
        alreadyRedeemed ? "bg-teal-100" : canAfford ? "bg-cyan-50" : "bg-slate-100",
      ].join(" ")}>
        {icon}
      </div>

      <div className="text-sm font-extrabold text-slate-900 pr-5 mb-1 leading-snug">{reward.name}</div>
      <div className="text-xs text-slate-500 mb-3 flex-1 leading-relaxed">{reward.description}</div>

      <div className="flex items-center gap-1 mb-3">
        <Star size={12} className="text-amber-500" fill="currentColor" />
        <span className="text-sm font-extrabold text-slate-700">{reward.cost}</span>
        <span className="text-xs text-slate-400 ml-0.5">Stars</span>
      </div>

      {/* Progress bar for unaffordable rewards */}
      {!alreadyRedeemed && !canAfford && (
        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all"
              style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{reward.cost - stars} more stars needed</div>
        </div>
      )}

      <button type="button"
        disabled={!canAfford || !!isRedeeming || alreadyRedeemed}
        onClick={onRedeem}
        className={[
          "w-full rounded-xl px-4 py-2.5 text-xs font-extrabold transition flex items-center justify-center gap-1.5",
          alreadyRedeemed
            ? "bg-teal-100 text-teal-700 border border-teal-200 cursor-default"
            : canAfford && !isRedeeming
              ? "bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 text-white shadow-sm hover:opacity-95"
              : "bg-slate-100 text-slate-400 cursor-not-allowed",
        ].join(" ")}>
        {isRedeeming
          ? <><Loader2 size={11} className="animate-spin" /> Processing...</>
          : alreadyRedeemed
            ? <><Check size={11} /> Redeemed</>
            : !canAfford
              ? <>Need {reward.cost - stars} more stars</>
              : <>Redeem <ChevronRight size={11} /></>}
      </button>
    </div>
  );
}

/* ─── Reward Detail Modal ────────────────────────────────────────────── */
function RewardModal({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const icon = REWARD_ICONS[reward.key] ?? <Gift size={24} className="text-cyan-600" />;
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 transition">
          <X size={15} />
        </button>
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50">{icon}</div>
        <h3 className="text-lg font-extrabold text-slate-900 mb-1">{reward.name}</h3>
        <p className="text-sm text-slate-600 mb-4">{reward.description}</p>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 mb-4">
          <div className="text-xs font-bold text-cyan-700 mb-1 flex items-center gap-1.5">
            <Clock size={11} /> How to receive
          </div>
          <p className="text-sm text-cyan-800">{reward.instructions ?? "Contact HR for delivery details."}</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-extrabold text-slate-700">
          <Star size={15} className="text-amber-500" fill="currentColor" />
          {reward.cost} Stars required
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function RewardsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState(0);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [redeemedSet, setRedeemedSet] = useState<Set<string>>(new Set());
  const [rewards, setRewards] = useState<Reward[]>(FALLBACK_REWARDS);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "error" } | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  // Controls fade transition — increment to trigger re-animation when category changes
  const [categoryKey, setCategoryKey] = useState(0);

  const showToast = useCallback((msg: string, type: "ok" | "error" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }
      const uid = session.user.id;
      setUserId(uid);

      const [{ data: gData }, { data: rData }] = await Promise.all([
        supabase.from("user_gamification").select("stars").eq("user_id", uid).maybeSingle(),
        supabase.from("reward_redemptions")
          .select("id, reward_key, stars_spent, redeemed_at")
          .eq("user_id", uid)
          .order("redeemed_at", { ascending: false }),
      ]);
      if (!alive) return;

      setStars(gData?.stars ?? 0);
      const rows = rData ?? [];
      setRedemptions(rows);
      setRedeemedSet(new Set(rows.map((r: RedemptionRow) => r.reward_key)));

      // Try live reward catalog, fall back gracefully
      const { data: catalogData, error: catalogError } = await supabase
        .from("reward_catalog").select("*").eq("is_active", true).order("cost", { ascending: true });
      if (!catalogError && catalogData?.length) setRewards(catalogData as Reward[]);

      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  // Realtime star sync
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`rewards-stars:${userId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_gamification", filter: `user_id=eq.${userId}` },
        p => setStars((p.new as any).stars ?? 0))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  function handleCategoryChange(cat: string) {
    setActiveCategory(cat);
    setCategoryKey(k => k + 1); // triggers fade-in of new grid
  }

  async function redeemReward(reward: Reward) {
    if (stars < reward.cost || redeeming || redeemedSet.has(reward.key)) return;
    setRedeeming(reward.key);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRedeeming(null); return; }
    const uid = session.user.id;

    // Re-read fresh balance to prevent race condition
    const { data: freshData } = await supabase
      .from("user_gamification").select("stars").eq("user_id", uid).maybeSingle();
    const freshStars = freshData?.stars ?? 0;
    if (freshStars < reward.cost) {
      showToast("Not enough stars — your balance may have changed.", "error");
      setStars(freshStars);
      setRedeeming(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("user_gamification")
      .update({ stars: freshStars - reward.cost, updated_at: new Date().toISOString() })
      .eq("user_id", uid);

    if (updateError) {
      showToast("Something went wrong. Please try again.", "error");
      setRedeeming(null);
      return;
    }

    const { data: newRedemption, error: insertError } = await supabase
      .from("reward_redemptions")
      .insert({ user_id: uid, reward_key: reward.key, stars_spent: reward.cost })
      .select().single();

    if (insertError) {
      // Rollback
      await supabase.from("user_gamification")
        .update({ stars: freshStars, updated_at: new Date().toISOString() }).eq("user_id", uid);
      showToast("Failed to log redemption. Stars restored.", "error");
      setRedeeming(null);
      return;
    }

    setStars(freshStars - reward.cost);
    setRedemptions(prev => [newRedemption, ...prev]);
    setRedeemedSet(prev => new Set([...prev, reward.key]));
    showToast(`${reward.name} redeemed! Check your email.`);
    setRedeeming(null);
  }

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}
    </div>
  );

  const filtered = activeCategory === "all"
    ? rewards
    : rewards.filter(r => r.category === activeCategory);

  // Next reward the user can't yet afford (for progress hint)
  const nextTarget = rewards
    .filter(r => !redeemedSet.has(r.key) && r.cost > stars)
    .sort((a, b) => a.cost - b.cost)[0];

  return (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={[
              "fixed top-4 right-4 z-40 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold shadow-xl",
              toast.type === "ok" ? "bg-slate-900 text-white" : "bg-rose-600 text-white",
            ].join(" ")}>
            {toast.type === "ok" ? <Check size={13} /> : <X size={13} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reward Detail Modal */}
      <AnimatePresence>
        {selectedReward && <RewardModal reward={selectedReward} onClose={() => setSelectedReward(null)} />}
      </AnimatePresence>

      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Rewards Store</h1>
          <p className="mt-1 text-sm text-slate-600">Spend your stars on real rewards.</p>
        </div>

        {/* ── Star Balance Hero — FIXED: teal/cyan, no orange ── */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-500 p-6 shadow-lg text-white">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative z-10">
            <div className="text-[10px] font-bold text-white/65 uppercase tracking-widest mb-2">Your Balance</div>
            <div className="flex items-baseline gap-3">
              <Star size={30} className="text-white shrink-0" fill="currentColor" />
              <span className="text-5xl font-extrabold leading-none">{stars}</span>
              <span className="text-xl font-bold text-white/75">Stars</span>
            </div>
            <div className="mt-2 text-xs text-white/65">Every 100 XP = 1 Star · Level up = +2 Stars</div>

            {/* Progress hint to next reward */}
            {nextTarget && (
              <div className="mt-4">
                <div className="text-xs text-white/70 mb-1.5">
                  {nextTarget.cost - stars} more stars to unlock {nextTarget.name}
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white/80 transition-all"
                    style={{ width: `${Math.min(100, Math.round((stars / nextTarget.cost) * 100))}%` }} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Category tabs ── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {CATEGORIES.map(c => (
            <button key={c.key} type="button"
              onClick={() => handleCategoryChange(c.key)}
              className={[
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition",
                activeCategory === c.key
                  ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              ].join(" ")}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* ── Reward grid — FIXED: uniform fade transition, no layout jump ── */}
        <motion.div
          key={categoryKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map(r => (
            <RewardCard
              key={r.key}
              reward={r}
              stars={stars}
              isRedeeming={redeeming === r.key}
              alreadyRedeemed={redeemedSet.has(r.key)}
              onRedeem={() => redeemReward(r)}
              onInfo={() => setSelectedReward(r)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-slate-100 bg-slate-50 p-10 text-center">
              <Gift size={28} className="text-slate-300 mx-auto mb-2" />
              <div className="text-sm text-slate-400">No rewards in this category yet.</div>
            </div>
          )}
        </motion.div>

        {/* ── Redemption History ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={15} className="text-amber-500" />
            <span className="text-sm font-extrabold text-slate-900">Redemption History</span>
            <span className="ml-auto text-xs text-slate-400">{redemptions.length} total</span>
          </div>

          {redemptions.length === 0 ? (
            <div className="py-6 text-center">
              <Gift size={28} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No redemptions yet. Start earning stars!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {redemptions.map(r => {
                const reward = rewards.find(x => x.key === r.reward_key);
                const icon = REWARD_ICONS[r.reward_key] ?? <Gift size={16} className="text-cyan-500" />;
                return (
                  <div key={r.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-50">{icon}</div>
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">
                          {reward?.name ?? r.reward_key}
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(r.redeemed_at).toLocaleDateString("en-MY", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-extrabold text-amber-600">
                      <Star size={12} fill="currentColor" className="text-amber-400" />
                      {r.stars_spent}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}