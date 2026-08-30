import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimerPreset, TimerSnapshot } from "../../shared/types";
import type { DatabaseService } from "./database";
import { TimerEngine } from "./timerEngine";

const preset: TimerPreset = {
  id: "test",
  name: "Test",
  focusMinutes: 1,
  shortBreakMinutes: 2,
  longBreakMinutes: 3,
  longBreakEvery: 2,
  isDefault: true,
  kind: "built_in"
};

afterEach(() => {
  vi.useRealTimers();
});

describe("TimerEngine", () => {
  it("prompts for the configured break and awards fixed XP after focus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    const engine = new TimerEngine(database as unknown as DatabaseService);

    engine.start();
    engine.startFocus();
    vi.advanceTimersByTime(60_000);

    expect(engine.getState()).toMatchObject({
      phase: "idle",
      readyForNextPhase: "short_break",
      cycleCount: 1
    });
    expect(database.sessions[0]).toMatchObject({ completed: true, xpEarned: 10 });
    expect(database.xp[0]).toMatchObject({ reason: "focus_minutes", baseXp: 10, finalXp: 10 });
    expect(database.seeds[0]).toMatchObject({ baseSeeds: 1, finalSeeds: 1 });
    engine.dispose();
  });

  it("starts the configured break immediately when automatic mode is enabled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(true);
    const engine = new TimerEngine(database as unknown as DatabaseService);

    engine.start();
    engine.startFocus();
    vi.advanceTimersByTime(60_000);

    expect(engine.getState()).toMatchObject({
      phase: "short_break",
      activePhase: "short_break",
      readyForNextPhase: null,
      remainingSeconds: 2 * 60,
      cycleCount: 1
    });
    engine.dispose();
  });

  it("updates the idle timer when a new preset is selected", () => {
    const database = createDatabase();
    const engine = new TimerEngine(database as unknown as DatabaseService);
    const nextPreset = { ...preset, id: "next", name: "Next", focusMinutes: 40 };
    database.selectedPreset = nextPreset;

    expect(engine.selectPreset("next")).toMatchObject({
      preset: nextPreset,
      remainingSeconds: 40 * 60
    });
  });

  it("adds focus completion rewards only for sessions planned for at least 25 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    database.selectedPreset = { ...preset, focusMinutes: 25 };
    const engine = new TimerEngine(database as unknown as DatabaseService);
    engine.start();
    engine.startFocus();
    vi.advanceTimersByTime(25 * 60_000);

    expect(database.xp.filter((entry) => entry.reason === "focus_minutes")).toHaveLength(25);
    expect(database.seeds.filter((entry) => entry.reason === "focus_minutes")).toHaveLength(25);
    expect(database.xp.at(-1)?.reason).toBe("focus_completion");
    expect(database.seeds.at(-1)?.reason).toBe("focus_completion");
    expect(database.xp.filter((entry) => entry.reason === "focus_minutes").every((entry) => entry.multiplier === 1)).toBe(true);
    expect(database.xp.reduce((sum, entry) => sum + Number(entry.finalXp), 0)).toBe(300);
    expect(database.seeds.reduce((sum, entry) => sum + Number(entry.finalSeeds), 0)).toBe(30);
    expect(engine.getState()).toMatchObject({ focusChainMinutes: 25, currentMultiplier: 1.25, effectiveMultiplier: 1.25 });
    engine.dispose();
  });

  it("emits the next multiplier immediately after the 25th focus minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    database.selectedPreset = { ...preset, focusMinutes: 50 };
    const engine = new TimerEngine(database as unknown as DatabaseService);
    const states: TimerSnapshot[] = [];
    engine.on("state", (snapshot) => states.push(structuredClone(snapshot)));
    engine.start();
    engine.startFocus();

    vi.advanceTimersByTime(25 * 60_000 - 1_000);
    expect(engine.getState()).toMatchObject({ focusChainMinutes: 24, currentMultiplier: 1 });
    vi.advanceTimersByTime(1_000);

    expect(engine.getState()).toMatchObject({ phase: "focus", focusChainMinutes: 25, currentMultiplier: 1.25, effectiveMultiplier: 1.25 });
    expect(states.at(-1)).toMatchObject({ focusChainMinutes: 25, currentMultiplier: 1.25, effectiveMultiplier: 1.25 });
    expect(database.xp.filter((entry) => entry.reason === "focus_minutes").at(-1)).toMatchObject({ multiplier: 1, finalXp: 10 });
    engine.dispose();
  });

  it("preserves the focus chain through a scheduled break and applies it to the next focus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(true);
    database.selectedPreset = { ...preset, focusMinutes: 25, shortBreakMinutes: 1 };
    const engine = new TimerEngine(database as unknown as DatabaseService);
    engine.start();
    engine.startFocus();

    vi.advanceTimersByTime(25 * 60_000);
    expect(engine.getState()).toMatchObject({ phase: "short_break", focusChainMinutes: 25, currentMultiplier: 1.25 });
    vi.advanceTimersByTime(60_000);
    expect(engine.getState()).toMatchObject({ phase: "focus", focusChainMinutes: 25, currentMultiplier: 1.25 });
    vi.advanceTimersByTime(60_000);
    expect(database.xp.filter((entry) => entry.reason === "focus_minutes").at(-1)).toMatchObject({ multiplier: 1.25, finalXp: 12 });
    engine.dispose();
  });

  it("preserves the focus chain through a scheduled long break", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(true);
    database.selectedPreset = { ...preset, focusMinutes: 25, longBreakMinutes: 1, longBreakEvery: 1 };
    const engine = new TimerEngine(database as unknown as DatabaseService);
    engine.start();
    engine.startFocus();

    vi.advanceTimersByTime(25 * 60_000);
    expect(engine.getState()).toMatchObject({ phase: "long_break", focusChainMinutes: 25, currentMultiplier: 1.25 });
    vi.advanceTimersByTime(60_000);
    expect(engine.getState()).toMatchObject({ phase: "focus", focusChainMinutes: 25, currentMultiplier: 1.25 });
    engine.dispose();
  });

  it("counts completed minutes from shorter focus sessions toward the chain", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    database.selectedPreset = { ...preset, focusMinutes: 10 };
    const engine = new TimerEngine(database as unknown as DatabaseService);
    engine.start();
    engine.startFocus();
    vi.advanceTimersByTime(10 * 60_000);

    expect(engine.getState()).toMatchObject({ focusChainMinutes: 10, currentMultiplier: 1 });
    engine.dispose();
  });

  it("awards petting XP once per break", () => {
    const database = createDatabase(false);
    const engine = new TimerEngine(database as unknown as DatabaseService);
    const rewards: Array<Record<string, unknown>> = [];
    engine.on("reward", (reward) => rewards.push(reward));
    engine.startBreak("short_break");

    expect(engine.petCurrentBreak()).toMatchObject({ awardedXp: 5, alreadyAwarded: false });
    expect(engine.petCurrentBreak()).toMatchObject({ awardedXp: 0, alreadyAwarded: true });
    expect(database.xp.filter((entry) => entry.reason === "break_petting")).toHaveLength(1);
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ reason: "break_petting", awardedXp: 5, awardedSeeds: 0 });
  });

  it("emits each completed focus-minute reward as it is earned", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    database.selectedPreset = { ...preset, focusMinutes: 2 };
    const engine = new TimerEngine(database as unknown as DatabaseService);
    const rewards: Array<Record<string, unknown>> = [];
    engine.on("reward", (reward) => rewards.push(reward));
    engine.start();
    engine.startFocus();

    vi.advanceTimersByTime(59_000);
    expect(rewards).toHaveLength(0);
    vi.advanceTimersByTime(1_000);
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ reason: "focus_minutes", awardedXp: 10, awardedSeeds: 1 });
    expect(engine.getState().awardedFocusMinutes).toBe(1);
    engine.dispose();
  });

  it("uses deterministic ledger entries when timer-state persistence lags an award", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    database.selectedPreset = { ...preset, focusMinutes: 2 };
    const firstEngine = new TimerEngine(database as unknown as DatabaseService);
    firstEngine.start();
    firstEngine.startFocus();
    vi.advanceTimersByTime(60_000);
    database.restoredSnapshot = structuredClone(database.snapshots.at(-1) ?? null);
    if (database.restoredSnapshot) {
      database.restoredSnapshot.awardedFocusMinutes = 0;
      database.restoredSnapshot.focusChainMinutes = 0;
      database.restoredSnapshot.currentMultiplier = 1;
      database.restoredSnapshot.effectiveMultiplier = 1;
    }
    firstEngine.dispose();

    const restoredEngine = new TimerEngine(database as unknown as DatabaseService);
    restoredEngine.start();

    expect(database.xp.filter((entry) => entry.reason === "focus_minutes")).toHaveLength(1);
    expect(restoredEngine.getState().awardedFocusMinutes).toBe(1);
    expect(restoredEngine.getState().focusChainMinutes).toBe(1);
    restoredEngine.dispose();
  });

  it("carries partial focus seconds across a pause without carrying the multiplier", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    database.selectedPreset = { ...preset, focusMinutes: 2 };
    const engine = new TimerEngine(database as unknown as DatabaseService);
    engine.start();
    engine.startFocus();

    vi.advanceTimersByTime(59_000);
    engine.pause();
    expect(engine.getState().focusRewardRemainderSeconds).toBe(59);
    expect(engine.getState()).toMatchObject({ focusChainMinutes: 0, currentMultiplier: 1 });
    engine.resume();
    vi.advanceTimersByTime(1_000);

    expect(database.xp.filter((entry) => entry.reason === "focus_minutes")).toHaveLength(1);
    expect(database.xp.find((entry) => entry.reason === "focus_minutes")).toMatchObject({ finalXp: 10, multiplier: 1 });
    engine.dispose();
  });

  it("resets the focus chain on pause, stop, and idle interruption", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    database.selectedPreset = { ...preset, focusMinutes: 50 };
    const engine = new TimerEngine(database as unknown as DatabaseService);
    engine.start();
    engine.startFocus();
    vi.advanceTimersByTime(25 * 60_000);
    expect(engine.getState().currentMultiplier).toBe(1.25);

    engine.handleIdleIfNeeded(10 * 60);
    expect(engine.getState()).toMatchObject({ phase: "paused", focusChainMinutes: 0, currentMultiplier: 1 });
    engine.resume();
    engine.stop();
    expect(engine.getState()).toMatchObject({ phase: "idle", focusChainMinutes: 0, currentMultiplier: 1 });
    engine.dispose();
  });

  it.each(["focus", "short_break", "long_break"] as const)("pauses and resumes the %s timer after ten idle minutes", (phase) => {
    const database = createDatabase(false);
    const engine = new TimerEngine(database as unknown as DatabaseService);
    if (phase === "focus") engine.startFocus();
    else engine.startBreak(phase);

    engine.handleIdleIfNeeded(10 * 60 - 1);
    expect(engine.getState().phase).toBe(phase);
    engine.handleIdleIfNeeded(10 * 60);
    expect(engine.getState()).toMatchObject({ phase: "paused", pausedFromPhase: phase });

    engine.resume();
    expect(engine.getState()).toMatchObject({ phase, activePhase: phase });
    engine.dispose();
  });

  it.each(["pause", "stop"] as const)("resets a persisted focus chain on manual %s", (command) => {
    const database = createDatabase(false);
    const setupEngine = new TimerEngine(database as unknown as DatabaseService);
    database.restoredSnapshot = structuredClone(setupEngine.startFocus());
    setupEngine.dispose();
    if (database.restoredSnapshot) {
      database.restoredSnapshot.focusChainMinutes = 25;
      database.restoredSnapshot.currentMultiplier = 1.25;
      database.restoredSnapshot.effectiveMultiplier = 1.25;
    }
    const engine = new TimerEngine(database as unknown as DatabaseService);

    engine[command]();

    expect(engine.getState()).toMatchObject({ focusChainMinutes: 0, currentMultiplier: 1, effectiveMultiplier: 1 });
    engine.dispose();
  });

  it("caps an overdue completed segment at its scheduled end", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    const firstEngine = new TimerEngine(database as unknown as DatabaseService);
    database.restoredSnapshot = structuredClone(firstEngine.startFocus());
    firstEngine.dispose();

    vi.setSystemTime(new Date("2026-01-01T17:00:00.000Z"));
    const restoredEngine = new TimerEngine(database as unknown as DatabaseService);
    restoredEngine.start();

    expect(database.sessions.at(-1)).toMatchObject({ actualSeconds: 60, focusedSeconds: 60 });
    expect(database.xp.at(-1)).toMatchObject({ baseXp: 10, finalXp: 10 });
    restoredEngine.dispose();
  });

  it("does not carry overdue wall-clock time into a resumed focus segment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const database = createDatabase(false);
    const firstEngine = new TimerEngine(database as unknown as DatabaseService);
    database.restoredSnapshot = structuredClone(firstEngine.startFocus());
    firstEngine.dispose();

    vi.setSystemTime(new Date("2026-01-01T17:00:00.000Z"));
    const restoredEngine = new TimerEngine(database as unknown as DatabaseService);
    restoredEngine.pause();

    expect(restoredEngine.getState().focusRewardRemainderSeconds).toBe(0);
    expect(database.xp.filter((entry) => entry.reason === "focus_minutes")).toHaveLength(1);
    restoredEngine.dispose();
  });

  it("rejects overlapping or paused-session starts", () => {
    const database = createDatabase(false);
    const engine = new TimerEngine(database as unknown as DatabaseService);
    engine.startFocus();
    expect(() => engine.startBreak("short_break")).toThrow(/already active|current timer/);
    engine.pause();
    expect(() => engine.startFocus()).toThrow(/current timer/);
  });

  it("preserves break petting state across pause and resume", () => {
    const database = createDatabase(false);
    const engine = new TimerEngine(database as unknown as DatabaseService);
    engine.startBreak("short_break");
    engine.petCurrentBreak();
    engine.pause();
    engine.resume();

    expect(engine.getState()).toMatchObject({ pettingBonusAwarded: true });
    expect(engine.petCurrentBreak()).toMatchObject({ awardedXp: 0, alreadyAwarded: true });
  });
});

