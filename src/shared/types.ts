import type { PetAssetBundle } from "./petManifest";

export type TimerPhase = "idle" | "focus" | "short_break" | "long_break" | "paused";

export type ActiveTimerPhase = Exclude<TimerPhase, "idle" | "paused">;

export type PetState = "sleeping" | "working" | "playing";

export type FocusAudioTrack = "brown_noise" | "gentle_rain";
export type AvatarDisplayMode = "full" | "mini";

export type AvatarInteractiveRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TimerPreset = {
  id: string;
  name: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  isDefault: boolean;
  kind: "built_in" | "custom";
};

export type TimerPresetDraft = {
  name: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
};

export type TimerSnapshot = {
  phase: TimerPhase;
  activePhase: ActiveTimerPhase | null;
  pausedFromPhase: ActiveTimerPhase | null;
  petState: PetState;
  preset: TimerPreset;
  startedAt: string | null;
  endsAt: string | null;
  pausedAt: string | null;
  remainingSeconds: number;
  accumulatedFocusSeconds: number;
  awardedFocusMinutes: number;
  focusRewardRemainderSeconds: number;
  focusChainMinutes: number;
  currentMultiplier: number;
  cycleCount: number;
  readyForNextPhase: ActiveTimerPhase | null;
  activeSessionId: string | null;
  taskText: string;
  breakPromptId: string | null;
  pettingBonusAwarded: boolean;
  streakDays: number;
  streakMultiplier: number;
  effectiveMultiplier: number;
};

export type PlayerProfile = {
  id: string;
  activePetId: string;
  totalXp: number;
  seedBalance: number;
  currentLevel: number;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  launchAtStartup: boolean;
  autoStartNextSession: boolean;
  notificationsEnabled: boolean;
  completionSoundsEnabled: boolean;
  petSoundsEnabled: boolean;
  stealthFocusEnabled: boolean;
  focusAudioEnabled: boolean;
  focusAudioTrack: FocusAudioTrack;
  focusAudioVolume: number;
};

export type SessionRecord = {
  id: string;
  phase: ActiveTimerPhase;
  startedAt: string;
  endedAt: string;
  plannedSeconds: number;
  actualSeconds: number;
  focusedSeconds: number;
  completed: boolean;
  interrupted: boolean;
  xpEarned: number;
  seedsEarned: number;
  taskText: string;
};

export type XpLedgerRecord = {
  id: string;
  sessionId: string;
  reason: string;
  baseXp: number;
  multiplier: number;
  finalXp: number;
  createdAt: string;
};

export type ProgressionSummary = {
  profile: PlayerProfile;
  currentLevelThreshold: number;
  nextLevelThreshold: number | null;
  xpToday: number;
  xpDailyCap: number;
  seedsToday: number;
  seedDailyCap: number;
  streakDays: number;
  streakMultiplier: number;
};

export type RewardEvent = {
  id: string;
  reason: "focus_minutes" | "focus_completion" | "break_completion" | "break_petting";
  awardedXp: number;
  awardedSeeds: number;
};

export type ProgressionUpdate = {
  summary: ProgressionSummary;
  reward: RewardEvent;
};

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "consumable";
  type: "wearable" | "desk" | "audio" | "animation" | "consumable";
  slot: "head" | "body" | "desk" | "audio" | "animation" | null;
  priceSeeds: number;
  requiredLevel: number;
  assetPath: string | null;
  unlocked: boolean;
};

export type AnalyticsDay = {
  date: string;
  focusedSeconds: number;
  completedSessions: number;
};

export type AnalyticsOverview = {
  weekFocusedSeconds: number;
  weekCompletedSessions: number;
  days: AnalyticsDay[];
};

export type PettingResult = {
  awardedXp: number;
  alreadyAwarded: boolean;
  summary: ProgressionSummary;
};

export type ExportEnvelopeV2 = {
  schemaVersion: 2;
  exportedAt: string;
  settings: AppSettings;
  selectedPresetId: string;
  customPreset: TimerPreset | null;
  avatarPositions: unknown[];
};

export type ExportEnvelopeV3 = {
  schemaVersion: 3;
  exportedAt: string;
  settings: AppSettings;
  selectedPresetId: string;
  hiddenBuiltInPresetIds: string[];
  customPresets: TimerPreset[];
  avatarPositions: unknown[];
};

export type ExportEnvelope = ExportEnvelopeV2 | ExportEnvelopeV3;

export type IpcUnsubscribe = () => void;

export type ElectronApi = {
  app: {
    quit: () => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  assets: {
    getPet: (petId: string) => Promise<PetAssetBundle>;
  };
  timer: {
    getState: () => Promise<TimerSnapshot>;
    startFocus: () => Promise<TimerSnapshot>;
    startBreak: (phase: "short_break" | "long_break") => Promise<TimerSnapshot>;
    pause: () => Promise<TimerSnapshot>;
    resume: () => Promise<TimerSnapshot>;
    stop: () => Promise<TimerSnapshot>;
    updateTask: (text: string) => Promise<TimerSnapshot>;
    onState: (callback: (snapshot: TimerSnapshot) => void) => IpcUnsubscribe;
  };
  presets: {
    list: () => Promise<TimerPreset[]>;
    select: (presetId: string) => Promise<TimerSnapshot>;
    create: (preset: TimerPresetDraft) => Promise<TimerSnapshot>;
    remove: (presetId: string) => Promise<TimerSnapshot>;
    reset: () => Promise<TimerSnapshot>;
  };
  progression: {
    getProfile: () => Promise<PlayerProfile>;
    getSummary: () => Promise<ProgressionSummary>;
    petCurrentBreak: () => Promise<PettingResult>;
    onChanged: (callback: (update: ProgressionUpdate) => void) => IpcUnsubscribe;
    rendererReady: () => Promise<void>;
  };
  catalog: {
    list: () => Promise<CatalogItem[]>;
  };
  analytics: {
    getOverview: (weeks?: number) => Promise<AnalyticsOverview>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (settings: Partial<AppSettings>) => Promise<AppSettings>;
    open: () => Promise<void>;
    onChanged: (callback: (settings: AppSettings) => void) => IpcUnsubscribe;
  };
  data: {
    export: () => Promise<ExportEnvelope>;
    copyExport: () => Promise<void>;
    import: (payload: ExportEnvelope) => Promise<ExportEnvelope>;
  };
  avatar: {
    getBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
    setPosition: (x: number, y: number) => Promise<{ x: number; y: number }>;
    setExpanded: (expanded: boolean) => Promise<{ x: number; y: number; width: number; height: number }>;
    hide: () => Promise<void>;
    setInteractiveRegions: (regions: AvatarInteractiveRegion[]) => Promise<void>;
    setInteractionActive: (active: boolean) => Promise<void>;
    getMode: () => Promise<AvatarDisplayMode>;
    onMode: (callback: (mode: AvatarDisplayMode) => void) => IpcUnsubscribe;
  };
};
