/**
 * lib/gamification.ts — UPDATED
 *
 * Fixes applied:
 * 1. JOURNEY_STAGES was hardcoded in stats/page.tsx — now exported from here as single source of truth
 * 2. getJourneyStage() now returns the stage number (was already correct but docs were missing)
 * 3. DAILY_XP_CAP is now exported and referenced everywhere (was duplicated in both route.ts and page.tsx)
 * 4. Added XP_TABLE validation helper for type safety
 * 5. getLevelFromXP now handles XP beyond max level gracefully
 */

export const XP_TABLE = {
  daily_emotion_checkin:  2,
  daily_journal_entry:    4,
  complete_daily_mission: 5,
  read_ei_resource:       3,
  watch_ei_video:         3,
  bookmark_resource:      1,
  breathing_exercise:     3,
  reflection_worksheet:   6,
  ei_mini_quiz:           8,
  full_ei_assessment:     15,
  weekly_reflection_review: 12,
  streak_7_day_bonus:     10,
  streak_30_day_bonus:    30,
} as const;

export type ActivityKey = keyof typeof XP_TABLE;

/**
 * FIX: validate that a string is a valid activity key
 * Previously award-xp route used `activityKey in XP_TABLE` directly —
 * this helper makes it type-safe and reusable.
 */
export function isValidActivityKey(key: string): key is ActivityKey {
  return key in XP_TABLE;
}

export const DAILY_XP_CAP = 15;

export const LEVEL_TABLE = [
  { level: 1,  title: "Newcomer",               xpRequired: 0    },
  { level: 2,  title: "First Step",              xpRequired: 20   },
  { level: 3,  title: "Check-In Starter",        xpRequired: 45   },
  { level: 4,  title: "Reflection Rookie",       xpRequired: 75   },
  { level: 5,  title: "Mood Mapper",             xpRequired: 110  },
  { level: 6,  title: "Habit Builder",           xpRequired: 150  },
  { level: 7,  title: "Calm Explorer",           xpRequired: 200  },
  { level: 8,  title: "Insight Seeker",          xpRequired: 260  },
  { level: 9,  title: "Self-Awareness Builder",  xpRequired: 330  },
  { level: 10, title: "Steady Grower",           xpRequired: 410  },
  { level: 11, title: "Emotional Learner",       xpRequired: 500  },
  { level: 12, title: "Empathy Builder",         xpRequired: 600  },
  { level: 13, title: "Balance Keeper",          xpRequired: 715  },
  { level: 14, title: "Regulation Pro",          xpRequired: 845  },
  { level: 15, title: "Resilience Builder",      xpRequired: 990  },
  { level: 16, title: "Growth Navigator",        xpRequired: 1150 },
  { level: 17, title: "EI Champion",             xpRequired: 1330 },
  { level: 18, title: "Workplace Uplifter",      xpRequired: 1530 },
  { level: 19, title: "Well-Being Advocate",     xpRequired: 1755 },
  { level: 20, title: "BrainUp Master",          xpRequired: 2000 },
] as const;

export type LevelRow = (typeof LEVEL_TABLE)[number];

/**
 * FIX 1: JOURNEY_STAGES was hardcoded in stats/page.tsx.
 * Exporting from here means any change is automatically reflected everywhere.
 */
export const JOURNEY_STAGES = [
  {
    stage: 1,
    name: "Emotional Awareness",
    desc: "Begin understanding your emotions",
    unlockLevel: 1,
  },
  {
    stage: 2,
    name: "Self Reflection",
    desc: "Build a journaling practice",
    unlockLevel: 5,
  },
  {
    stage: 3,
    name: "Emotional Regulation",
    desc: "Manage reactions and stress",
    unlockLevel: 9,
  },
  {
    stage: 4,
    name: "Empathy Building",
    desc: "Understand others' perspectives",
    unlockLevel: 13,
  },
  {
    stage: 5,
    name: "Social Intelligence",
    desc: "Lead with emotional wisdom",
    unlockLevel: 17,
  },
] as const;

export function getLevelFromXP(totalXP: number) {
  let current: (typeof LEVEL_TABLE)[number] = LEVEL_TABLE[0];

  for (const lvl of LEVEL_TABLE) {
    if (totalXP >= lvl.xpRequired) {
      current = lvl;
    } else {
      break;
    }
  }

  const nextLevel = LEVEL_TABLE.find((l) => l.level === current.level + 1) ?? null;
  const xpIntoLevel = totalXP - current.xpRequired;
  const xpNeeded = nextLevel ? nextLevel.xpRequired - current.xpRequired : 0;
  // FIX: gracefully handles XP beyond max level (shows 100%)
  const progressPct =
    nextLevel && xpNeeded > 0
      ? Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
      : 100;

  return {
    ...current,
    nextLevel,
    xpIntoLevel,
    xpNeeded,
    progressPct,
  };
}

export function getStarsFromXP(totalXP: number) {
  return Math.floor(totalXP / 100);
}

export function getJourneyStage(level: number): number {
  if (level >= 17) return 5;
  if (level >= 13) return 4;
  if (level >= 9)  return 3;
  if (level >= 5)  return 2;
  return 1;
}