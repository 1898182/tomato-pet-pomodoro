import type { ActiveTimerPhase, TimerPreset, TimerPresetDraft } from "./types";

export const MAX_VISIBLE_PRESETS = 4;
export const MAX_PRESET_NAME_LENGTH = 24;

export const PRESET_LIMITS = {
  focusMinutes: { min: 1, max: 180 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 120 },
  longBreakEvery: { min: 1, max: 12 }
} as const;

export function validatePresetDraft(value: TimerPresetDraft): TimerPresetDraft {
  const name = value.name.trim();
  if (!name) throw new Error("Rhythm name is required.");
  if (name.length > MAX_PRESET_NAME_LENGTH) throw new Error(`Rhythm name must be ${MAX_PRESET_NAME_LENGTH} characters or fewer.`);
  for (const key of Object.keys(PRESET_LIMITS) as Array<keyof typeof PRESET_LIMITS>) {
    const limit = PRESET_LIMITS[key];
    const number = value[key];
    if (!Number.isInteger(number) || number < limit.min || number > limit.max) {
      throw new Error(`${key} must be a whole number between ${limit.min} and ${limit.max}.`);
    }
  }
  return { ...value, name };
}

export function getPhaseDurationSeconds(preset: TimerPreset, phase: ActiveTimerPhase) {
  if (phase === "focus") {
    return preset.focusMinutes * 60;
  }
  if (phase === "long_break") {
    return preset.longBreakMinutes * 60;
  }
  return preset.shortBreakMinutes * 60;
}

export function getNextPhase(completedPhase: ActiveTimerPhase, cycleCount: number, preset: TimerPreset): ActiveTimerPhase {
  if (completedPhase === "focus") {
    return cycleCount > 0 && cycleCount % preset.longBreakEvery === 0 ? "long_break" : "short_break";
  }
  return "focus";
}
