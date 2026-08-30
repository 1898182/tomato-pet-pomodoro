import { EventEmitter } from "node:events";
import { getStreakMultiplier } from "../../shared/progression";
import { getNextPhase, getPhaseDurationSeconds } from "../../shared/timerPresets";
import type { ActiveTimerPhase, PettingResult, RewardEvent, TimerPreset, TimerPresetDraft, TimerSnapshot } from "../../shared/types";
import { BREAK_PROMPTS } from "../../shared/wellness";
import type { DatabaseService } from "./database";
import { IDLE_RESET_MINUTES, XP_PER_FOCUSED_MINUTE } from "./progressionRules";
import { calculateFocusChainMultiplier } from "./xp";

const TICK_MS = 1_000;
const SEEDS_PER_FOCUSED_MINUTE = 1;
const FOCUS_COMPLETION_MINIMUM_SECONDS = 25 * 60;
const FOCUS_COMPLETION_XP = 50;
const FOCUS_COMPLETION_SEEDS = 5;
const BREAK_COMPLETION_XP = 50;
const BREAK_COMPLETION_SEEDS = 5;
const PETTING_XP = 5;

export class TimerEngine extends EventEmitter {
  private snapshot: TimerSnapshot;
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly database: DatabaseService) {
    super();
    this.snapshot = database.getTimerState() ?? createIdleSnapshot(database.getDefaultPreset());
    if (isActive(this.snapshot.phase) && !this.snapshot.activeSessionId) this.snapshot.activeSessionId = crypto.randomUUID();
    this.refreshProgression();
    this.emitAndPersist();
  }

  start() { this.interval = setInterval(() => this.tick(), TICK_MS); this.tick(); }
  dispose() { if (this.interval) clearInterval(this.interval); this.interval = null; }
  getState() { this.refreshDerivedState(); return this.snapshot; }
  startFocus() { return this.startPhase("focus"); }
  startBreak(phase: "short_break" | "long_break") { return this.startPhase(phase); }

  selectPreset(presetId: string) {
    this.assertPresetCanChange();
    this.applyPreset(this.database.selectPreset(presetId));
    return this.snapshot;
  }

  createCustomPreset(draft: TimerPresetDraft) {
    this.assertPresetCanChange();
    const preset = this.database.createCustomPreset(draft);
    this.database.selectPreset(preset.id);
    this.applyPreset({ ...preset, isDefault: true });
    return this.snapshot;
  }

  removePreset(presetId: string) {
    this.assertPresetCanChange();
    this.applyPreset(this.database.removePreset(presetId));
    return this.snapshot;
  }

  resetPresets() {
    this.assertPresetCanChange();
    this.applyPreset(this.database.resetPresets());
    return this.snapshot;
  }

  petCurrentBreak(): Omit<PettingResult, "summary"> {
    if ((this.snapshot.phase !== "short_break" && this.snapshot.phase !== "long_break") || !this.snapshot.activeSessionId) {
      return { awardedXp: 0, alreadyAwarded: false };
    }
    if (this.snapshot.pettingBonusAwarded) return { awardedXp: 0, alreadyAwarded: true };
    const awardedXp = this.database.awardXp(this.snapshot.activeSessionId, "break_petting", PETTING_XP, 1, new Date(), `${this.snapshot.activeSessionId}:break-petting`);
    this.snapshot = { ...this.snapshot, pettingBonusAwarded: true };
    this.refreshProgression();
    this.emitReward("break_petting", awardedXp, 0);
    this.emitAndPersist();
    return { awardedXp, alreadyAwarded: false };
  }

  pause(reason = "manual_pause") {
    if (!isActive(this.snapshot.phase)) return this.getState();
    const now = new Date();
    const activePhase = this.snapshot.phase;
    const remainingSeconds = Math.max(0, Math.ceil((new Date(this.snapshot.endsAt ?? now).getTime() - now.getTime()) / 1000));
    this.finishActiveSegment(false, true, reason, now);
    this.snapshot = {
      ...this.snapshot, phase: "paused", activePhase: null, pausedFromPhase: activePhase, pausedAt: now.toISOString(), endsAt: null,
      remainingSeconds, focusChainMinutes: 0, currentMultiplier: 1, effectiveMultiplier: this.snapshot.streakMultiplier, petState: "sleeping",
      readyForNextPhase: null, activeSessionId: null
    };
    this.emitAndPersist();
    return this.snapshot;
  }

  resume() {
    if (this.snapshot.phase !== "paused" || !this.snapshot.pausedFromPhase) return this.getState();
    const now = new Date();
    const phase = this.snapshot.pausedFromPhase;
    this.snapshot = {
      ...this.snapshot, phase, activePhase: phase, pausedFromPhase: null, startedAt: now.toISOString(),
      endsAt: new Date(now.getTime() + this.snapshot.remainingSeconds * 1000).toISOString(), pausedAt: null,
      accumulatedFocusSeconds: 0, currentMultiplier: 1, effectiveMultiplier: this.snapshot.streakMultiplier,
      petState: phase === "focus" ? "working" : "playing", activeSessionId: crypto.randomUUID(),
      awardedFocusMinutes: 0,
      breakPromptId: phase === "short_break" ? this.snapshot.breakPromptId ?? chooseBreakPrompt() : null,
      pettingBonusAwarded: phase === "focus" ? false : this.snapshot.pettingBonusAwarded
    };
    this.emitAndPersist();
    return this.snapshot;
  }

  stop() {
    if (isActive(this.snapshot.phase)) this.finishActiveSegment(false, true, "manual_stop", new Date());
    this.snapshot = createIdleSnapshot(this.snapshot.preset, this.snapshot.cycleCount, this.database.getStreakDays());
    this.emitAndPersist();
    return this.snapshot;
  }

  handleIdleIfNeeded(idleSeconds: number) {
    if (isActive(this.snapshot.phase) && idleSeconds >= IDLE_RESET_MINUTES * 60) this.pause("idle_reset");
  }

  private assertPresetCanChange() { if (this.snapshot.phase !== "idle") throw new Error("Stop the current timer before changing session rhythm."); }
  private applyPreset(preset: TimerPreset) {
    const readyForNextPhase = this.snapshot.readyForNextPhase;
    this.snapshot = { ...createIdleSnapshot(preset, this.snapshot.cycleCount, this.snapshot.streakDays,
      this.snapshot.focusChainMinutes, this.snapshot.focusRewardRemainderSeconds), readyForNextPhase };
    this.emitAndPersist();
  }

  private startPhase(phase: ActiveTimerPhase) {
    if (this.snapshot.phase !== "idle") throw new Error("Stop or finish the current timer before starting another session.");
    const now = new Date();
    const durationSeconds = getPhaseDurationSeconds(this.snapshot.preset, phase);
    this.refreshProgression();
    const currentMultiplier = calculateFocusChainMultiplier(this.snapshot.focusChainMinutes);
    this.snapshot = {
      ...this.snapshot, phase, activePhase: phase, pausedFromPhase: null, petState: phase === "focus" ? "working" : "playing",
      startedAt: now.toISOString(), endsAt: new Date(now.getTime() + durationSeconds * 1000).toISOString(), pausedAt: null,
      remainingSeconds: durationSeconds, accumulatedFocusSeconds: 0, awardedFocusMinutes: 0, currentMultiplier,
      effectiveMultiplier: currentMultiplier * this.snapshot.streakMultiplier, readyForNextPhase: null, activeSessionId: crypto.randomUUID(),
      breakPromptId: phase === "short_break" ? chooseBreakPrompt() : null,
      pettingBonusAwarded: phase === "focus" ? false : this.snapshot.pettingBonusAwarded
    };
    this.emitAndPersist();
    return this.snapshot;
  }

  private tick() {
    this.refreshDerivedState();
    if (this.snapshot.phase === "focus") this.awardCompletedFocusMinutes(this.snapshot.accumulatedFocusSeconds, new Date());
    if (this.snapshot.endsAt && Date.now() >= new Date(this.snapshot.endsAt).getTime()) { this.completeActivePhase(); return; }
    this.emitAndPersist(false);
  }

  private completeActivePhase() {
    const now = new Date();
    const completedPhase = this.snapshot.phase;
    if (!isActive(completedPhase)) return;
    const scheduledEnd = this.snapshot.endsAt ? new Date(this.snapshot.endsAt) : now;
    const completionTime = scheduledEnd.getTime() <= now.getTime() ? scheduledEnd : now;
    this.finishActiveSegment(true, false, `${completedPhase}_completed`, completionTime);
    const cycleCount = completedPhase === "focus" ? this.snapshot.cycleCount + 1 : this.snapshot.cycleCount;
    const readyForNextPhase = getNextPhase(completedPhase, cycleCount, this.snapshot.preset);
    this.snapshot = createIdleSnapshot(this.snapshot.preset, cycleCount, this.database.getStreakDays(),
      this.snapshot.focusChainMinutes, this.snapshot.focusRewardRemainderSeconds);
    this.emit("phase-complete", { completedPhase, readyForNextPhase });
    if (this.database.getSettings().autoStartNextSession) { this.startPhase(readyForNextPhase); return; }
    this.snapshot = { ...this.snapshot, readyForNextPhase };
    this.emitAndPersist();
  }

  private finishActiveSegment(completed: boolean, interrupted: boolean, reason: string, endedAt: Date) {
    if (!isActive(this.snapshot.phase)) return;
    const phase = this.snapshot.phase;
    const sessionId = this.snapshot.activeSessionId ?? crypto.randomUUID();
    const startedAt = this.snapshot.startedAt ?? endedAt.toISOString();
    const plannedSeconds = getPhaseDurationSeconds(this.snapshot.preset, phase);
    const actualSeconds = Math.max(0, Math.floor((endedAt.getTime() - new Date(startedAt).getTime()) / 1000));
    const focusedSeconds = phase === "focus" ? actualSeconds : 0;
    if (phase === "focus") this.awardCompletedFocusMinutes(focusedSeconds, endedAt);
    this.database.addSession({ id: sessionId, phase, startedAt, endedAt: endedAt.toISOString(), plannedSeconds, actualSeconds,
      focusedSeconds, completed, interrupted });

    const streakDays = this.database.getStreakDays(endedAt);
    const streakMultiplier = getStreakMultiplier(streakDays);
    if (phase === "focus") {
      if (completed && plannedSeconds >= FOCUS_COMPLETION_MINIMUM_SECONDS) {
        const awardId = `${sessionId}:focus-completion`;
        const awardedXp = this.database.awardXp(sessionId, "focus_completion", FOCUS_COMPLETION_XP, streakMultiplier, endedAt, awardId);
        const awardedSeeds = this.database.awardSeeds(sessionId, "focus_completion", FOCUS_COMPLETION_SEEDS, streakMultiplier, endedAt, awardId);
        this.emitReward("focus_completion", awardedXp, awardedSeeds);
      }
    } else if (completed) {
      const awardId = `${sessionId}:break-completion`;
      const awardedXp = this.database.awardXp(sessionId, "break_completion", BREAK_COMPLETION_XP, streakMultiplier, endedAt, awardId);
      const awardedSeeds = this.database.awardSeeds(sessionId, "break_completion", BREAK_COMPLETION_SEEDS, streakMultiplier, endedAt, awardId);
      this.emitReward("break_completion", awardedXp, awardedSeeds);
    }
    const earnings = this.database.getSessionEarnings(sessionId);
    this.database.updateSessionEarnings(sessionId, earnings.xp, earnings.seeds);
    if (phase === "focus") {
      const rewardableSeconds = this.snapshot.focusRewardRemainderSeconds + Math.min(focusedSeconds, plannedSeconds);
      this.snapshot = { ...this.snapshot, focusRewardRemainderSeconds: rewardableSeconds - this.snapshot.awardedFocusMinutes * 60 };
    }
    this.refreshProgression();
  }

  private awardCompletedFocusMinutes(focusedSeconds: number, at: Date) {
    if (this.snapshot.phase !== "focus" || !this.snapshot.activeSessionId) return;
    const sessionId = this.snapshot.activeSessionId;
    const plannedSeconds = getPhaseDurationSeconds(this.snapshot.preset, "focus");
    const cappedSeconds = Math.min(focusedSeconds, plannedSeconds);
    const carriedSeconds = this.snapshot.focusRewardRemainderSeconds;
    const completedMinutes = Math.max(0, Math.floor((carriedSeconds + cappedSeconds) / 60));
    if (completedMinutes <= this.snapshot.awardedFocusMinutes) return;
    let awardedXp = 0;
    let awardedSeeds = 0;
    for (let minute = this.snapshot.awardedFocusMinutes + 1; minute <= completedMinutes; minute += 1) {
      const secondsIntoSegment = Math.max(0, minute * 60 - carriedSeconds);
      const earnedAt = new Date(Math.min(at.getTime(), new Date(this.snapshot.startedAt ?? at).getTime() + secondsIntoSegment * 1_000));
      const streakMultiplier = getStreakMultiplier(this.database.getStreakDays(earnedAt));
      const awardId = `${sessionId}:focus-minute:${minute}`;
      const focusMultiplier = calculateFocusChainMultiplier(this.snapshot.focusChainMinutes);
      awardedXp += this.database.awardXp(sessionId, "focus_minutes", XP_PER_FOCUSED_MINUTE,
        focusMultiplier * streakMultiplier, earnedAt, awardId);
      awardedSeeds += this.database.awardSeeds(sessionId, "focus_minutes", SEEDS_PER_FOCUSED_MINUTE, streakMultiplier, earnedAt, awardId);
      this.snapshot = { ...this.snapshot, focusChainMinutes: this.snapshot.focusChainMinutes + 1 };
    }
    const currentMultiplier = calculateFocusChainMultiplier(this.snapshot.focusChainMinutes);
    this.snapshot = { ...this.snapshot, awardedFocusMinutes: completedMinutes, currentMultiplier,
      effectiveMultiplier: currentMultiplier * this.snapshot.streakMultiplier };
    this.emitReward("focus_minutes", awardedXp, awardedSeeds);
  }

  private emitReward(reason: RewardEvent["reason"], awardedXp: number, awardedSeeds: number) {
    if (awardedXp <= 0 && awardedSeeds <= 0) return;
    this.emit("reward", { id: crypto.randomUUID(), reason, awardedXp, awardedSeeds } satisfies RewardEvent);
  }

  private refreshDerivedState() {
    if (!isActive(this.snapshot.phase)) return;
    const now = Date.now();
    const endsAt = this.snapshot.endsAt ? new Date(this.snapshot.endsAt).getTime() : now;
    const startedAt = this.snapshot.startedAt ? new Date(this.snapshot.startedAt).getTime() : now;
    const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
    const accumulatedFocusSeconds = this.snapshot.phase === "focus" ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    const currentMultiplier = calculateFocusChainMultiplier(this.snapshot.focusChainMinutes);
    this.snapshot = { ...this.snapshot, remainingSeconds, accumulatedFocusSeconds, currentMultiplier,
      effectiveMultiplier: currentMultiplier * this.snapshot.streakMultiplier, petState: this.snapshot.phase === "focus" ? "working" : "playing" };
  }

  private refreshProgression() {
    const streakDays = this.database.getStreakDays();
    const streakMultiplier = getStreakMultiplier(streakDays);
    const currentMultiplier = calculateFocusChainMultiplier(this.snapshot.focusChainMinutes);
    this.snapshot = { ...this.snapshot, currentMultiplier, streakDays, streakMultiplier, effectiveMultiplier: currentMultiplier * streakMultiplier };
  }
  private emitAndPersist(force = true) { this.database.saveTimerState(this.snapshot); if (force || this.snapshot.phase !== "idle") this.emit("state", this.snapshot); }
}

function createIdleSnapshot(preset: TimerPreset, cycleCount = 0, streakDays = 0, focusChainMinutes = 0, focusRewardRemainderSeconds = 0): TimerSnapshot {
  const streakMultiplier = getStreakMultiplier(streakDays);
  const currentMultiplier = calculateFocusChainMultiplier(focusChainMinutes);
  return { phase: "idle", activePhase: null, pausedFromPhase: null, petState: "sleeping", preset, startedAt: null, endsAt: null,
    pausedAt: null, remainingSeconds: preset.focusMinutes * 60, accumulatedFocusSeconds: 0, awardedFocusMinutes: 0, focusRewardRemainderSeconds,
    focusChainMinutes, currentMultiplier, cycleCount,
    readyForNextPhase: null, activeSessionId: null, breakPromptId: null, pettingBonusAwarded: false,
    streakDays, streakMultiplier, effectiveMultiplier: currentMultiplier * streakMultiplier };
}

function isActive(phase: TimerSnapshot["phase"]): phase is ActiveTimerPhase { return phase === "focus" || phase === "short_break" || phase === "long_break"; }
function chooseBreakPrompt() { const ids = Object.keys(BREAK_PROMPTS); return ids[Math.floor(Math.random() * ids.length)]; }
