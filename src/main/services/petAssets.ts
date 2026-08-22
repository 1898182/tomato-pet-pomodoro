import fs from "node:fs";
import path from "node:path";
import type { PetAssetBundle } from "../../shared/petManifest";
import { validatePetManifest } from "../../shared/petManifest";

const PET_ID_PATTERN = /^[a-z0-9-]+$/;

export function loadPetAssetBundle(assetRoot: string, petId: string): PetAssetBundle {
  if (!PET_ID_PATTERN.test(petId)) {
    throw new Error(`Invalid pet id: ${petId}`);
  }

  const manifestPath = path.join(assetRoot, "pets", petId, "pet.json");
  const manifest = validatePetManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  const spriteSheetPath = resolveBundledAssetPath(assetRoot, manifest.spriteSheet);
  const spriteSheet = fs.readFileSync(spriteSheetPath);

  return {
    manifest,
    spriteSheetDataUrl: `data:image/png;base64,${spriteSheet.toString("base64")}`
  };
}

function resolveBundledAssetPath(assetRoot: string, assetUrl: string) {
  const relativePath = assetUrl.replace(/^\/?assets\//, "");
  const resolvedRoot = path.resolve(assetRoot);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const rootPrefix = `${resolvedRoot}${path.sep}`;

  if (!resolvedPath.startsWith(rootPrefix) || path.extname(resolvedPath).toLowerCase() !== ".png") {
    throw new Error(`Pet sprite sheet must be a PNG inside the bundled asset directory: ${assetUrl}`);
  }

  return resolvedPath;
}
