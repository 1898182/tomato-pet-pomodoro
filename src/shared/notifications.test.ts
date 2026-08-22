import { describe, expect, it } from "vitest";
import { formatPhaseCompleteNotification } from "./notifications";

describe("phase completion notifications", () => {
  it("describes automatically starting breaks naturally", () => {
    expect(formatPhaseCompleteNotification("short_break", true)).toBe("Nice work. Your short break is starting now.");
    expect(formatPhaseCompleteNotification("long_break", true)).toBe("Nice work. Your long break is starting now.");
  });

  it("describes manually started focus sessions", () => {
    expect(formatPhaseCompleteNotification("focus", false)).toBe("Break complete. Your focus session is ready when you are.");
  });
});
