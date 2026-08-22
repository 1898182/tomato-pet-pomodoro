import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";
import { applyCappedAward, getLevelForXp, getLevelThreshold, getStreakMultiplier, MAX_LEVEL, SEED_DAILY_CAP, XP_DAILY_CAP } from "../../shared/progression";
import { validateSettingsUpdate } from "../../shared/settings";
import { MAX_VISIBLE_PRESETS, validatePresetDraft } from "../../shared/timerPresets";
import type { AnalyticsOverview, AppSettings, ExportEnvelope, ExportEnvelopeV3, PlayerProfile, ProgressionSummary, TimerPreset, TimerPresetDraft, TimerSnapshot } from "../../shared/types";

const DATABASE_SCHEMA_VERSION = 7;
const EXPORT_SCHEMA_VERSION = 3;
const DEFAULT_PROFILE_ID = "local-player";
const DEFAULT_PRESET_ID = "classic";

const DEFAULT_SETTINGS: AppSettings = {
  launchAtStartup: false,
  autoStartNextSession: true,
  notificationsEnabled: true,
  completionSoundsEnabled: true,
  petSoundsEnabled: true,
  stealthFocusEnabled: false,
  focusAudioEnabled: false,
  focusAudioTrack: "brown_noise",
  focusAudioVolume: 0.35
};

const BUILT_IN_PRESETS: TimerPreset[] = [
  { id: DEFAULT_PRESET_ID, name: "Classic", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4, isDefault: true, kind: "built_in" },
  { id: "extended", name: "Extended", focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20, longBreakEvery: 4, isDefault: false, kind: "built_in" },
  { id: "flow-52", name: "Flow 52", focusMinutes: 52, shortBreakMinutes: 17, longBreakMinutes: 30, longBreakEvery: 3, isDefault: false, kind: "built_in" },
  { id: "deep-work", name: "Deep work", focusMinutes: 90, shortBreakMinutes: 20, longBreakMinutes: 30, longBreakEvery: 2, isDefault: false, kind: "built_in" }
];

const DEFAULT_PRESET = BUILT_IN_PRESETS[0];

export class DatabaseService {
  private sql: SqlJsStatic | null = null;
  private db: Database | null = null;
  private transactionDepth = 0;

  constructor(private readonly dbPath = path.join(app.getPath("userData"), "tomato-pet.sqlite")) {}

  async init() {
    const locateFile = (file: string) => {
      const candidates = [
        path.join(app.getAppPath(), "node_modules", "sql.js", "dist", file),
        path.join(process.cwd(), "node_modules", "sql.js", "dist", file)
      ];
      return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
    };
    this.sql = await initSqlJs({ locateFile });
    const data = fs.existsSync(this.dbPath) ? fs.readFileSync(this.dbPath) : undefined;
    this.db = data ? new this.sql.Database(data) : new this.sql.Database();
    this.migrate();
    this.seed();
    this.recalculateProfileLevel();
    this.flush();
  }

  getSettings(): AppSettings {
    const rows = this.select<{ key: string; value_json: string }>("SELECT key, value_json FROM settings");
    const values = new Map(rows.map((row) => [row.key, JSON.parse(row.value_json)]));
    const volume = Number(values.get("focusAudioVolume"));
    return {
      launchAtStartup: values.get("launchAtStartup") === true,
      autoStartNextSession: values.get("autoStartNextSession") !== false,
      notificationsEnabled: values.get("notificationsEnabled") !== false,
      completionSoundsEnabled: values.get("completionSoundsEnabled") !== false,
      petSoundsEnabled: values.get("petSoundsEnabled") !== false,
      stealthFocusEnabled: values.get("stealthFocusEnabled") === true,
      focusAudioEnabled: values.get("focusAudioEnabled") === true,
      focusAudioTrack: values.get("focusAudioTrack") === "gentle_rain" ? "gentle_rain" : "brown_noise",
      focusAudioVolume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_SETTINGS.focusAudioVolume
    };
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    const next = { ...this.getSettings(), ...validateSettingsUpdate(partial) };
    for (const [key, value] of Object.entries(next)) {
      this.run("INSERT OR REPLACE INTO settings(key, value_json) VALUES (?, ?)", [key, JSON.stringify(value)]);
    }
    this.flush();
    return next;
  }

