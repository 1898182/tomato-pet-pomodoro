import fs from "node:fs";
import path from "node:path";

const sampleRate = 22_050;
const seconds = 12;
const count = sampleRate * seconds;
const output = path.resolve("public/assets/audio");
fs.mkdirSync(output, { recursive: true });

writeWav(path.join(output, "brown-noise.wav"), createBrownNoise());
writeWav(path.join(output, "gentle-rain.wav"), createRain());

function createBrownNoise() {
  const samples = new Float32Array(count);
  let last = 0;
  for (let i = 0; i < count; i += 1) {
    const white = Math.random() * 2 - 1;
    last = Math.max(-1, Math.min(1, (last + 0.018 * white) / 1.018));
    samples[i] = last * 0.72;
  }
  return normalizeVolume(softenLoop(samples), 0.16);
}

function createRain() {
  const samples = new Float32Array(count);
  let filtered = 0;
  const drops = Array.from({ length: 90 }, () => ({ start: Math.floor(Math.random() * count), length: 180 + Math.floor(Math.random() * 900), gain: 0.08 + Math.random() * 0.16 }));
  for (let i = 0; i < count; i += 1) {
    const white = Math.random() * 2 - 1;
    filtered = filtered * 0.72 + white * 0.28;
    let value = filtered * 0.18;
    for (const drop of drops) {
      const elapsed = i - drop.start;
      if (elapsed >= 0 && elapsed < drop.length) value += (Math.random() * 2 - 1) * drop.gain * Math.exp(-elapsed / (drop.length * 0.3));
    }
    samples[i] = Math.max(-1, Math.min(1, value));
  }
  return normalizeVolume(softenLoop(samples), 0.11);
}

function normalizeVolume(samples, targetRms) {
  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  if (rms === 0) return samples;

  const gain = Math.min(targetRms / rms, 0.92 / peak);
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;
  return samples;
}

function softenLoop(samples) {
  const blend = Math.floor(sampleRate * 0.25);
  for (let i = 0; i < blend; i += 1) {
    const mix = i / blend;
    const start = samples[i];
    const endIndex = samples.length - blend + i;
    const end = samples[endIndex];
    const shared = start * mix + end * (1 - mix);
    samples[i] = shared;
    samples[endIndex] = shared;
  }
  return samples;
}

function writeWav(file, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(file, buffer);
}
