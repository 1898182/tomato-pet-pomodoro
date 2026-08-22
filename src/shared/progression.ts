export const MAX_LEVEL = 50;
export const XP_DAILY_CAP = 3_600;
export const SEED_DAILY_CAP = 360;

export function getLevelThreshold(level: number) {
  const safeLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  if (safeLevel === 1) {
    return 0;
  }
  return Math.round((300 * Math.pow(safeLevel - 1, 1.4)) / 10) * 10;
}

export function getLevelForXp(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp));
  for (let level = MAX_LEVEL; level >= 1; level -= 1) {
    if (safeXp >= getLevelThreshold(level)) {
      return level;
    }
  }
  return 1;
}

export function getStreakMultiplier(streakDays: number) {
  if (streakDays >= 7) return 1.5;
  if (streakDays >= 3) return 1.25;
  return 1;
}

export function applyCappedAward(baseAmount: number, multiplier: number, earnedToday: number, cap: number) {
  const calculated = Math.max(0, Math.floor(baseAmount * multiplier));
  return Math.min(calculated, Math.max(0, cap - earnedToday));
}
