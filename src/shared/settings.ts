import type { AppSettings } from "./types";

const BOOLEAN_SETTING_KEYS = [
  "launchAtStartup",
  "autoStartNextSession",
  "notificationsEnabled",
  "completionSoundsEnabled",
  "petSoundsEnabled",
  "stealthFocusEnabled",
  "focusAudioEnabled"
] as const satisfies ReadonlyArray<keyof AppSettings>;

const SETTING_KEYS = new Set<keyof AppSettings>([
  ...BOOLEAN_SETTING_KEYS,
  "focusAudioTrack",
  "focusAudioVolume"
]);

export function validateSettingsUpdate(value: unknown): Partial<AppSettings> {
  if (!isRecord(value)) {
    throw new Error("Settings must be an object.");
  }

  for (const key of Object.keys(value)) {
    if (!SETTING_KEYS.has(key as keyof AppSettings)) {
      throw new Error(`Unknown setting: ${key}`);
    }
  }

  for (const key of BOOLEAN_SETTING_KEYS) {
    if (key in value && typeof value[key] !== "boolean") {
      throw new Error(`${key} must be a boolean.`);
    }
  }

  if ("focusAudioTrack" in value && value.focusAudioTrack !== "brown_noise" && value.focusAudioTrack !== "gentle_rain") {
    throw new Error("Focus audio track is invalid.");
  }

  if ("focusAudioVolume" in value &&
    (typeof value.focusAudioVolume !== "number" || !Number.isFinite(value.focusAudioVolume) || value.focusAudioVolume < 0 || value.focusAudioVolume > 1)) {
    throw new Error("Focus audio volume must be between 0 and 1.");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
