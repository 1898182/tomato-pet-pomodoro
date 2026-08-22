import { describe, expect, it } from "vitest";
import { applyCappedAward, getLevelForXp, getLevelThreshold, getStreakMultiplier, MAX_LEVEL } from "./progression";

describe("progression", () => {
  it("uses the rounded polynomial level curve", () => {
    expect(getLevelThreshold(1)).toBe(0);
    expect(getLevelThreshold(2)).toBe(300);
    expect(getLevelThreshold(3)).toBe(790);
    expect(getLevelForXp(789)).toBe(2);
    expect(getLevelForXp(790)).toBe(3);
  });

  it("caps levels and awards", () => {
    expect(getLevelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
    expect(applyCappedAward(50, 1.5, 3_590, 3_600)).toBe(10);
    expect(applyCappedAward(50, 1, 3_600, 3_600)).toBe(0);
  });

  it("applies streak tiers", () => {
    expect(getStreakMultiplier(2)).toBe(1);
    expect(getStreakMultiplier(3)).toBe(1.25);
    expect(getStreakMultiplier(7)).toBe(1.5);
  });
});