  getDefaultPreset() {
    return this.select<TimerPresetRow>("SELECT * FROM timer_presets WHERE is_default = 1 AND is_hidden = 0 LIMIT 1").map(mapPreset)[0] ?? DEFAULT_PRESET;
  }

  listPresets() {
    return this.select<TimerPresetRow>(
      "SELECT * FROM timer_presets WHERE is_hidden = 0 ORDER BY sort_order, created_at, name"
    ).map(mapPreset);
  }

  selectPreset(presetId: string) {
    const preset = this.select<TimerPresetRow>("SELECT * FROM timer_presets WHERE id = ? AND is_hidden = 0 LIMIT 1", [presetId]).map(mapPreset)[0];
    if (!preset) throw new Error(`Unknown timer preset: ${presetId}`);
    this.run("UPDATE timer_presets SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END", [presetId]);
    this.flush();
    return { ...preset, isDefault: true };
  }

  createCustomPreset(draft: TimerPresetDraft) {
    const valid = validatePresetDraft(draft);
    if (this.select<{ id: string }>("SELECT id FROM timer_presets WHERE lower(name) = lower(?) LIMIT 1", [valid.name]).length > 0) {
      throw new Error("A rhythm with that name already exists.");
    }
    if (this.listPresets().length >= MAX_VISIBLE_PRESETS) throw new Error("Delete a rhythm before creating another one.");
    const id = `custom-${crypto.randomUUID()}`;
    const sortOrder = (this.select<{ value: number }>("SELECT COALESCE(MAX(sort_order), 99) + 1 AS value FROM timer_presets")[0]?.value ?? 100);
    const now = new Date().toISOString();
    this.run(
      `INSERT INTO timer_presets(id, name, focus_minutes, short_break_minutes, long_break_minutes, long_break_every, is_default, kind, is_hidden, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'custom', 0, ?, ?)`,
      [id, valid.name, valid.focusMinutes, valid.shortBreakMinutes, valid.longBreakMinutes, valid.longBreakEvery, sortOrder, now]
    );
    this.flush();
    return this.select<TimerPresetRow>("SELECT * FROM timer_presets WHERE id = ?", [id]).map(mapPreset)[0];
  }

