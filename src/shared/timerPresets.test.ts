import { describe, expect, it } from "vitest";
import type { TimerPreset } from "./types";
import { getNextPhase, getPhaseDurationSeconds, validatePresetDraft } from "./timerPresets";

const preset: TimerPreset = {
  id: "classic",
  name: "Classic",
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  isDefault: true,
  kind: "built_in"
};

describe("timer presets", () => {
  it("maps each phase to its configured duration", () => {
    expect(getPhaseDurationSeconds(preset, "focus")).toBe(1500);
    expect(getPhaseDurationSeconds(preset, "short_break")).toBe(300);
    expect(getPhaseDurationSeconds(preset, "long_break")).toBe(900);
  });

  it("uses a long break at the configured cycle", () => {
    expect(getNextPhase("focus", 3, preset)).toBe("short_break");
    expect(getNextPhase("focus", 4, preset)).toBe("long_break");
    expect(getNextPhase("short_break", 4, preset)).toBe("focus");
  });

  it("rejects custom durations outside progression limits", () => {
    expect(() => validatePresetDraft({ name: "Sprint", focusMinutes: 0, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 })).toThrow();
    expect(validatePresetDraft({ name: " Sprint ", focusMinutes: 45, shortBreakMinutes: 8, longBreakMinutes: 20, longBreakEvery: 3 })).toMatchObject({ name: "Sprint" });
  });

  it("requires a short custom rhythm name", () => {
    expect(() => validatePresetDraft({ name: "", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 })).toThrow(/required/);
    expect(() => validatePresetDraft({ name: "A".repeat(25), focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 })).toThrow(/24/);
  });
});
