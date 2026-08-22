import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { getRendererContentSecurityPolicy } from "./src/shared/contentSecurityPolicy";

export default defineConfig(({ command }) => ({
  root: path.resolve(__dirname, "src/renderer"),
  base: "./",
  publicDir: path.resolve(__dirname, "public"),
  plugins: [
    react(),
    {
      name: "tomato-renderer-csp",
      transformIndexHtml(html) {
        return html.replace("__TOMATO_RENDERER_CSP__", getRendererContentSecurityPolicy(command === "serve"));
      }
    }
  ],
  build: {
    outDir: path.resolve(__dirname, "dist-renderer"),
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
}));
