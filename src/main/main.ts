import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, powerMonitor, screen, shell, Tray } from "electron";
import type { IpcMainInvokeEvent, OpenDialogOptions, SaveDialogOptions, WebContents } from "electron";
import fs from "node:fs";
import path from "node:path";
import { unlockCatalog, validateCatalogManifest } from "../shared/catalog";
import { APP_ID, APP_NAME, formatPhaseCompleteNotification } from "../shared/notifications";
import { getPhaseDurationSeconds } from "../shared/timerPresets";
import { DONATION_URL, SUPPORT_EMAIL } from "../shared/support";
import type { ActiveTimerPhase, AppSettings, AvatarDisplayMode, AvatarInteractiveRegion, ExportEnvelope, ProgressionUpdate, RewardEvent, TimerPresetDraft, TimerSnapshot } from "../shared/types";
import { isPointInInteractiveRegions, normalizeInteractiveRegions } from "./services/avatarHitRegions";
import { DatabaseService } from "./services/database";
import { resolveAvatarMode } from "./services/avatarVisibility";
import { loadPetAssetBundle } from "./services/petAssets";
import { isTrustedRendererUrl, validateDevServerUrl } from "./services/rendererSecurity";
import { TimerEngine } from "./services/timerEngine";
import { clampToWorkArea, getBottomRightBounds } from "./services/windowBounds";

let avatarWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let database: DatabaseService;
let timer: TimerEngine;
let avatarMode: AvatarDisplayMode = "full";
let revealedFocusSessionId: string | null = null;
let avatarRendererReady = false;
let pendingAvatarProgression: ProgressionUpdate[] = [];
let avatarInteractiveRegions: AvatarInteractiveRegion[] = [];
let avatarInteractionActive = false;
let avatarIgnoringMouse = false;
let avatarMousePoll: NodeJS.Timeout | null = null;
let idlePoll: NodeJS.Timeout | null = null;

const devServerUrl = process.env.VITE_DEV_SERVER_URL ? validateDevServerUrl(process.env.VITE_DEV_SERVER_URL) : undefined;
const isDev = Boolean(devServerUrl);
const AVATAR_COLLAPSED_SIZE = { width: 280, height: 280 };
const AVATAR_EXPANDED_SIZE = { width: 430, height: 243 };
const AVATAR_MINI_SIZE = { width: 178, height: 48 };
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.setName(APP_NAME);
if (process.platform === "win32") app.setAppUserModelId(APP_ID);
const hasSingleInstanceLock = app.requestSingleInstanceLock();

async function createApp() {
  database = new DatabaseService();
  await database.init();
  timer = new TimerEngine(database);
  timer.on("state", broadcastTimerState);
  timer.on("reward", (reward: RewardEvent) => broadcastProgression(reward));
  timer.on("phase-complete", ({ completedPhase, readyForNextPhase }) => {
    notifyPhaseComplete(completedPhase, readyForNextPhase);
    if (completedPhase === "focus") setAvatarMode("full");
  });
  timer.start();

  registerIpc();
  createAvatarWindow();
  avatarMousePoll = setInterval(updateAvatarMousePassthrough, 25);
  avatarMousePoll.unref();
  createTray();
  applyLaunchAtStartup(database.getSettings().launchAtStartup);

  idlePoll = setInterval(() => {
    timer.handleIdleIfNeeded(powerMonitor.getSystemIdleTime());
  }, 30_000);
  idlePoll.unref();
}

