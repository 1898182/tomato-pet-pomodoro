import type { ActiveTimerPhase } from "./types";

export const APP_NAME = "Tomato Pet Pomodoro";
export const APP_ID = "dev.tomato-pet.pomodoro";

export function formatPhaseCompleteNotification(nextPhase: ActiveTimerPhase | null, autoStart: boolean) {
  if (!nextPhase) return "Session complete. Your tomato is ready when you are.";
  const next = nextPhase === "focus" ? "focus session" : nextPhase === "long_break" ? "long break" : "short break";
  const opening = nextPhase === "focus" ? "Break complete." : "Nice work.";
  return `${opening} Your ${next} is ${autoStart ? "starting now" : "ready when you are"}.`;
}
