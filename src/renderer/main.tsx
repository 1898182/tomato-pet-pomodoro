import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const surface = new URLSearchParams(window.location.search).get("surface") ?? "avatar";
document.documentElement.classList.toggle("avatar-document", surface === "avatar");
document.body.classList.toggle("avatar-document", surface === "avatar");

async function renderSurface(): Promise<void> {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Renderer root element is missing.");

  const App = surface === "settings"
    ? (await import("./surfaces/SettingsApp")).SettingsApp
    : (await import("./surfaces/AvatarApp")).AvatarApp;

  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void renderSurface();
