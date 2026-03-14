"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Star, Gift } from "lucide-react";

type RedemptionRow = {
  id: string;
  reward_key: string;
  stars_spent: number;
  redeemed_at: string;
};

const REWARDS = [
  { key: "grab5", name: "RM5 Grab voucher", cost: 50 },
  { key: "grabfood5", name: "RM5 GrabFood voucher", cost: 50 },
  { key: "zus5", name: "RM5 ZUS Coffee voucher", cost: 45 },
  { key: "tng10", name: "RM10 Touch n Go reward", cost: 90 },
  { key: "shopee10", name: "RM10 Shopee voucher", cost: 90 },
  { key: "lazada10", name: "RM10 Lazada voucher", cost: 90 },
  { key: "wellness15", name: "RM15 wellness gift card", cost: 130 },
  { key: "profile_theme", name: "Premium profile theme", cost: 25 },
  { key: "avatar_frame", name: "Exclusive avatar frame", cost: 20 },
  { key: "wallpaper", name: "Motivational wallpaper pack", cost: 15 },
];

export default function RewardsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState(0);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const uid = session.user.id;

      const [{ data: gData }, { data: rData }] = await Promise.all([
        supabase.from("user_gamification").select("stars").eq("user_id", uid).maybeSingle(),
        supabase.from("reward_redemptions")
          .select("id, reward_key, stars_spent, redeemed_at")
          .eq("user_id", uid)
          .order("redeemed_at", { ascending: false }),
      ]);

      if (!alive) return;
      setStars(gData?.stars ?? 0);
      setRedemptions(rData ?? []);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [router]);

  async function redeemReward(rewardKey: string, rewardName: string, cost: number) {
    if (stars < cost || redeeming) return;
    setRedeeming(rewardKey);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const uid = session.user.id;

    // Deduct stars
    const { error: updateError } = await supabase
      .from("user_gamification")
      .update({ stars: stars - cost, updated_at: new Date().toISOString() })
      .eq("user_id", uid);

    if (updateError) {
      showToast("Something went wrong. Try again.");
      setRedeeming(null);
      return;
    }

    // Log redemption
    const { data: newRedemption, error: insertError } = await supabase
      .from("reward_redemptions")
      .insert({ user_id: uid, reward_key: rewardKey, stars_spent: cost })
      .select()
      .single();

    if (insertError) {
      showToast("Something went wrong. Try again.");
      setRedeeming(null);
      return;
    }

    setStars((prev) => prev - cost);
    setRedemptions((prev) => [newRedemption, ...prev]);
    showToast(`${rewardName} redeemed`);
    setRedeeming(null);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading rewards...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-slate-900">Rewards</h1>
        <p className="mt-1 text-sm text-slate-600">Spend your stars on real rewards.</p>
      </div>

      {/* Star balance */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Star size={20} className="text-amber-500" fill="currentColor" />
              <div className="text-3xl font-extrabold text-slate-900">{stars}</div>
              <div className="text-sm font-bold text-slate-500">Stars</div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Every 100 XP earned = 1 Star. Level-up = +2 Stars.
            </div>
          </div>
        </div>
      </section>

      {/* Reward store */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Gift size={16} className="text-slate-500" />
          <div className="text-sm font-extrabold text-slate-900">Reward Store</div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {REWARDS.map((r) => {
            const canAfford = stars >= r.cost;
            const isRedeeming = redeeming === r.key;
            const alreadyRedeemed = redemptions.some((x) => x.reward_key === r.key);

            return (
              <div
                key={r.key}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="text-sm font-extrabold text-slate-900">{r.name}</div>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                  <Star size={12} className="text-amber-500" fill="currentColor" />
                  {r.cost} Stars
                </div>

                <button
                  type="button"
                  disabled={!canAfford || !!redeeming || alreadyRedeemed}
                  onClick={() => redeemReward(r.key, r.name, r.cost)}
                  className={[
                    "mt-3 w-full rounded-xl px-4 py-2 text-xs font-extrabold transition",
                    alreadyRedeemed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : canAfford && !redeeming
                      ? "bg-slate-900 text-white hover:opacity-95"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed",
                  ].join(" ")}
                >
                  {isRedeeming ? "Processing..." : alreadyRedeemed ? "Redeemed" : !canAfford ? `Need ${r.cost - stars} more stars` : "Redeem"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Redemption history */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-extrabold text-slate-900">Redemption History</div>

        {redemptions.length === 0 ? (
          <p className="text-sm text-slate-500">No redemptions yet.</p>
        ) : (
          <div className="space-y-2">
            {redemptions.map((r) => {
              const reward = REWARDS.find((x) => x.key === r.reward_key);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="text-sm font-extrabold text-slate-900">
                    {reward?.name ?? r.reward_key}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-bold">
                      <Star size={11} className="text-amber-500" fill="currentColor" />
                      {r.stars_spent}
                    </span>
                    <span>{new Date(r.redeemed_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}