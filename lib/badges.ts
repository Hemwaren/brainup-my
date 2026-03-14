import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const BADGE_DEFINITIONS = [
  { key: "first_step",        unlockCondition: "first_emotion_checkin" },
  { key: "pen_to_paper",      unlockCondition: "first_journal_entry" },
  { key: "3_day_momentum",    unlockCondition: "streak_3" },
  { key: "weekly_warrior",    unlockCondition: "streak_7" },
  { key: "emotion_explorer",  unlockCondition: "emotion_log_10_days" },
  { key: "reflection_spark",  unlockCondition: "journal_entries_5" },
  { key: "reflection_master", unlockCondition: "journal_entries_20" },
  { key: "insight_hunter",    unlockCondition: "assessment_1" },
  { key: "growth_tracker",    unlockCondition: "assessment_3" },
  { key: "resource_rover",    unlockCondition: "resources_5" },
  { key: "learning_lover",    unlockCondition: "resources_15" },
  { key: "consistency_seed",  unlockCondition: "streak_14" },
  { key: "habit_guardian",    unlockCondition: "streak_30" },
  { key: "level_climber",     unlockCondition: "level_10" },
  { key: "brainup_legend",    unlockCondition: "level_20" },
];

type BadgeCheckParams = {
  userId: string;
  currentStreak: number;
  totalXP: number;
  level: number;
};

export async function checkAndAwardBadges({
  userId,
  currentStreak,
  level,
}: BadgeCheckParams) {
  // Count activity types from xp_transactions
  const { data: txData } = await supabaseAdmin
    .from("xp_transactions")
    .select("activity_key")
    .eq("user_id", userId);

  const transactions = txData ?? [];

  const counts = {
    daily_emotion_checkin: transactions.filter(t => t.activity_key === "daily_emotion_checkin").length,
    daily_journal_entry: transactions.filter(t => t.activity_key === "daily_journal_entry").length,
    full_ei_assessment: transactions.filter(t => t.activity_key === "full_ei_assessment").length,
    read_ei_resource: transactions.filter(
      t => t.activity_key === "read_ei_resource" || t.activity_key === "watch_ei_video"
    ).length,
  };

  const badgesToAward: string[] = [];

  if (counts.daily_emotion_checkin >= 1) badgesToAward.push("first_step");
  if (counts.daily_journal_entry >= 1)   badgesToAward.push("pen_to_paper");
  if (currentStreak >= 3)                badgesToAward.push("3_day_momentum");
  if (currentStreak >= 7)                badgesToAward.push("weekly_warrior");
  if (counts.daily_emotion_checkin >= 10) badgesToAward.push("emotion_explorer");
  if (counts.daily_journal_entry >= 5)   badgesToAward.push("reflection_spark");
  if (counts.daily_journal_entry >= 20)  badgesToAward.push("reflection_master");
  if (counts.full_ei_assessment >= 1)    badgesToAward.push("insight_hunter");
  if (counts.full_ei_assessment >= 3)    badgesToAward.push("growth_tracker");
  if (counts.read_ei_resource >= 5)      badgesToAward.push("resource_rover");
  if (counts.read_ei_resource >= 15)     badgesToAward.push("learning_lover");
  if (currentStreak >= 14)               badgesToAward.push("consistency_seed");
  if (currentStreak >= 30)               badgesToAward.push("habit_guardian");
  if (level >= 10)                       badgesToAward.push("level_climber");
  if (level >= 20)                       badgesToAward.push("brainup_legend");

  if (badgesToAward.length === 0) return;

  // Insert all at once, ignore duplicates
  await supabaseAdmin
    .from("user_badges")
    .upsert(
      badgesToAward.map(key => ({
        user_id: userId,
        badge_key: key,
      })),
      { onConflict: "user_id,badge_key", ignoreDuplicates: true }
    );
}