function createAvatarWindow() {
  const saved = database.getAvatarPosition();
  const initialPosition = saved ? clampToDisplays(saved.x, saved.y, AVATAR_COLLAPSED_SIZE.width, AVATAR_COLLAPSED_SIZE.height) : null;
  avatarWindow = new BrowserWindow({
    ...AVATAR_COLLAPSED_SIZE,
    x: initialPosition?.x,
    y: initialPosition?.y,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  avatarWindow.setAlwaysOnTop(true, "floating");
  avatarWindow.setIgnoreMouseEvents(true);
  avatarIgnoringMouse = true;
  avatarWindow.on("closed", () => {
    avatarWindow = null;
    avatarRendererReady = false;
    avatarInteractiveRegions = [];
    avatarInteractionActive = false;
    avatarIgnoringMouse = false;
  });
  avatarWindow.webContents.on("did-start-loading", () => { avatarRendererReady = false; });
  configureRendererSecurity(avatarWindow);
  loadRenderer(avatarWindow, "avatar");
}

function showAvatarWindow() {
  const snapshot = timer.getState();
  if (snapshot.phase === "focus") {
    revealedFocusSessionId = snapshot.activeSessionId;
  }
  if (!avatarWindow || avatarWindow.isDestroyed()) {
    createAvatarWindow();
  }
  setAvatarMode("full");
  avatarWindow?.show();
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 1095,
    height: 1050,
    minWidth: 900,
    minHeight: 720,
    title: "Tomato Pet Settings",
    icon: getApplicationIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  configureRendererSecurity(settingsWindow);
  loadRenderer(settingsWindow, "settings");
}

function loadRenderer(window: BrowserWindow, surface: "avatar" | "settings") {
  if (devServerUrl) {
    const rendererUrl = new URL(devServerUrl);
    rendererUrl.searchParams.set("surface", surface);
    window.loadURL(rendererUrl.toString());
    return;
  }
  window.loadFile(path.join(app.getAppPath(), "dist-renderer", "index.html"), {
    query: { surface }
  });
}

function createTray() {
  const iconPath = path.join(app.getAppPath(), "dist-renderer", "assets", "tray", "tomato-tray.png");
  const fallbackIconPath = path.join(process.cwd(), "public", "assets", "tray", "tomato-tray.png");
  const icon = nativeImage.createFromPath(fs.existsSync(iconPath) ? iconPath : fallbackIconPath);
  tray = new Tray(icon.resize({ width: 18, height: 18 }));
  tray.setToolTip("Tomato Pet Pomodoro");
  tray.on("click", showAvatarWindow);
  updateTray(timer.getState());
}

function updateTray(snapshot: TimerSnapshot) {
  if (!tray) {
    return;
  }

  const displaySeconds = getDisplaySeconds(snapshot);
  const label = formatRemaining(displaySeconds);
  tray.setToolTip(snapshot.phase === "idle" ? "Tomato Pet Pomodoro" : `Tomato Pet - ${label}`);
  if (process.platform === "darwin") {
    tray.setTitle(snapshot.phase === "idle" ? "" : label);
  }

  const nextPhase = snapshot.readyForNextPhase;
  const template = [
    nextPhase
      ? { label: `Next: ${formatPhase(nextPhase)} ${label}`, enabled: false }
      : snapshot.phase === "idle"
        ? { label: "Start focus", click: () => timer.startFocus() }
        : { label: `Timer: ${label}`, enabled: false },
    ...(nextPhase ? [{ label: `Start ${nextPhase === "focus" ? "focus" : "break"}`, click: () => startNextPhase(nextPhase) }] : []),
    { label: "Pause", enabled: snapshot.phase === "focus" || snapshot.phase === "short_break" || snapshot.phase === "long_break", click: () => timer.pause() },
    { label: "Resume", enabled: snapshot.phase === "paused", click: () => timer.resume() },
    { label: "Stop", enabled: snapshot.phase !== "idle", click: () => timer.stop() },
    { type: "separator" as const },
    { label: "Show pet", click: showAvatarWindow },
    { label: "Settings", click: createSettingsWindow },
    { type: "separator" as const },
    { label: "Quit", click: () => app.quit() }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  handleTrusted("app:quit", () => app.quit());
  handleTrusted("app:open-external", (_event, url: string) => {
    const allowedUrls = new Set([DONATION_URL, `mailto:${SUPPORT_EMAIL}`]);
    if (!allowedUrls.has(url)) throw new Error("That external destination is not allowed.");
    return shell.openExternal(url);
  });

  handleTrusted("assets:get-pet", (_event, petId: string) => {
    if (!isSafeIdentifier(petId)) throw new Error("Pet ID is invalid.");
    const assetRoot = isDev
      ? path.join(app.getAppPath(), "public", "assets")
      : path.join(app.getAppPath(), "dist-renderer", "assets");
    return loadPetAssetBundle(assetRoot, petId);
  });

  handleTrusted("timer:get-state", () => timer.getState());
  handleTrusted("timer:start-focus", () => timer.startFocus());
  handleTrusted("timer:start-break", (_event, phase: unknown) => {
    if (phase !== "short_break" && phase !== "long_break") throw new Error("Break phase is invalid.");
    return timer.startBreak(phase);
  });
  handleTrusted("timer:pause", () => timer.pause());
  handleTrusted("timer:resume", () => timer.resume());
  handleTrusted("timer:stop", () => timer.stop());

  handleTrusted("presets:list", () => database.listPresets());
  handleTrusted("presets:select", (_event, presetId: string) => timer.selectPreset(presetId));
  handleTrusted("presets:create", (_event, preset: TimerPresetDraft) => timer.createCustomPreset(preset));
  handleTrusted("presets:remove", (_event, presetId: string) => timer.removePreset(presetId));
  handleTrusted("presets:reset", () => timer.resetPresets());
  handleTrusted("progression:get-profile", () => database.getProfile());
  handleTrusted("progression:get-summary", () => database.getProgressionSummary());
  handleTrusted("progression:renderer-ready", (event) => {
    if (!avatarWindow || avatarWindow.isDestroyed() || avatarWindow.webContents.id !== event.sender.id) return;
    avatarRendererReady = true;
    pendingAvatarProgression.forEach((update) => avatarWindow?.webContents.send("progression:changed", update));
    pendingAvatarProgression = [];
  });
  handleTrusted("progression:pet-current-break", () => {
    const result = timer.petCurrentBreak();
    return { ...result, summary: database.getProgressionSummary() };
  });
  handleTrusted("analytics:get-overview", (_event, weeks?: number) => database.getAnalyticsOverview(weeks));
  handleTrusted("catalog:list", () => {
    const assetRoot = isDev ? path.join(app.getAppPath(), "public", "assets") : path.join(app.getAppPath(), "dist-renderer", "assets");
    const manifest = validateCatalogManifest(JSON.parse(fs.readFileSync(path.join(assetRoot, "items", "items.json"), "utf8")));
    return unlockCatalog(manifest, database.getProfile().currentLevel);
  });

  handleTrusted("settings:get", () => database.getSettings());
  handleTrusted("settings:update", (_event, partial: Partial<AppSettings>) => {
    const next = database.updateSettings(partial);
    applyLaunchAtStartup(next.launchAtStartup);
    sendSettingsChanged(next);
    applyAvatarMode(timer.getState());
    return next;
  });
  handleTrusted("settings:open", () => createSettingsWindow());

  handleTrusted("data:export-file", async () => {
    const options: SaveDialogOptions = {
      title: "Export Tomato Pet preferences",
      defaultPath: path.join(app.getPath("documents"), "tomato-pet-preferences.json"),
      filters: [{ name: "JSON files", extensions: ["json"] }]
    };
    const result = settingsWindow && !settingsWindow.isDestroyed()
      ? await dialog.showSaveDialog(settingsWindow, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { canceled: true, filePath: null };
    await fs.promises.writeFile(result.filePath, JSON.stringify(database.exportData(), null, 2), "utf8");
    return { canceled: false, filePath: result.filePath };
  });
  handleTrusted("data:import-file", async () => {
    if (timer.getState().phase !== "idle") throw new Error("Stop the current timer before importing preferences.");
    const options: OpenDialogOptions = {
      title: "Import Tomato Pet preferences",
      properties: ["openFile"],
      filters: [{ name: "JSON files", extensions: ["json"] }]
    };
    const result = settingsWindow && !settingsWindow.isDestroyed()
      ? await dialog.showOpenDialog(settingsWindow, options)
      : await dialog.showOpenDialog(options);
    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) return { canceled: true, filePath: null };
    if ((await fs.promises.stat(filePath)).size > 1_000_000) throw new Error("The preferences file is too large.");
    const payload = JSON.parse(await fs.promises.readFile(filePath, "utf8")) as ExportEnvelope;
    importPreferences(payload);
    return { canceled: false, filePath };
  });

  handleTrusted("avatar:get-bounds", () => avatarWindow?.getBounds() ?? { x: 0, y: 0, ...AVATAR_COLLAPSED_SIZE });
  handleTrusted("avatar:set-position", (_event, x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Avatar position is invalid.");
    if (!avatarWindow) {
      return { x, y };
    }
    const bounds = avatarWindow.getBounds();
    const next = clampToDisplays(x, y, bounds.width, bounds.height);
    avatarWindow.setPosition(next.x, next.y);
    database.saveAvatarPosition(next.x, next.y, next.displayId);
    return { x: next.x, y: next.y };
  });
  handleTrusted("avatar:set-expanded", (_event, expanded: boolean) => {
    if (!avatarWindow || avatarWindow.isDestroyed()) {
      return { x: 0, y: 0, ...(expanded ? AVATAR_EXPANDED_SIZE : AVATAR_COLLAPSED_SIZE) };
    }

    if (avatarMode === "mini") return avatarWindow.getBounds();
    const bounds = avatarWindow.getBounds();
    const size = expanded ? AVATAR_EXPANDED_SIZE : AVATAR_COLLAPSED_SIZE;
    const next = clampToDisplays(bounds.x, bounds.y, size.width, size.height);
    avatarWindow.setBounds({ x: next.x, y: next.y, ...size });
    database.saveAvatarPosition(next.x, next.y, next.displayId);
    return { x: next.x, y: next.y, ...size };
  });
  handleTrusted("avatar:hide", () => avatarWindow?.hide());
  handleTrusted("avatar:set-interactive-regions", (event, regions: unknown) => {
    if (!isAvatarRenderer(event.sender.id)) return;
    avatarInteractiveRegions = normalizeInteractiveRegions(regions);
    updateAvatarMousePassthrough();
  });
  handleTrusted("avatar:set-interaction-active", (event, active: unknown) => {
    if (!isAvatarRenderer(event.sender.id)) return;
    avatarInteractionActive = active === true;
    updateAvatarMousePassthrough();
  });
  handleTrusted("avatar:get-mode", () => avatarMode);
}

function handleTrusted(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedRenderer(event.sender);
    return handler(event, ...args);
  });
}

function assertTrustedRenderer(sender: WebContents) {
  const belongsToAppWindow = [avatarWindow, settingsWindow].some((window) =>
    window && !window.isDestroyed() && !window.webContents.isDestroyed() && window.webContents.id === sender.id
  );
  if (!belongsToAppWindow || !isTrustedRendererUrl(sender.getURL(), getRendererLocationPolicy())) {
    throw new Error("IPC request rejected from an untrusted renderer.");
  }
}

function configureRendererSecurity(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url, getRendererLocationPolicy())) event.preventDefault();
  });
}

