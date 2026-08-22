import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isTrustedRendererUrl, validateDevServerUrl } from "./rendererSecurity";

describe("renderer security", () => {
  const entryPath = path.resolve("dist-renderer", "index.html");

  it("accepts only the configured loopback development origin and path", () => {
    const policy = {
      devServerUrl: validateDevServerUrl("http://127.0.0.1:5173/"),
      productionEntryPath: entryPath
    };

    expect(isTrustedRendererUrl("http://127.0.0.1:5173/?surface=avatar", policy)).toBe(true);
    expect(isTrustedRendererUrl("http://127.0.0.1:5174/?surface=avatar", policy)).toBe(false);
    expect(isTrustedRendererUrl("https://example.com/?surface=avatar", policy)).toBe(false);
  });

  it("rejects non-loopback development servers", () => {
    expect(() => validateDevServerUrl("https://example.com/")).toThrow(/127\.0\.0\.1/);
    expect(() => validateDevServerUrl("http://localhost:5173/")).toThrow(/127\.0\.0\.1/);
  });

  it("accepts only the packaged renderer file", () => {
    const policy = { productionEntryPath: entryPath };
    const trustedUrl = `${pathToFileURL(entryPath).toString()}?surface=settings`;

    expect(isTrustedRendererUrl(trustedUrl, policy)).toBe(true);
    expect(isTrustedRendererUrl(pathToFileURL(path.resolve("other.html")).toString(), policy)).toBe(false);
    expect(isTrustedRendererUrl("https://example.com/", policy)).toBe(false);
  });
});
