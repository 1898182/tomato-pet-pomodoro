import { XP_PER_FOCUSED_MINUTE } from "./progressionRules";

export type XpInput = {
  focusedSeconds: number;
};

export type XpResult = {
  completedMinutes: number;
  baseXp: number;
  multiplier: number;
  finalXp: number;
};

export function calculateFocusChainMultiplier(completedFocusMinutes: number): number {
  const bonusSteps = Math.floor(Math.max(0, completedFocusMinutes) / 25);
  return Math.min(2, 1 + bonusSteps * 0.25);
}

export function calculateMultiplier(focusedSeconds: number): number {
  const uninterruptedMinutes = Math.floor(focusedSeconds / 60);
  return calculateFocusChainMultiplier(uninterruptedMinutes);
}

export function calculateFocusXp(input: XpInput): XpResult {
  const completedMinutes = Math.max(0, Math.floor(input.focusedSeconds / 60));
  const baseXp = completedMinutes * XP_PER_FOCUSED_MINUTE;
  const multiplier = calculateMultiplier(input.focusedSeconds);
  return {
    completedMinutes,
    baseXp,
    multiplier,
    finalXp: Array.from({ length: completedMinutes }, (_, index) =>
      Math.floor(XP_PER_FOCUSED_MINUTE * calculateFocusChainMultiplier(index))
    ).reduce((sum, award) => sum + award, 0)
  };
}
