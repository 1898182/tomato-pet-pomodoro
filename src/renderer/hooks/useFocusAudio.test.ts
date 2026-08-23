import { describe, expect, it } from "vitest";
import { toPlaybackVolume } from "./useFocusAudio";

describe("ambient focus sound volume", () => {
  it("provides fine control at low settings and caps playback below full system volume", () => {
    expect(toPlaybackVolume(0)).toBe(0);
    expect(toPlaybackVolume(0.05)).toBeCloseTo(0.001);
    expect(toPlaybackVolume(0.5)).toBeCloseTo(0.1);
    expect(toPlaybackVolume(1)).toBe(0.4);
  });

  it("clamps values before applying the perceptual curve", () => {
    expect(toPlaybackVolume(-1)).toBe(0);
    expect(toPlaybackVolume(2)).toBe(0.4);
  });
});
