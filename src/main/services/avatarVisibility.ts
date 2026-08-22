import type { AppSettings, AvatarDisplayMode, TimerSnapshot } from "../../shared/types";

export function resolveAvatarMode(settings: AppSettings, snapshot: TimerSnapshot, revealedFocusSessionId: string | null): AvatarDisplayMode {
  const stealthApplies = settings.stealthFocusEnabled
    && snapshot.phase === "focus"
    && snapshot.activeSessionId !== revealedFocusSessionId;
  return stealthApplies ? "mini" : "full";
}
