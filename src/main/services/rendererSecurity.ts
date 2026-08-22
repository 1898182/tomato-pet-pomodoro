import path from "node:path";
import { fileURLToPath } from "node:url";

export interface RendererLocationPolicy {
  devServerUrl?: string;
  productionEntryPath: string;
}

export function validateDevServerUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("VITE_DEV_SERVER_URL must use http://127.0.0.1.");
  }
  return url.toString();
}

export function isTrustedRendererUrl(value: string, policy: RendererLocationPolicy): boolean {
  try {
    const candidate = new URL(value);
    if (policy.devServerUrl) {
      const expected = new URL(policy.devServerUrl);
      return candidate.origin === expected.origin && candidate.pathname === expected.pathname;
    }

    if (candidate.protocol !== "file:") return false;
    return normalizePath(fileURLToPath(candidate)) === normalizePath(policy.productionEntryPath);
  } catch {
    return false;
  }
}

function normalizePath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
