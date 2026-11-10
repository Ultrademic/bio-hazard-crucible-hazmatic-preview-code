export interface PilotStanding {
  rank: number;
  title: string;
  xp: number;
  floorXp: number;
  nextXp: number | null;
  nextTitle: string | null;
  progress: number;
  damageBonus: number;
}

const RANKS: Array<{ rank: number; title: string; xp: number }> = [
  { rank: 1, title: 'Spore Cadet', xp: 0 },
  { rank: 2, title: 'Chitin Wing', xp: 500 },
  { rank: 3, title: 'Hive Breaker', xp: 1400 },
  { rank: 4, title: 'Carapace Ace', xp: 2800 },
  { rank: 5, title: 'Brood Hunter', xp: 5000 },
  { rank: 6, title: 'Sector Warden', xp: 8000 },
  { rank: 7, title: 'Crucible Pilot', xp: 12000 },
  { rank: 8, title: 'Avaron Vanguard', xp: 17000 }
];

/** Weapon damage added for each rank above Spore Cadet. */
export const RANK_DAMAGE_STEP = 0.04;

export function rankFromXp(xp: number): PilotStanding {
  const safe = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  let current = RANKS[0];
  for (const entry of RANKS) {
    if (safe >= entry.xp) current = entry;
  }
  const next = RANKS.find(entry => entry.rank === current.rank + 1) ?? null;
  const span = next ? next.xp - current.xp : 1;
  const progress = next ? Math.max(0, Math.min(1, (safe - current.xp) / span)) : 1;
  return {
    rank: current.rank,
    title: current.title,
    xp: safe,
    floorXp: current.xp,
    nextXp: next ? next.xp : null,
    nextTitle: next ? next.title : null,
    progress,
    damageBonus: (current.rank - 1) * RANK_DAMAGE_STEP
  };
}

export function xpForRun(score: number, stage: number, victory: boolean, biomatter: number): number {
  const safeScore = Math.max(0, Math.floor(score));
  const safeStage = Math.max(1, Math.floor(stage));
  const safeMatter = Math.max(0, Math.floor(biomatter));
  return Math.floor(safeScore / 80) + safeMatter + safeStage * 150 + (victory ? 700 : 0);
}
