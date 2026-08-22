import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["dist-electron", "dist-renderer"];

for (const target of targets) {
  const absolute = path.resolve(root, target);
  if (!absolute.startsWith(root)) {
    throw new Error(`Refusing to clean outside workspace: ${absolute}`);
  }
  fs.rmSync(absolute, { recursive: true, force: true });
}
