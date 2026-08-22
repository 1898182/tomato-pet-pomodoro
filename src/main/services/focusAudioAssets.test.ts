import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("focus audio assets", () => {
  it.each([
    ["brown-noise.wav", 0.12],
    ["gentle-rain.wav", 0.08]
  ])("ships an audible %s loop", (fileName, minimumRms) => {
    const buffer = fs.readFileSync(path.join(process.cwd(), "public", "assets", "audio", fileName));

    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(calculatePcm16Rms(buffer)).toBeGreaterThanOrEqual(minimumRms);
  });
});

function calculatePcm16Rms(wav: Buffer) {
  let sumSquares = 0;
  let sampleCount = 0;
  for (let offset = 44; offset + 1 < wav.length; offset += 2) {
    const sample = wav.readInt16LE(offset) / 32_768;
    sumSquares += sample * sample;
    sampleCount += 1;
  }
  return Math.sqrt(sumSquares / sampleCount);
}
