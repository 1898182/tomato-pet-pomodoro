import { describe, expect, it } from "vitest";
import { validateSettingsUpdate } from "./settings";

describe("settings validation", () => {
  it("accepts a valid partial settings update", () => {
    expect(validateSettingsUpdate({ focusAudioEnabled: true, focusAudioVolume: 0.65 })).toEqual({
      focusAudioEnabled: true,
      focusAudioVolume: 0.65
    });
  });

  it.each([
    [{ launchAtStartup: "yes" }, /launchAtStartup must be a boolean/],
    [{ focusAudioTrack: "lofi" }, /track is invalid/],
    [{ focusAudioVolume: Number.NaN }, /volume must be between/],
    [{ focusAudioVolume: 2 }, /volume must be between/],
    [{ xpPerMinute: 1000 }, /Unknown setting/]
  ])("rejects invalid or unsupported settings", (value, message) => {
    expect(() => validateSettingsUpdate(value)).toThrow(message);
  });
});
