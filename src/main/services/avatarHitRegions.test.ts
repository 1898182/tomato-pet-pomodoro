import { describe, expect, it } from "vitest";
import { isPointInInteractiveRegions, normalizeInteractiveRegions } from "./avatarHitRegions";

describe("avatar hit regions", () => {
  it("only treats points inside a reported surface as interactive", () => {
    const regions = [{ x: 20, y: 30, width: 100, height: 80 }];

    expect(isPointInInteractiveRegions({ x: 20, y: 30 }, regions)).toBe(true);
    expect(isPointInInteractiveRegions({ x: 119, y: 109 }, regions)).toBe(true);
    expect(isPointInInteractiveRegions({ x: 120, y: 110 }, regions)).toBe(false);
    expect(isPointInInteractiveRegions({ x: 10, y: 40 }, regions)).toBe(false);
  });

  it("discards malformed and non-positive renderer input", () => {
    expect(normalizeInteractiveRegions([
      { x: 1, y: 2, width: 3, height: 4 },
      { x: 0, y: 0, width: 0, height: 4 },
      { x: Number.NaN, y: 0, width: 4, height: 4 },
      null
    ])).toEqual([{ x: 1, y: 2, width: 3, height: 4 }]);
  });
});
