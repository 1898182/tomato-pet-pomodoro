import { describe, expect, it } from "vitest";
import { isTimerStoppable, parseDurationInputValue } from "./SettingsApp";

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
