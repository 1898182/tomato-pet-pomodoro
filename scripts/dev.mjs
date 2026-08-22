import { spawn } from "node:child_process";
import { build } from "vite";
import { createServer } from "vite";
import electronPath from "electron";

const electronArgs = ["."];

async function compileElectron() {
  await new Promise((resolve, reject) => {
    const tsc = spawn("pnpm", ["exec", "tsc", "-p", "tsconfig.electron.json"], {
      stdio: "inherit",
      shell: true
    });
    tsc.on("exit", (code) => (code === 0 ? resolve(undefined) : reject(new Error(`tsc exited ${code}`))));
  });
}

async function main() {
  await compileElectron();
  await build({ configFile: "vite.config.ts", mode: "development" });

  const server = await createServer({ configFile: "vite.config.ts" });
  await server.listen();
  const url = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:5173/";

  const child = spawn(electronPath, electronArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: url
    }
  });

  child.on("exit", async (code) => {
    await server.close();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
