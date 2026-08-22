import { describe, expect, it } from "vitest";
import { unlockCatalog, validateCatalogManifest } from "./catalog";

describe("catalog", () => {
  const manifest = { version: 1, items: [{ id: "hat", name: "Hat", description: "A hat", tier: "rare", type: "wearable", slot: "head", priceSeeds: 600, requiredLevel: 10, assetPath: null }] };
  it("validates and computes level eligibility", () => {
    const valid = validateCatalogManifest(manifest);
    expect(unlockCatalog(valid, 9)[0].unlocked).toBe(false);
    expect(unlockCatalog(valid, 10)[0].unlocked).toBe(true);
  });
  it("rejects duplicate IDs", () => {
    expect(() => validateCatalogManifest({ version: 1, items: [manifest.items[0], manifest.items[0]] })).toThrow(/unique/);
  });
});