function getRendererLocationPolicy() {
  return {
    devServerUrl,
    productionEntryPath: path.join(app.getAppPath(), "dist-renderer", "index.html")
  };
}

function isAvatarRenderer(webContentsId: number) {
  return Boolean(avatarWindow && !avatarWindow.isDestroyed() && !avatarWindow.webContents.isDestroyed() && avatarWindow.webContents.id === webContentsId);
}

function importPreferences(payload: ExportEnvelope) {
  if (timer.getState().phase !== "idle") throw new Error("Stop the current timer before importing preferences.");
  const imported = database.importData(payload);
  timer.selectPreset(imported.selectedPresetId);
  const settings = database.getSettings();
  applyLaunchAtStartup(settings.launchAtStartup);
  sendSettingsChanged(settings);
  applyAvatarMode(timer.getState());
  return imported;
}

function updateAvatarMousePassthrough() {
  if (!avatarWindow || avatarWindow.isDestroyed() || !avatarWindow.isVisible()) return;

  const bounds = avatarWindow.getBounds();
  const cursor = screen.getCursorScreenPoint();
  const isInteractive = avatarInteractionActive || isPointInInteractiveRegions({
    x: cursor.x - bounds.x,
    y: cursor.y - bounds.y
  }, avatarInteractiveRegions);
  const shouldIgnore = !isInteractive;
  if (shouldIgnore === avatarIgnoringMouse) return;

  avatarWindow.setIgnoreMouseEvents(shouldIgnore);
  avatarIgnoringMouse = shouldIgnore;
}

