import { describe, expect, it } from "vitest";
import { calculateFocusChainMultiplier, calculateFocusXp, calculateMultiplier } from "./xp";

describe("XP calculation", () => {
  it("awards XP per completed focused minute", () => {
    expect(calculateFocusXp({ focusedSeconds: 119 })).toMatchObject({
      completedMinutes: 1,
      baseXp: 10,
      finalXp: 10
    });
  });

  it("adds a multiplier for longer uninterrupted focus", () => {
    expect(calculateMultiplier(24 * 60 + 59)).toBe(1);
    expect(calculateMultiplier(25 * 60)).toBe(1.25);
    expect(calculateFocusXp({ focusedSeconds: 25 * 60 }).finalXp).toBe(250);
  });

  it("advances the focus chain after each completed 25-minute block", () => {
    expect(calculateFocusChainMultiplier(0)).toBe(1);
    expect(calculateFocusChainMultiplier(24)).toBe(1);
    expect(calculateFocusChainMultiplier(25)).toBe(1.25);
    expect(calculateFocusChainMultiplier(50)).toBe(1.5);
    expect(calculateFocusChainMultiplier(75)).toBe(1.75);
    expect(calculateFocusChainMultiplier(100)).toBe(2);
  });

  it("caps the uninterrupted multiplier", () => {
    expect(calculateMultiplier(200 * 60)).toBe(2);
  });
});
