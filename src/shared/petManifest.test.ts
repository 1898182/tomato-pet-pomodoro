import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validatePetManifest } from "./petManifest";

describe("pet manifest", () => {
  it("validates the bundled tomato manifest", () => {
    const manifestPath = path.resolve(process.cwd(), "public/assets/pets/tomato/pet.json");
    const manifest = validatePetManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
    expect(manifest.id).toBe("tomato");
    expect(Object.keys(manifest.states)).toEqual(["sleeping", "working", "playing"]);
    expect(manifest.states.playing.frames).toHaveLength(2);
  });

  it("rejects manifests without required state frames", () => {
    expect(() => validatePetManifest({ id: "bad", name: "Bad", version: 1, defaultScale: 1, spriteSheet: "/x.png", states: {}, slots: [] })).toThrow();
  });
});
