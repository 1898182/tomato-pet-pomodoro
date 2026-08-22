import { describe, expect, it } from "vitest";
import { clampToWorkArea, getBottomRightBounds } from "./windowBounds";

describe("window work-area bounds", () => {
  const workArea = { x: 100, y: 50, width: 1_200, height: 800 };

  it("clamps windows that would be outside any edge", () => {
    expect(clampToWorkArea(-200, 1_000, 280, 280, workArea)).toEqual({ x: 100, y: 570 });
    expect(clampToWorkArea(1_500, -100, 280, 280, workArea)).toEqual({ x: 1_020, y: 50 });
  });

  it("anchors an oversized window to the work area's top-left", () => {
    expect(clampToWorkArea(400, 300, 1_500, 900, workArea)).toEqual({ x: 100, y: 50 });
  });

  it("positions the mini timer at the work area's bottom-right inset", () => {
    expect(getBottomRightBounds(178, 48, workArea)).toEqual({
      x: 1_110,
      y: 790,
      width: 178,
      height: 48
    });
  });
});
