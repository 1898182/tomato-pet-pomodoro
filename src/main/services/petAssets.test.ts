import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPetAssetBundle } from "./petAssets";

describe("loadPetAssetBundle", () => {
  it("loads the bundled tomato manifest and sprite sheet", () => {
    const assetRoot = path.join(process.cwd(), "public", "assets");
    const bundle = loadPetAssetBundle(assetRoot, "tomato");

    expect(bundle.manifest.id).toBe("tomato");
    expect(bundle.spriteSheetDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects pet ids that could escape the pet directory", () => {
    const assetRoot = path.join(process.cwd(), "public", "assets");

    expect(() => loadPetAssetBundle(assetRoot, "../tomato")).toThrow("Invalid pet id");
  });
});
