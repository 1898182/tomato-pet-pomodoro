import type { CatalogItem } from "./types";

type CatalogManifest = { version: number; items: Array<Omit<CatalogItem, "unlocked">> };
const TIERS = new Set(["common", "uncommon", "rare", "epic", "consumable"]);
const TYPES = new Set(["wearable", "desk", "audio", "animation", "consumable"]);

export function validateCatalogManifest(value: unknown): CatalogManifest {
  if (!value || typeof value !== "object") throw new Error("Item catalog must be an object.");
  const manifest = value as Partial<CatalogManifest>;
  if (!Number.isInteger(manifest.version) || !Array.isArray(manifest.items)) throw new Error("Item catalog version and items are required.");
  const ids = new Set<string>();
  for (const item of manifest.items) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || ids.has(item.id)) throw new Error("Catalog item IDs must be unique non-empty strings.");
    if (typeof item.name !== "string" || typeof item.description !== "string") throw new Error(`Catalog item ${item.id} needs a name and description.`);
    if (!TIERS.has(item.tier) || !TYPES.has(item.type)) throw new Error(`Catalog item ${item.id} has an invalid tier or type.`);
    if (!Number.isInteger(item.priceSeeds) || item.priceSeeds <= 0 || !Number.isInteger(item.requiredLevel) || item.requiredLevel < 1 || item.requiredLevel > 50) throw new Error(`Catalog item ${item.id} has invalid economy values.`);
    ids.add(item.id);
  }
  return manifest as CatalogManifest;
}

export function unlockCatalog(manifest: CatalogManifest, level: number): CatalogItem[] {
  return manifest.items.map((item) => ({ ...item, unlocked: level >= item.requiredLevel }));
}
