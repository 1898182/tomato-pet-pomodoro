import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("avatar content security policy support", () => {
  it("loads Pixi's static CSP implementation without enabling unsafe eval", () => {
    const avatarSource = fs.readFileSync(path.join(process.cwd(), "src", "renderer", "surfaces", "AvatarApp.tsx"), "utf8");
    const htmlSource = fs.readFileSync(path.join(process.cwd(), "src", "renderer", "index.html"), "utf8");

    expect(avatarSource).toContain('import "pixi.js/unsafe-eval";');
    expect(htmlSource).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(htmlSource).toMatch(/connect-src[^;]*data:[^;]*blob:/);
  });
});