function broadcastTimerState(snapshot: TimerSnapshot) {
  applyAvatarMode(snapshot);
  sendTimerState(avatarWindow, snapshot);
  sendTimerState(settingsWindow, snapshot);
  updateTray(snapshot);
  updateTaskbar(snapshot);
}

function sendSettingsChanged(settings: AppSettings) {
  for (const window of [avatarWindow, settingsWindow]) {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send("settings:changed", settings);
  }
}

function broadcastProgression(reward: RewardEvent) {
  const update = { reward, summary: database.getProgressionSummary() };
  if (avatarRendererReady && avatarWindow && !avatarWindow.isDestroyed() && !avatarWindow.webContents.isDestroyed()) {
    avatarWindow.webContents.send("progression:changed", update);
  } else {
    pendingAvatarProgression = [...pendingAvatarProgression, update].slice(-3);
  }
  if (settingsWindow && !settingsWindow.isDestroyed() && !settingsWindow.webContents.isDestroyed()) {
    settingsWindow.webContents.send("progression:changed", update);
  }
}

function applyAvatarMode(snapshot: TimerSnapshot) {
  if (snapshot.phase !== "focus") {
    revealedFocusSessionId = null;
  }
  const nextMode = resolveAvatarMode(database.getSettings(), snapshot, revealedFocusSessionId);
  setAvatarMode(nextMode);
}