  removePreset(presetId: string) {
    const presets = this.listPresets();
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) throw new Error("That rhythm is not available.");
    if (presets.length <= 1) throw new Error("At least one focus rhythm must remain.");
    if (preset.kind === "built_in") this.run("UPDATE timer_presets SET is_hidden = 1, is_default = 0 WHERE id = ?", [presetId]);
    else this.run("DELETE FROM timer_presets WHERE id = ?", [presetId]);
    if (preset.isDefault) this.selectPreset(this.getFallbackPresetId());
    this.flush();
    return this.getDefaultPreset();
  }

  resetPresets() {
    this.run("DELETE FROM timer_presets WHERE kind = 'custom'");
    this.run("UPDATE timer_presets SET is_hidden = 0, is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE kind = 'built_in'", [DEFAULT_PRESET_ID]);
    this.flush();
    return this.getDefaultPreset();
  }

  getProfile(): PlayerProfile {
    const row = this.select<PlayerProfileRow>("SELECT * FROM player_profile WHERE id = ? LIMIT 1", [DEFAULT_PROFILE_ID])[0];
    if (!row) throw new Error("Player profile missing.");
    return mapProfile(row);
  }

  getProgressionSummary(at = new Date()): ProgressionSummary {
    const profile = this.getProfile();
    const streakDays = this.getStreakDays(at);
    return {
      profile,
      currentLevelThreshold: getLevelThreshold(profile.currentLevel),
      nextLevelThreshold: profile.currentLevel >= MAX_LEVEL ? null : getLevelThreshold(profile.currentLevel + 1),
      xpToday: this.getLedgerTotalForDay("xp_ledger", "final_xp", at), xpDailyCap: XP_DAILY_CAP,
      seedsToday: this.getLedgerTotalForDay("seed_ledger", "final_seeds", at), seedDailyCap: SEED_DAILY_CAP,
      streakDays, streakMultiplier: getStreakMultiplier(streakDays)
    };
  }

  getStreakDays(at = new Date()) {
    const qualified = new Set(this.select<{ ended_at: string }>("SELECT ended_at FROM sessions WHERE phase = 'focus' AND completed = 1").map((row) => localDateKey(new Date(row.ended_at))));
    const today = startLocalDay(at);
    const yesterday = addLocalDays(today, -1);
    let cursor = qualified.has(localDateKey(today)) ? today : qualified.has(localDateKey(yesterday)) ? yesterday : null;
    let count = 0;
    while (cursor && qualified.has(localDateKey(cursor))) { count += 1; cursor = addLocalDays(cursor, -1); }
    return count;
  }

  awardXp(sessionId: string, reason: string, baseXp: number, multiplier: number, at = new Date(), awardId?: string) {
    if (awardId && this.select<{ id: string }>("SELECT id FROM xp_ledger WHERE id = ? LIMIT 1", [awardId]).length > 0) return 0;
    const finalXp = applyCappedAward(baseXp, multiplier, this.getLedgerTotalForDay("xp_ledger", "final_xp", at), XP_DAILY_CAP);
    if (finalXp <= 0) return 0;
    this.run("INSERT INTO xp_ledger(id, session_id, reason, base_xp, multiplier, final_xp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [awardId ?? crypto.randomUUID(), sessionId, reason, baseXp, multiplier, finalXp, at.toISOString()]);
    const totalXp = this.getProfile().totalXp + finalXp;
    this.run("UPDATE player_profile SET total_xp = ?, current_level = ?, updated_at = ? WHERE id = ?",
      [totalXp, getLevelForXp(totalXp), at.toISOString(), DEFAULT_PROFILE_ID]);
    this.flush();
    return finalXp;
  }

  awardSeeds(sessionId: string, reason: string, baseSeeds: number, multiplier: number, at = new Date(), awardId?: string) {
    if (awardId && this.select<{ id: string }>("SELECT id FROM seed_ledger WHERE id = ? LIMIT 1", [awardId]).length > 0) return 0;
    const finalSeeds = applyCappedAward(baseSeeds, multiplier, this.getLedgerTotalForDay("seed_ledger", "final_seeds", at), SEED_DAILY_CAP);
    if (finalSeeds <= 0) return 0;
    this.run("INSERT INTO seed_ledger(id, session_id, reason, base_seeds, multiplier, final_seeds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [awardId ?? crypto.randomUUID(), sessionId, reason, baseSeeds, multiplier, finalSeeds, at.toISOString()]);
    this.run("UPDATE player_profile SET seed_balance = seed_balance + ?, updated_at = ? WHERE id = ?", [finalSeeds, at.toISOString(), DEFAULT_PROFILE_ID]);
    this.flush();
    return finalSeeds;
  }

  addSession(input: { id: string; phase: string; startedAt: string; endedAt: string; plannedSeconds: number; actualSeconds: number; focusedSeconds: number; completed: boolean; interrupted: boolean; taskText: string }) {
    this.run(
      `INSERT OR REPLACE INTO sessions(id, phase, started_at, ended_at, planned_seconds, actual_seconds, focused_seconds, completed, interrupted, xp_earned, seeds_earned, task_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT xp_earned FROM sessions WHERE id = ?), 0), COALESCE((SELECT seeds_earned FROM sessions WHERE id = ?), 0), ?)`,
      [input.id, input.phase, input.startedAt, input.endedAt, input.plannedSeconds, input.actualSeconds, input.focusedSeconds,
        input.completed ? 1 : 0, input.interrupted ? 1 : 0, input.id, input.id, input.taskText]
    );
    this.flush();
  }

  updateSessionEarnings(sessionId: string, xpEarned: number, seedsEarned: number) {
    this.run("UPDATE sessions SET xp_earned = ?, seeds_earned = ? WHERE id = ?", [xpEarned, seedsEarned, sessionId]);
    this.flush();
  }

  getSessionEarnings(sessionId: string) {
    const xp = this.select<{ amount: number }>("SELECT COALESCE(SUM(final_xp), 0) AS amount FROM xp_ledger WHERE session_id = ?", [sessionId])[0]?.amount ?? 0;
    const seeds = this.select<{ amount: number }>("SELECT COALESCE(SUM(final_seeds), 0) AS amount FROM seed_ledger WHERE session_id = ?", [sessionId])[0]?.amount ?? 0;
    return { xp, seeds };
  }

  getAnalyticsOverview(weeks = 12, at = new Date()): AnalyticsOverview {
    const safeWeeks = Math.min(52, Math.max(1, Math.floor(weeks)));
    const start = addLocalDays(startOfLocalWeek(at), -(safeWeeks - 1) * 7);
    const days = Array.from({ length: safeWeeks * 7 }, (_, index) => ({ date: localDateKey(addLocalDays(start, index)), focusedSeconds: 0, completedSessions: 0 }));
    const byDate = new Map(days.map((day) => [day.date, day]));
    for (const row of this.select<SessionAnalyticsRow>("SELECT ended_at, phase, focused_seconds, completed FROM sessions")) {
      const day = byDate.get(localDateKey(new Date(row.ended_at)));
      if (!day || row.phase !== "focus") continue;
      day.focusedSeconds += row.focused_seconds;
      if (row.completed === 1) day.completedSessions += 1;
    }
    const currentWeek = days.slice((safeWeeks - 1) * 7);
    return {
      weekFocusedSeconds: currentWeek.reduce((sum, day) => sum + day.focusedSeconds, 0),
      weekCompletedSessions: currentWeek.reduce((sum, day) => sum + day.completedSessions, 0), days
    };
  }

  saveTimerState(snapshot: TimerSnapshot) {
    this.run(
      `INSERT OR REPLACE INTO timer_state(id, phase, active_phase, paused_from_phase, started_at, ends_at, paused_at, remaining_seconds,
       accumulated_focus_seconds, awarded_focus_minutes, focus_reward_remainder_seconds, focus_chain_minutes, current_multiplier, cycle_count, ready_for_next_phase, preset_id, active_session_id, task_text, break_prompt_id, petting_bonus_awarded)
       VALUES ('singleton', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [snapshot.phase, snapshot.activePhase, snapshot.pausedFromPhase, snapshot.startedAt, snapshot.endsAt, snapshot.pausedAt,
        snapshot.remainingSeconds, snapshot.accumulatedFocusSeconds, snapshot.awardedFocusMinutes, snapshot.focusRewardRemainderSeconds, snapshot.focusChainMinutes,
        snapshot.currentMultiplier, snapshot.cycleCount, snapshot.readyForNextPhase,
        snapshot.preset.id, snapshot.activeSessionId, snapshot.taskText, snapshot.breakPromptId, snapshot.pettingBonusAwarded ? 1 : 0]
    );
    this.flush();
  }

  getTimerState(): TimerSnapshot | null {
    const row = this.select<TimerStateRow>("SELECT * FROM timer_state WHERE id = 'singleton' LIMIT 1")[0];
    if (!row) return null;
    const preset = this.getDefaultPreset();
    const streakDays = this.getStreakDays();
    const streakMultiplier = getStreakMultiplier(streakDays);
    return {
      phase: row.phase as TimerSnapshot["phase"], activePhase: row.active_phase as TimerSnapshot["activePhase"],
      pausedFromPhase: row.paused_from_phase as TimerSnapshot["pausedFromPhase"],
      petState: row.phase === "focus" ? "working" : row.phase === "short_break" || row.phase === "long_break" ? "playing" : "sleeping",
      preset, startedAt: row.started_at, endsAt: row.ends_at, pausedAt: row.paused_at, remainingSeconds: row.remaining_seconds,
      accumulatedFocusSeconds: row.accumulated_focus_seconds, awardedFocusMinutes: row.awarded_focus_minutes, focusRewardRemainderSeconds: row.focus_reward_remainder_seconds,
      focusChainMinutes: row.focus_chain_minutes,
      currentMultiplier: row.current_multiplier, cycleCount: row.cycle_count,
      readyForNextPhase: row.ready_for_next_phase as TimerSnapshot["readyForNextPhase"], activeSessionId: row.active_session_id,
      taskText: row.task_text ?? "", breakPromptId: row.break_prompt_id, pettingBonusAwarded: row.petting_bonus_awarded === 1,
      streakDays, streakMultiplier, effectiveMultiplier: row.current_multiplier * streakMultiplier
    };
  }

  getAvatarPosition() { return this.select<{ x: number; y: number; display_id: string | null }>("SELECT x, y, display_id FROM avatar_positions WHERE id = 'default' LIMIT 1")[0] ?? null; }
  saveAvatarPosition(x: number, y: number, displayId: string | null) {
    this.run("INSERT OR REPLACE INTO avatar_positions(id, x, y, display_id, updated_at) VALUES ('default', ?, ?, ?, ?)", [x, y, displayId, new Date().toISOString()]); this.flush();
  }

  exportData(): ExportEnvelopeV3 {
    const customPresets = this.select<TimerPresetRow>("SELECT * FROM timer_presets WHERE kind = 'custom' ORDER BY sort_order, created_at").map(mapPreset);
    const hiddenBuiltInPresetIds = this.select<{ id: string }>("SELECT id FROM timer_presets WHERE kind = 'built_in' AND is_hidden = 1 ORDER BY sort_order").map((row) => row.id);
    return { schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), settings: this.getSettings(), selectedPresetId: this.getDefaultPreset().id,
      hiddenBuiltInPresetIds, customPresets, avatarPositions: this.select("SELECT * FROM avatar_positions") };
  }
  importData(payload: ExportEnvelope) {
    if (payload.schemaVersion !== 2 && payload.schemaVersion !== 3) throw new Error(`Unsupported import schema version: ${(payload as { schemaVersion?: unknown }).schemaVersion}`);
    const normalized = normalizeImportEnvelope(payload);
    if (!normalized.settings || typeof normalized.settings !== "object") throw new Error("Import settings are missing.");
    if (!Array.isArray(normalized.hiddenBuiltInPresetIds) || !Array.isArray(normalized.customPresets)) throw new Error("Import focus rhythms are missing.");
    const builtInIds = new Set(BUILT_IN_PRESETS.map((preset) => preset.id));
    if (normalized.hiddenBuiltInPresetIds.some((id) => !builtInIds.has(id))) throw new Error("Import contains an unknown built-in rhythm.");
    if (new Set(normalized.hiddenBuiltInPresetIds).size !== normalized.hiddenBuiltInPresetIds.length) throw new Error("Import contains duplicate hidden rhythms.");
    const names = new Set(BUILT_IN_PRESETS.map((preset) => preset.name.toLocaleLowerCase()));
    const customIds = new Set<string>();
    for (const preset of normalized.customPresets) {
      validatePresetDraft(preset);
      if (!preset.id || builtInIds.has(preset.id) || customIds.has(preset.id)) throw new Error("Import contains an invalid custom rhythm ID.");
      const normalizedName = preset.name.trim().toLocaleLowerCase();
      if (names.has(normalizedName)) throw new Error("Import contains duplicate rhythm names.");
      names.add(normalizedName);
      customIds.add(preset.id);
    }
    const visibleBuiltIns = BUILT_IN_PRESETS.length - normalized.hiddenBuiltInPresetIds.length;
    if (visibleBuiltIns + normalized.customPresets.length > MAX_VISIBLE_PRESETS) throw new Error("Import contains more than four visible rhythms.");
    const selectedIsVisibleBuiltIn = builtInIds.has(normalized.selectedPresetId) && !normalized.hiddenBuiltInPresetIds.includes(normalized.selectedPresetId);
    if (!selectedIsVisibleBuiltIn && !customIds.has(normalized.selectedPresetId)) throw new Error(`Unknown timer preset: ${normalized.selectedPresetId}`);
    const importedPosition = Array.isArray(normalized.avatarPositions)
      ? normalized.avatarPositions.find((entry): entry is { x: number; y: number; display_id?: string | null } => Boolean(entry) && typeof entry === "object" && Number.isFinite((entry as { x?: unknown }).x) && Number.isFinite((entry as { y?: unknown }).y))
      : undefined;

    this.exec("BEGIN TRANSACTION");
    this.transactionDepth += 1;
    try {
      this.updateSettings(normalized.settings);
      this.run("DELETE FROM timer_presets WHERE kind = 'custom'");
      this.run("UPDATE timer_presets SET is_hidden = 0, is_default = 0 WHERE kind = 'built_in'");
      for (const id of normalized.hiddenBuiltInPresetIds) this.run("UPDATE timer_presets SET is_hidden = 1 WHERE id = ?", [id]);
      normalized.customPresets.forEach((preset, index) => this.run(
        `INSERT INTO timer_presets(id, name, focus_minutes, short_break_minutes, long_break_minutes, long_break_every, is_default, kind, is_hidden, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'custom', 0, ?, ?)`,
        [preset.id, preset.name.trim(), preset.focusMinutes, preset.shortBreakMinutes, preset.longBreakMinutes, preset.longBreakEvery, 100 + index, new Date().toISOString()]
      ));
      this.selectPreset(normalized.selectedPresetId);
      if (importedPosition) this.saveAvatarPosition(importedPosition.x, importedPosition.y, importedPosition.display_id ?? null);
      this.exec("COMMIT");
      this.transactionDepth -= 1;
      this.flush();
      return this.exportData();
    } catch (error) {
      this.exec("ROLLBACK");
      this.transactionDepth -= 1;
      this.flush();
      throw error;
    }
  }
  close() { this.flush(); this.db?.close(); }

  private getLedgerTotalForDay(table: "xp_ledger" | "seed_ledger", column: "final_xp" | "final_seeds", at: Date) {
    const key = localDateKey(at);
    return this.select<{ amount: number; created_at: string }>(`SELECT ${column} AS amount, created_at FROM ${table}`)
      .filter((row) => localDateKey(new Date(row.created_at)) === key).reduce((sum, row) => sum + row.amount, 0);
  }
  private recalculateProfileLevel() {
    const row = this.select<{ total_xp: number }>("SELECT total_xp FROM player_profile WHERE id = ?", [DEFAULT_PROFILE_ID])[0];
    if (row) this.run("UPDATE player_profile SET current_level = ? WHERE id = ?", [getLevelForXp(row.total_xp), DEFAULT_PROFILE_ID]);
  }
  private getFallbackPresetId() {
    const classic = this.select<{ id: string }>("SELECT id FROM timer_presets WHERE id = ? AND is_hidden = 0 LIMIT 1", [DEFAULT_PRESET_ID])[0];
    if (classic) return classic.id;
    const fallback = this.select<{ id: string }>("SELECT id FROM timer_presets WHERE is_hidden = 0 ORDER BY sort_order, created_at LIMIT 1")[0];
    if (!fallback) throw new Error("At least one focus rhythm must remain.");
    return fallback.id;
  }
  private migrate() {
    this.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS timer_presets(id TEXT PRIMARY KEY, name TEXT NOT NULL, focus_minutes INTEGER NOT NULL, short_break_minutes INTEGER NOT NULL, long_break_minutes INTEGER NOT NULL, long_break_every INTEGER NOT NULL, is_default INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS timer_state(id TEXT PRIMARY KEY, phase TEXT NOT NULL, active_phase TEXT, paused_from_phase TEXT, started_at TEXT, ends_at TEXT, paused_at TEXT, remaining_seconds INTEGER NOT NULL, accumulated_focus_seconds INTEGER NOT NULL, current_multiplier REAL NOT NULL, cycle_count INTEGER NOT NULL, ready_for_next_phase TEXT, preset_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, phase TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT NOT NULL, planned_seconds INTEGER NOT NULL, actual_seconds INTEGER NOT NULL, focused_seconds INTEGER NOT NULL, completed INTEGER NOT NULL, interrupted INTEGER NOT NULL, xp_earned INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS xp_ledger(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, reason TEXT NOT NULL, base_xp INTEGER NOT NULL, multiplier REAL NOT NULL, final_xp INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS seed_ledger(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, reason TEXT NOT NULL, base_seeds INTEGER NOT NULL, multiplier REAL NOT NULL, final_seeds INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS player_profile(id TEXT PRIMARY KEY, active_pet_id TEXT NOT NULL, total_xp INTEGER NOT NULL, current_level INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pets(id TEXT PRIMARY KEY, unlocked INTEGER NOT NULL, unlocked_at TEXT);
      CREATE TABLE IF NOT EXISTS inventory_items(id TEXT PRIMARY KEY, item_id TEXT NOT NULL, equipped_slot TEXT, acquired_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS avatar_positions(id TEXT PRIMARY KEY, x INTEGER NOT NULL, y INTEGER NOT NULL, display_id TEXT, updated_at TEXT NOT NULL);
      DELETE FROM settings WHERE key IN ('idleResetMinutes', 'xpPerMinute');
    `);
    this.ensureColumn("player_profile", "seed_balance", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("timer_state", "active_session_id", "TEXT");
    this.ensureColumn("timer_state", "task_text", "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn("timer_state", "break_prompt_id", "TEXT");
    this.ensureColumn("timer_state", "petting_bonus_awarded", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("timer_state", "awarded_focus_minutes", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("timer_state", "focus_reward_remainder_seconds", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("timer_state", "focus_chain_minutes", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("sessions", "seeds_earned", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("sessions", "task_text", "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn("timer_presets", "kind", "TEXT NOT NULL DEFAULT 'custom'");
    this.ensureColumn("timer_presets", "is_hidden", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("timer_presets", "sort_order", "INTEGER NOT NULL DEFAULT 100");
    this.ensureColumn("timer_presets", "created_at", "TEXT NOT NULL DEFAULT ''");
    BUILT_IN_PRESETS.forEach((preset, index) => this.run("UPDATE timer_presets SET kind = 'built_in', sort_order = ? WHERE id = ?", [index, preset.id]));
    this.enforceLegacyPresetCapacity();
    this.run("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)", [DATABASE_SCHEMA_VERSION, new Date().toISOString()]);
  }
  private enforceLegacyPresetCapacity() {
    const visible = this.select<TimerPresetRow>("SELECT * FROM timer_presets WHERE is_hidden = 0 ORDER BY sort_order DESC");
    if (visible.length <= MAX_VISIBLE_PRESETS) return;
    const selectedId = visible.find((preset) => preset.is_default === 1)?.id;
    const candidates = visible.filter((preset) => preset.kind === "built_in" && preset.id !== selectedId);
    for (const preset of candidates.slice(0, visible.length - MAX_VISIBLE_PRESETS)) this.run("UPDATE timer_presets SET is_hidden = 1 WHERE id = ?", [preset.id]);
  }
  private ensureColumn(table: string, column: string, definition: string) {
    if (!this.select<{ name: string }>(`PRAGMA table_info(${table})`).some((entry) => entry.name === column)) this.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  private seed() {
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) this.run("INSERT OR IGNORE INTO settings(key, value_json) VALUES (?, ?)", [key, JSON.stringify(value)]);
    for (const [index, preset] of BUILT_IN_PRESETS.entries()) this.run("INSERT OR IGNORE INTO timer_presets(id, name, focus_minutes, short_break_minutes, long_break_minutes, long_break_every, is_default, kind, is_hidden, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'built_in', 0, ?, ?)",
      [preset.id, preset.name, preset.focusMinutes, preset.shortBreakMinutes, preset.longBreakMinutes, preset.longBreakEvery, preset.isDefault ? 1 : 0, index, now]);
    this.run("INSERT OR IGNORE INTO player_profile(id, active_pet_id, total_xp, current_level, seed_balance, created_at, updated_at) VALUES (?, 'tomato', 0, 1, 0, ?, ?)", [DEFAULT_PROFILE_ID, now, now]);
    this.run("INSERT OR IGNORE INTO pets(id, unlocked, unlocked_at) VALUES ('tomato', 1, ?)", [now]);
  }
  private get database(): Database { if (!this.db) throw new Error("Database has not been initialized."); return this.db; }
  private exec(sql: string) { this.database.exec(sql); }
  private run(sql: string, params: SqlValue[] = []) { const statement = this.database.prepare(sql); try { statement.run(params); } finally { statement.free(); } }
  private select<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
    const statement = this.database.prepare(sql); try { statement.bind(params); const rows: T[] = []; while (statement.step()) rows.push(statement.getAsObject() as T); return rows; } finally { statement.free(); }
  }
  private flush() { if (!this.db || this.transactionDepth > 0) return; fs.mkdirSync(path.dirname(this.dbPath), { recursive: true }); fs.writeFileSync(this.dbPath, Buffer.from(this.db.export())); }
}

type TimerPresetRow = { id: string; name: string; focus_minutes: number; short_break_minutes: number; long_break_minutes: number; long_break_every: number; is_default: number; kind: string; is_hidden: number; sort_order: number; created_at: string };
type PlayerProfileRow = { id: string; active_pet_id: string; total_xp: number; current_level: number; seed_balance: number; created_at: string; updated_at: string };
type TimerStateRow = { phase: string; active_phase: string | null; paused_from_phase: string | null; started_at: string | null; ends_at: string | null; paused_at: string | null; remaining_seconds: number; accumulated_focus_seconds: number; awarded_focus_minutes: number; focus_reward_remainder_seconds: number; focus_chain_minutes: number; current_multiplier: number; cycle_count: number; ready_for_next_phase: string | null; active_session_id: string | null; task_text: string; break_prompt_id: string | null; petting_bonus_awarded: number };
type SessionAnalyticsRow = { ended_at: string; phase: string; focused_seconds: number; completed: number };

function mapPreset(row: TimerPresetRow): TimerPreset { return { id: row.id, name: row.name, focusMinutes: row.focus_minutes, shortBreakMinutes: row.short_break_minutes, longBreakMinutes: row.long_break_minutes, longBreakEvery: row.long_break_every, isDefault: row.is_default === 1, kind: row.kind === "built_in" ? "built_in" : "custom" }; }
function mapProfile(row: PlayerProfileRow): PlayerProfile { return { id: row.id, activePetId: row.active_pet_id, totalXp: row.total_xp, seedBalance: row.seed_balance, currentLevel: row.current_level, createdAt: row.created_at, updatedAt: row.updated_at }; }
function startLocalDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12); }
function addLocalDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function startOfLocalWeek(date: Date) { const day = startLocalDay(date); return addLocalDays(day, -((day.getDay() + 6) % 7)); }

function normalizeImportEnvelope(payload: ExportEnvelope): ExportEnvelopeV3 {
  if (payload.schemaVersion === 3) return payload;
  const customPreset = payload.customPreset
    ? [{ ...payload.customPreset, name: payload.customPreset.name?.trim() || "Custom", kind: "custom" as const }]
    : [];
  const hiddenBuiltInPresetIds = customPreset.length > 0
    ? [payload.selectedPresetId === "deep-work" ? "flow-52" : "deep-work"]
    : [];
  return {
    schemaVersion: 3,
    exportedAt: payload.exportedAt,
    settings: payload.settings,
    selectedPresetId: payload.selectedPresetId,
    hiddenBuiltInPresetIds,
    customPresets: customPreset,
    avatarPositions: payload.avatarPositions
  };
}