function createDatabase(autoStartNextSession = false) {
  return {
    selectedPreset: preset,
    snapshots: [] as TimerSnapshot[],
    sessions: [] as Array<Record<string, unknown>>,
    xp: [] as Array<Record<string, unknown>>,
    seeds: [] as Array<Record<string, unknown>>,
    restoredSnapshot: null as TimerSnapshot | null,
    getTimerState() {
      return this.restoredSnapshot;
    },
    getDefaultPreset() {
      return this.selectedPreset;
    },
    getSettings() {
      return { autoStartNextSession };
    },
    getStreakDays() {
      return 0;
    },
    saveTimerState(snapshot: TimerSnapshot) {
      this.snapshots.push(structuredClone(snapshot));
    },
    addSession(session: Record<string, unknown>) {
      this.sessions.push(session);
    },
    awardXp(sessionId: string, reason: string, baseXp: number, multiplier: number, _at?: Date, awardId?: string) {
      if (awardId && this.xp.some((entry) => entry.awardId === awardId)) return 0;
      const finalXp = Math.floor(baseXp * multiplier);
      this.xp.push({ sessionId, reason, baseXp, multiplier, finalXp, awardId });
      return finalXp;
    },
    awardSeeds(sessionId: string, reason: string, baseSeeds: number, multiplier: number, _at?: Date, awardId?: string) {
      if (awardId && this.seeds.some((entry) => entry.awardId === awardId)) return 0;
      const finalSeeds = Math.floor(baseSeeds * multiplier);
      this.seeds.push({ sessionId, reason, baseSeeds, multiplier, finalSeeds, awardId });
      return finalSeeds;
    },
    getSessionEarnings(sessionId: string) {
      return {
        xp: this.xp.filter((entry) => entry.sessionId === sessionId).reduce((sum, entry) => sum + Number(entry.finalXp), 0),
        seeds: this.seeds.filter((entry) => entry.sessionId === sessionId).reduce((sum, entry) => sum + Number(entry.finalSeeds), 0)
      };
    },
    updateSessionEarnings(sessionId: string, xpEarned: number, seedsEarned: number) {
      const session = this.sessions.find((entry) => entry.id === sessionId);
      if (session) Object.assign(session, { xpEarned, seedsEarned });
    },
    selectPreset() {
      return this.selectedPreset;
    }
  };
}