function setAvatarMode(mode: AvatarDisplayMode) {
  if (!avatarWindow || avatarWindow.isDestroyed()) { avatarMode = mode; return; }
  const changed = avatarMode !== mode;
  avatarMode = mode;
  if (changed) {
    avatarInteractiveRegions = [];
    avatarInteractionActive = false;
  }
  if (mode === "mini") {
    const primaryWorkArea = screen.getPrimaryDisplay().workArea;
    avatarWindow.setBounds(getBottomRightBounds(AVATAR_MINI_SIZE.width, AVATAR_MINI_SIZE.height, primaryWorkArea));
  } else if (changed) {
    const saved = database.getAvatarPosition();
    const fallback = avatarWindow.getBounds();
    const next = clampToDisplays(saved?.x ?? fallback.x, saved?.y ?? fallback.y, AVATAR_COLLAPSED_SIZE.width, AVATAR_COLLAPSED_SIZE.height);
    avatarWindow.setBounds({ x: next.x, y: next.y, ...AVATAR_COLLAPSED_SIZE });
  }
  avatarWindow.showInactive();
  if (!avatarWindow.webContents.isDestroyed()) avatarWindow.webContents.send("avatar:mode", mode);
}

function sendTimerState(window: BrowserWindow | null, snapshot: TimerSnapshot) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send("timer:state", snapshot);
}

function updateTaskbar(snapshot: TimerSnapshot) {
  const target = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : avatarWindow;
  if (!target) {
    return;
  }

  if (snapshot.phase === "idle" || !snapshot.endsAt || !snapshot.startedAt) {
    target.setProgressBar(-1);
    app.setBadgeCount(0);
    return;
  }

  const totalSeconds = Math.max(1, Math.floor((new Date(snapshot.endsAt).getTime() - new Date(snapshot.startedAt).getTime()) / 1000));
  const progress = 1 - snapshot.remainingSeconds / totalSeconds;
  target.setProgressBar(Math.max(0, Math.min(1, progress)));
  if (process.platform === "darwin") {
    app.setBadgeCount(Math.ceil(snapshot.remainingSeconds / 60));
  }
}

function notifyPhaseComplete(completedPhase: ActiveTimerPhase, readyForNextPhase: ActiveTimerPhase | null) {
  const settings = database.getSettings();
  if (settings.completionSoundsEnabled) {
    shell.beep();
  }

  if (settings.notificationsEnabled && Notification.isSupported()) {
    new Notification({
      title: APP_NAME,
      body: formatPhaseCompleteNotification(readyForNextPhase, settings.autoStartNextSession),
      silent: true
    }).show();
  }
}

function startNextPhase(phase: ActiveTimerPhase) {
  if (phase === "focus") {
    timer.startFocus();
  } else {
    timer.startBreak(phase);
  }
}

function clampToDisplays(x: number, y: number, width: number, height: number) {
  const center = { x: x + width / 2, y: y + height / 2 };
  const display = screen.getDisplayNearestPoint(center);
  const area = display.workArea;
  const position = clampToWorkArea(x, y, width, height, area);
  return {
    ...position,
    displayId: String(display.id)
  };
}

function getApplicationIconPath(): string {
  const fileName = process.platform === "win32" ? "app-icon.ico" : "app-icon.png";
  const packagedPath = path.join(app.getAppPath(), "dist-renderer", "assets", fileName);
  const sourcePath = path.join(app.getAppPath(), "public", "assets", fileName);
  return fs.existsSync(packagedPath) ? packagedPath : sourcePath;
}

function applyLaunchAtStartup(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false
  });
}

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getDisplaySeconds(snapshot: TimerSnapshot) {
  return snapshot.readyForNextPhase
    ? getPhaseDurationSeconds(snapshot.preset, snapshot.readyForNextPhase)
    : snapshot.remainingSeconds;
}

function formatPhase(phase: ActiveTimerPhase) {
  if (phase === "short_break") {
    return "short break";
  }
  if (phase === "long_break") {
    return "long break";
  }
  return "focus";
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]+$/.test(value);
}

if (!hasSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    avatarWindow.show();
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
  }
});

app.whenReady().then(() => hasSingleInstanceLock ? createApp() : undefined).catch((error) => {
  dialog.showErrorBox("Tomato Pet failed to start", error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => {
  // Keep the tray companion alive after closing settings windows.
});

app.on("before-quit", () => {
  if (avatarMousePoll) clearInterval(avatarMousePoll);
  if (idlePoll) clearInterval(idlePoll);
  timer?.dispose();
  database?.close();
});
