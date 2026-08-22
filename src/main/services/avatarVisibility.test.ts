import { describe, expect, it } from "vitest";
import type { AppSettings, TimerSnapshot } from "../../shared/types";
import { resolveAvatarMode } from "./avatarVisibility";

const settings = { stealthFocusEnabled: true } as AppSettings;
const focus = { phase: "focus", activeSessionId: "focus-1" } as TimerSnapshot;

describe("avatar visibility", () => {
  it("uses the mini timer during an unrevealed stealth focus", () => {
    expect(resolveAvatarMode(settings, focus, null)).toBe("mini");
  });

  it("keeps a tray-revealed pet visible for the current focus session", () => {
    expect(resolveAvatarMode(settings, focus, "focus-1")).toBe("full");
    expect(resolveAvatarMode(settings, { ...focus, activeSessionId: "focus-2" }, "focus-1")).toBe("mini");
  });

  it("shows the full pet outside focus", () => {
    expect(resolveAvatarMode(settings, { ...focus, phase: "short_break" }, null)).toBe("full");
  });
});
