import { describe, expect, it } from "vitest";
import { getTodayFocusSeconds, isTimerStoppable, parseDurationInputValue } from "./SettingsApp";
import type { AnalyticsOverview, TimerSnapshot } from "../../shared/types";

describe("custom preset duration input", () => {
  it("captures typed and stepped numeric values as primitives", () => {
    expect(parseDurationInputValue("45")).toBe(45);
    expect(parseDurationInputValue("6")).toBe(6);
  });

  it("keeps an empty draft recoverable as an invalid value", () => {
    expect(parseDurationInputValue("")).toBe(0);
  });
});

describe("settings timer actions", () => {
  it("keeps stop available while the timer is paused", () => {
    expect(isTimerStoppable("paused")).toBe(true);
    expect(isTimerStoppable("focus")).toBe(true);
    expect(isTimerStoppable("short_break")).toBe(true);
    expect(isTimerStoppable("long_break")).toBe(true);
    expect(isTimerStoppable("idle")).toBe(false);
  });
});

describe("today's focus time", () => {
  const timer = { phase: "focus", accumulatedFocusSeconds: 15 * 60 } as TimerSnapshot;
  const analytics: AnalyticsOverview = { weekFocusedSeconds: 40 * 60, weekCompletedSessions: 1, days: [
    { date: "2026-08-29", focusedSeconds: 15 * 60, completedSessions: 1 },
    { date: "2026-08-30", focusedSeconds: 25 * 60, completedSessions: 1 },
    { date: "2026-08-31", focusedSeconds: 0, completedSessions: 0 }
  ] };

  it("combines today's completed sessions with the active focus segment", () => {
    expect(getTodayFocusSeconds(analytics, timer, new Date("2026-08-30T12:00:00"))).toBe(40 * 60);
  });

  it("does not include elapsed timer time during a break", () => {
    expect(getTodayFocusSeconds(analytics, { ...timer, phase: "short_break" }, new Date("2026-08-30T12:00:00"))).toBe(25 * 60);
  });
});
