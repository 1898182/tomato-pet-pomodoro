import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getRendererContentSecurityPolicy } from "../../shared/contentSecurityPolicy";

describe("avatar content security policy support", () => {
  it("loads Pixi's static CSP implementation without enabling unsafe eval", () => {
    const avatarSource = fs.readFileSync(path.join(process.cwd(), "src", "renderer", "surfaces", "AvatarApp.tsx"), "utf8");
    const productionPolicy = getRendererContentSecurityPolicy(false);

    expect(avatarSource).toContain('import "pixi.js/unsafe-eval";');
    expect(productionPolicy).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(productionPolicy).toMatch(/connect-src[^;]*data:[^;]*blob:/);
    expect(productionPolicy).not.toContain("127.0.0.1");
    expect(getRendererContentSecurityPolicy(true)).toContain("ws://127.0.0.1:*");
  });
});
