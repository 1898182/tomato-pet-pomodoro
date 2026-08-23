import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, AvatarDisplayMode, ElectronApi, ProgressionUpdate, TimerSnapshot } from "../shared/types";

const api: ElectronApi = {
  app: {
    quit: () => ipcRenderer.invoke("app:quit"),
    openExternal: (url) => ipcRenderer.invoke("app:open-external", url)
  },
  assets: {
    getPet: (petId) => ipcRenderer.invoke("assets:get-pet", petId)
  },
  timer: {
    getState: () => ipcRenderer.invoke("timer:get-state"),
    startFocus: () => ipcRenderer.invoke("timer:start-focus"),
    startBreak: (phase) => ipcRenderer.invoke("timer:start-break", phase),
    pause: () => ipcRenderer.invoke("timer:pause"),
    resume: () => ipcRenderer.invoke("timer:resume"),
    stop: () => ipcRenderer.invoke("timer:stop"),
    updateTask: (text) => ipcRenderer.invoke("timer:update-task", text),
    onState: (callback: (snapshot: TimerSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: TimerSnapshot) => callback(snapshot);
      ipcRenderer.on("timer:state", listener);
      return () => ipcRenderer.off("timer:state", listener);
    }
  },
  presets: {
    list: () => ipcRenderer.invoke("presets:list"),
    select: (presetId) => ipcRenderer.invoke("presets:select", presetId),
    create: (preset) => ipcRenderer.invoke("presets:create", preset),
    remove: (presetId) => ipcRenderer.invoke("presets:remove", presetId),
    reset: () => ipcRenderer.invoke("presets:reset")
  },
  progression: {
    getProfile: () => ipcRenderer.invoke("progression:get-profile"),
    getSummary: () => ipcRenderer.invoke("progression:get-summary"),
    petCurrentBreak: () => ipcRenderer.invoke("progression:pet-current-break"),
    onChanged: (callback: (update: ProgressionUpdate) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, update: ProgressionUpdate) => callback(update);
      ipcRenderer.on("progression:changed", listener);
      return () => ipcRenderer.off("progression:changed", listener);
    },
    rendererReady: () => ipcRenderer.invoke("progression:renderer-ready")
  },
  catalog: {
    list: () => ipcRenderer.invoke("catalog:list")
  },
  analytics: {
    getOverview: (weeks) => ipcRenderer.invoke("analytics:get-overview", weeks)
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (settings: Partial<AppSettings>) => ipcRenderer.invoke("settings:update", settings),
    open: () => ipcRenderer.invoke("settings:open"),
    onChanged: (callback: (settings: AppSettings) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
      ipcRenderer.on("settings:changed", listener);
      return () => ipcRenderer.off("settings:changed", listener);
    }
  },
  data: {
    exportToFile: () => ipcRenderer.invoke("data:export-file"),
    importFromFile: () => ipcRenderer.invoke("data:import-file")
  },
  avatar: {
    getBounds: () => ipcRenderer.invoke("avatar:get-bounds"),
    setPosition: (x, y) => ipcRenderer.invoke("avatar:set-position", x, y),
    setExpanded: (expanded) => ipcRenderer.invoke("avatar:set-expanded", expanded),
    hide: () => ipcRenderer.invoke("avatar:hide"),
    setInteractiveRegions: (regions) => ipcRenderer.invoke("avatar:set-interactive-regions", regions),
    setInteractionActive: (active) => ipcRenderer.invoke("avatar:set-interaction-active", active),
    getMode: () => ipcRenderer.invoke("avatar:get-mode"),
    onMode: (callback: (mode: AvatarDisplayMode) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, mode: AvatarDisplayMode) => callback(mode);
      ipcRenderer.on("avatar:mode", listener);
      return () => ipcRenderer.off("avatar:mode", listener);
    }
  }
};

contextBridge.exposeInMainWorld("tomatoPet", api);
