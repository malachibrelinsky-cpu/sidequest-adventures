// Streak + badge helpers — purely derived from quest_completions.
// A streak counts consecutive completions where each is within 72h of the previous.
// The "current" streak is only alive if the most recent completion is within 72h of now.

export const STREAK_WINDOW_MS = 72 * 60 * 60 * 1000;

export type CompletionRow = {
  created_at: string;
  difficulty?: string;
  points?: number;
};

export type StreakInfo = {
  /** Number of completions in the active streak (0 if expired). */
  count: number;
  /** ms remaining before the streak expires (0 if already expired or none). */
  msRemaining: number;
  /** Timestamp the streak will expire at (null if no streak). */
  expiresAt: Date | null;
  /** True if there's an active (non-expired) streak. */
  alive: boolean;
};

/** Compute current streak from a list of completions (any order). */
export function computeStreak(completions: CompletionRow[], now: Date = new Date()): StreakInfo {
  if (!completions.length) return { count: 0, msRemaining: 0, expiresAt: null, alive: false };
  const sorted = [...completions]
    .map((c) => new Date(c.created_at).getTime())
    .sort((a, b) => b - a);
  const latest = sorted[0];
  const expiresAt = latest + STREAK_WINDOW_MS;
  const alive = expiresAt > now.getTime();
  if (!alive) return { count: 0, msRemaining: 0, expiresAt: new Date(expiresAt), alive: false };
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] <= STREAK_WINDOW_MS) count++;
    else break;
  }
  return { count, msRemaining: expiresAt - now.getTime(), expiresAt: new Date(expiresAt), alive: true };
}

/**
 * Streak point multiplier. Every completion past the first adds 5%, capped at 2.0x.
 * E.g. streak of 1 = 1.0x, 5 = 1.20x, 11 = 1.50x, 21+ = 2.00x.
 */
export function streakMultiplier(streakCount: number): number {
  if (streakCount <= 1) return 1;
  return Math.min(2, 1 + (streakCount - 1) * 0.05);
}

/** Format ms as Hh Mm Ss countdown. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ---------- Badges ----------

export type Badge = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** higher = more prestigious */
  tier: number;
};

const RANKS: Badge[] = [
  { id: "rank-novice",     label: "Novice Wanderer",  emoji: "🌱", description: "Earned your first 50 points",   tier: 1 },
  { id: "rank-adventurer", label: "Adventurer",       emoji: "🧭", description: "Reached 250 points",              tier: 2 },
  { id: "rank-trailblazer",label: "Trailblazer",      emoji: "🔥", description: "Reached 1,000 points",            tier: 3 },
  { id: "rank-hero",       label: "Local Hero",       emoji: "🦸", description: "Reached 2,500 points",            tier: 4 },
  { id: "rank-legend",     label: "Sidequest Legend", emoji: "👑", description: "Reached 10,000 points",           tier: 5 },
];

const STREAK_BADGES: Badge[] = [
  { id: "streak-3",  label: "On a Roll",   emoji: "⚡", description: "Maintained a 3-quest streak",  tier: 1 },
  { id: "streak-7",  label: "Hot Streak",  emoji: "🔥", description: "Maintained a 7-quest streak",  tier: 2 },
  { id: "streak-14", label: "Unstoppable", emoji: "💫", description: "Maintained a 14-quest streak", tier: 3 },
  { id: "streak-30", label: "Inferno",     emoji: "☄️", description: "Maintained a 30-quest streak", tier: 4 },
];

const QUEST_BADGES: Badge[] = [
  { id: "first-quest", label: "First Steps",  emoji: "👣", description: "Completed your first quest",   tier: 1 },
  { id: "ten-quests",  label: "Ten Down",     emoji: "🎯", description: "Completed 10 quests",          tier: 2 },
  { id: "fifty-quests",label: "Fifty Strong", emoji: "🏆", description: "Completed 50 quests",          tier: 3 },
  { id: "epic-slayer", label: "Epic Slayer",  emoji: "🐉", description: "Completed an Epic quest",      tier: 3 },
];

export type EarnedBadges = {
  rank: Badge | null;       // current rank (highest tier earned)
  streak: Badge | null;     // best streak badge unlocked
  achievements: Badge[];    // misc quest count / epic
};

export function computeBadges(opts: {
  totalPoints: number;
  completions: CompletionRow[];
  bestStreak?: number;
}): EarnedBadges {
  const { totalPoints, completions } = opts;
  const count = completions.length;
  const hasEpic = completions.some((c) => c.difficulty === "epic");
  const best = opts.bestStreak ?? bestEverStreak(completions);

  const rankThresholds: [number, Badge][] = [
    [50, RANKS[0]], [250, RANKS[1]], [1000, RANKS[2]], [2500, RANKS[3]], [10000, RANKS[4]],
  ];
  let rank: Badge | null = null;
  for (const [pts, b] of rankThresholds) if (totalPoints >= pts) rank = b;

  const streakThresholds: [number, Badge][] = [
    [3, STREAK_BADGES[0]], [7, STREAK_BADGES[1]], [14, STREAK_BADGES[2]], [30, STREAK_BADGES[3]],
  ];
  let streak: Badge | null = null;
  for (const [n, b] of streakThresholds) if (best >= n) streak = b;

  const achievements: Badge[] = [];
  if (count >= 1) achievements.push(QUEST_BADGES[0]);
  if (count >= 10) achievements.push(QUEST_BADGES[1]);
  if (count >= 50) achievements.push(QUEST_BADGES[2]);
  if (hasEpic) achievements.push(QUEST_BADGES[3]);

  return { rank, streak, achievements };
}

/** Best ever streak length found in the completions list. */
export function bestEverStreak(completions: CompletionRow[]): number {
  if (!completions.length) return 0;
  const sorted = completions.map((c) => new Date(c.created_at).getTime()).sort((a, b) => a - b);
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= STREAK_WINDOW_MS) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

export function flatBadges(e: EarnedBadges): Badge[] {
  return [e.rank, e.streak, ...e.achievements].filter((b): b is Badge => !!b);
}
