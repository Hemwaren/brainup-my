/**
 * lib/badgeDefinitions.ts
 *
 * Client-safe badge metadata — NO server imports, NO supabaseAdmin.
 * Import this in client components (stats page, etc.)
 *
 * lib/badges.ts still exists for server-side badge awarding logic.
 * It can import from here if needed.
 */

export type BadgeRarity = "Common" | "Rare" | "Legendary";

export type BadgeDefinition = {
  key: string;
  label: string;
  cond: string;
  rarity: BadgeRarity;
  icon: string; // lucide icon name — rendered in UI
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { key: "first_step",        label: "First Step",          cond: "Complete first emotion check-in",       rarity: "Common",    icon: "footprints"   },
  { key: "pen_to_paper",      label: "Pen to Paper",         cond: "Write first journal entry",             rarity: "Common",    icon: "pencil-line"  },
  { key: "3_day_momentum",    label: "3-Day Momentum",       cond: "Maintain a 3-day activity streak",      rarity: "Common",    icon: "zap"          },
  { key: "weekly_warrior",    label: "Weekly Warrior",       cond: "Maintain a 7-day streak",               rarity: "Rare",      icon: "shield"       },
  { key: "emotion_explorer",  label: "Emotion Explorer",     cond: "Log emotions on 10 different days",     rarity: "Rare",      icon: "telescope"    },
  { key: "reflection_spark",  label: "Reflection Spark",     cond: "Complete 5 journal entries",            rarity: "Common",    icon: "sparkles"     },
  { key: "reflection_master", label: "Reflection Master",    cond: "Complete 20 journal entries",           rarity: "Rare",      icon: "book-open"    },
  { key: "insight_hunter",    label: "Insight Hunter",       cond: "Finish first EI assessment",            rarity: "Rare",      icon: "target"       },
  { key: "growth_tracker",    label: "Growth Tracker",       cond: "Complete 3 EI assessments",             rarity: "Rare",      icon: "trending-up"  },
  { key: "resource_rover",    label: "Resource Rover",       cond: "Read or watch 5 EI resources",          rarity: "Common",    icon: "library"      },
  { key: "learning_lover",    label: "Learning Lover",       cond: "Read or watch 15 EI resources",        rarity: "Rare",      icon: "brain"        },
  { key: "consistency_seed",  label: "Consistency Seed",     cond: "Stay active for 14 days",               rarity: "Rare",      icon: "leaf"         },
  { key: "habit_guardian",    label: "Habit Guardian",       cond: "Stay active for 30 days",               rarity: "Legendary", icon: "shield-check" },
  { key: "level_climber",     label: "Level Climber",        cond: "Reach Level 10",                        rarity: "Rare",      icon: "mountain"     },
  { key: "brainup_legend",    label: "BrainUp Legend",       cond: "Reach Level 20",                       rarity: "Legendary", icon: "crown"        },
];