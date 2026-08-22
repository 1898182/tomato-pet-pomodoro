import { Power } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPhaseDurationSeconds } from "../../shared/timerPresets";
import type { AnalyticsOverview, AppSettings, ProgressionSummary, TimerPreset, TimerPresetDraft, TimerSnapshot } from "../../shared/types";
import { useTimerState } from "../hooks/useTimerState";
import { FAQTab } from "./FAQTab";
import { FocusRhythms } from "./FocusRhythms";

export { parseDurationInputValue } from "./FocusRhythms";

export function SettingsApp() {
  const timer = useTimerState();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [summary, setSummary] = useState<ProgressionSummary | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [presets, setPresets] = useState<TimerPreset[]>([]);
  const [tab, setTab] = useState<"settings" | "stats" | "faq">("settings");
  const [status, setStatus] = useState("Ready");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [quitConfirmationOpen, setQuitConfirmationOpen] = useState(false);
  const statusTimeoutRef = useRef<number | null>(null);
  const closeQuitConfirmation = useCallback(() => setQuitConfirmationOpen(false), []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    Promise.all([window.tomatoPet.settings.get(), window.tomatoPet.progression.getSummary(), window.tomatoPet.presets.list(), window.tomatoPet.analytics.getOverview(12)])
      .then(([nextSettings, nextSummary, nextPresets, nextAnalytics]) => {
        if (cancelled) return;
        setSettings(nextSettings);
        setSummary(nextSummary);
        setPresets(nextPresets);
        setAnalytics(nextAnalytics);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    const stopSettings = window.tomatoPet.settings.onChanged(setSettings);
    const stopProgression = window.tomatoPet.progression.onChanged(({ summary: nextSummary }) => setSummary(nextSummary));
    return () => {
      cancelled = true;
      stopSettings();
      stopProgression();
    };
  }, [loadAttempt]);

  useEffect(() => () => {
    if (statusTimeoutRef.current !== null) window.clearTimeout(statusTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!timer?.phase) return;
    Promise.all([window.tomatoPet.progression.getSummary(), window.tomatoPet.analytics.getOverview(12)]).then(([nextSummary, nextAnalytics]) => {
      setSummary(nextSummary); setAnalytics(nextAnalytics);
    });
  }, [timer?.phase, timer?.readyForNextPhase, timer?.pettingBonusAwarded]);

  const selectedPreset = useMemo(() => presets.find((preset) => preset.isDefault), [presets]);
  const timerActive = timer?.phase !== "idle";
  function showStatus(message: string) {
    if (statusTimeoutRef.current !== null) window.clearTimeout(statusTimeoutRef.current);
    setStatus(message);
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus("Ready");
      statusTimeoutRef.current = null;
    }, 1_600);
  }
  async function update(partial: Partial<AppSettings>) { try { setSettings(await window.tomatoPet.settings.update(partial)); showStatus("Saved"); } catch (error) { showStatus(errorMessage(error)); } }
  async function selectPreset(id: string) { if (timerActive) return showStatus("Stop timer first"); try { await window.tomatoPet.presets.select(id); setPresets(await window.tomatoPet.presets.list()); showStatus("Rhythm saved"); } catch (error) { showStatus(errorMessage(error)); } }
  async function createCustomPreset(draft: TimerPresetDraft) { if (timerActive) return "Stop the timer before creating a rhythm."; try { await window.tomatoPet.presets.create(draft); setPresets(await window.tomatoPet.presets.list()); showStatus("Custom rhythm created"); return null; } catch (error) { return errorMessage(error); } }
  async function removePreset(id: string) { if (timerActive) { showStatus("Stop timer first"); return false; } try { await window.tomatoPet.presets.remove(id); setPresets(await window.tomatoPet.presets.list()); showStatus("Rhythm removed"); return true; } catch (error) { showStatus(errorMessage(error)); return false; } }
  async function resetPresets() { if (timerActive) { showStatus("Stop timer first"); return false; } try { await window.tomatoPet.presets.reset(); setPresets(await window.tomatoPet.presets.list()); showStatus("Focus cycles reset"); return true; } catch (error) { showStatus(errorMessage(error)); return false; } }
  async function exportData() { await window.tomatoPet.data.copyExport(); showStatus("Preferences copied"); }
  async function importData() { if (timerActive) return showStatus("Stop timer first"); const text = window.prompt("Paste exported Tomato Pet preferences JSON"); if (!text) return;
    try { await window.tomatoPet.data.import(JSON.parse(text)); const [nextSettings, nextPresets] = await Promise.all([window.tomatoPet.settings.get(), window.tomatoPet.presets.list()]); setSettings(nextSettings); setPresets(nextPresets); showStatus("Preferences imported"); } catch (error) { showStatus(errorMessage(error)); } }

  if (loadError) {
    return <main className="settings-shell"><section className="settings-section" role="alert"><h1>Settings could not load</h1><p>{loadError}</p><button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button></section></main>;
  }
  if (!settings || !timer || !summary) return <main className="settings-shell"><p>Loading...</p></main>;
  const profile = summary.profile;
  const nextThreshold = summary.nextLevelThreshold ?? profile.totalXp;
  const levelSpan = summary.nextLevelThreshold ? summary.nextLevelThreshold - summary.currentLevelThreshold : 0;
  const progress = summary.nextLevelThreshold && levelSpan > 0
    ? Math.min(100, Math.max(0, (profile.totalXp - summary.currentLevelThreshold) / levelSpan * 100))
    : 100;

  return <main className="settings-shell">
    <header className="settings-header">
      <div><p className="eyebrow">Tomato Pet</p><h1>{tab === "settings" ? "Settings" : tab === "stats" ? "Stats" : "FAQ"}</h1></div>
      <nav className="settings-tabs" aria-label="Settings sections">
        <button className={tab === "settings" ? "is-active" : ""} onClick={() => setTab("settings")}>Settings</button>
        <button className={tab === "stats" ? "is-active" : ""} onClick={() => setTab("stats")}>Stats</button>
        <button className={tab === "faq" ? "is-active" : ""} onClick={() => setTab("faq")}>FAQ</button>
      </nav>
      <div className="settings-header-actions">
        <div className="status-pill">{status}</div>
        <button type="button" className="header-quit-button" title="Quit Tomato Pet" aria-label="Quit Tomato Pet" onClick={() => setQuitConfirmationOpen(true)}>
          <Power aria-hidden="true" />
        </button>
      </div>
    </header>

    <section className="settings-band timer-card">
      <div><p className="eyebrow">{timer.readyForNextPhase ? "Up next" : "Now"}</p><h2>{timerLabel(timer)}</h2><small>{selectedPreset?.name ?? timer.preset.name} rhythm</small></div>
      <strong className="settings-time">{formatRemaining(displaySeconds(timer))}</strong>
      <div className="xp-summary">
        <div className="xp-head"><span>{profile.totalXp.toLocaleString()} XP</span><small>Level {profile.currentLevel}</small></div>
        <div className="xp-progress"><span style={{ width: `${progress}%` }} /></div>
        <small>{summary.nextLevelThreshold ? `${profile.totalXp.toLocaleString()} / ${nextThreshold.toLocaleString()} XP` : "Maximum level reached"}</small>
        <span className="seed-balance">{profile.seedBalance.toLocaleString()} Seeds</span>
      </div>
      <div className="timer-card-actions">
        <button className={`timer-stop-button${isTimerStoppable(timer.phase) ? "" : " is-placeholder"}`} disabled={!isTimerStoppable(timer.phase)} aria-hidden={!isTimerStoppable(timer.phase)} tabIndex={isTimerStoppable(timer.phase) ? 0 : -1} onClick={() => window.tomatoPet.timer.stop()}>Stop</button>
        <button onClick={() => startPrimaryTimer(timer)}>{primaryActionLabel(timer)}</button>
      </div>
    </section>

    {tab === "settings" && <SettingsTab settings={settings} presets={presets} timerActive={timerActive}
      onUpdate={update} onSelectPreset={selectPreset} onCreatePreset={createCustomPreset} onRemovePreset={removePreset} onResetPresets={resetPresets}
      onExport={exportData} onImport={importData} />}
    {tab === "stats" && <StatsTab summary={summary} analytics={analytics} />}
    {tab === "faq" && <FAQTab />}
    {quitConfirmationOpen && <QuitConfirmation onCancel={closeQuitConfirmation} onConfirm={() => window.tomatoPet.app.quit()} />}
  </main>;
}

function SettingsTab(props: { settings: AppSettings; presets: TimerPreset[]; timerActive: boolean;
  onUpdate: (partial: Partial<AppSettings>) => void; onSelectPreset: (id: string) => void; onCreatePreset: (draft: TimerPresetDraft) => Promise<string | null>;
  onRemovePreset: (id: string) => Promise<boolean>; onResetPresets: () => Promise<boolean>; onExport: () => void; onImport: () => void }) {
  const { settings, presets, timerActive } = props;
  return <>
    <FocusRhythms presets={presets} timerActive={timerActive} onSelect={props.onSelectPreset} onCreate={props.onCreatePreset} onRemove={props.onRemovePreset} onReset={props.onResetPresets} />
    <section className="settings-grid">
      <Toggle label="Launch at startup" detail="Let the tomato appear when you sign in." checked={settings.launchAtStartup} onChange={(value) => props.onUpdate({ launchAtStartup: value })} />
      <Toggle label="Start next session automatically" detail="Begin the next focus or break immediately." checked={settings.autoStartNextSession} onChange={(value) => props.onUpdate({ autoStartNextSession: value })} />
      <Toggle label="Desktop notifications" detail="Show an alert when a session ends." checked={settings.notificationsEnabled} onChange={(value) => props.onUpdate({ notificationsEnabled: value })} />
      <Toggle label="Completion sound" detail="Play the operating-system completion sound." checked={settings.completionSoundsEnabled} onChange={(value) => props.onUpdate({ completionSoundsEnabled: value })} />
      <Toggle label="Pet interaction sounds" detail="Play a small pop when the tomato is poked." checked={settings.petSoundsEnabled} onChange={(value) => props.onUpdate({ petSoundsEnabled: value })} />
      <Toggle label="Hide pet during focus" detail="Use the compact corner timer while working." checked={settings.stealthFocusEnabled} onChange={(value) => props.onUpdate({ stealthFocusEnabled: value })} />
      <label className="setting-row audio-setting"><span><strong>Focus audio</strong><small>Automatically play during focus sessions.</small></span><input type="checkbox" checked={settings.focusAudioEnabled} onChange={(event) => props.onUpdate({ focusAudioEnabled: event.currentTarget.checked })} /></label>
      <label className="setting-row audio-options"><span><strong>Soundscape</strong><small>Brown noise or gentle rain.</small></span><select value={settings.focusAudioTrack} onChange={(event) => props.onUpdate({ focusAudioTrack: event.currentTarget.value as AppSettings["focusAudioTrack"] })}><option value="brown_noise">Brown noise</option><option value="gentle_rain">Gentle rain</option></select><input aria-label="Focus audio volume" type="range" min="0" max="1" step="0.05" value={settings.focusAudioVolume} onChange={(event) => props.onUpdate({ focusAudioVolume: Number(event.currentTarget.value) })} /></label>
    </section>
    <section className="settings-band data-band"><div><p className="eyebrow">Preferences backup</p><h2>Move settings between devices</h2><small>XP, Seeds, sessions, and progression are not included.</small></div><div className="data-actions"><button onClick={props.onExport}>Copy preferences</button><button disabled={timerActive} onClick={props.onImport}>Import preferences</button></div></section>
  </>;
}

function QuitConfirmation({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="quit-dialog-title" aria-describedby="quit-dialog-description">
      <div className="confirmation-icon"><Power aria-hidden="true" /></div>
      <div><p className="eyebrow">Exit application</p><h2 id="quit-dialog-title">Quit Tomato Pet?</h2><p id="quit-dialog-description">The application will close. Your timer state and local progress are already saved.</p></div>
      <div className="confirmation-actions"><button ref={cancelRef} type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" className="confirm-quit-button" onClick={onConfirm}><Power aria-hidden="true" />Quit Tomato Pet</button></div>
    </section>
  </div>;
}

function StatsTab({ summary, analytics }: { summary: ProgressionSummary; analytics: AnalyticsOverview | null }) {
  if (!analytics) return <section className="settings-section">Loading activity...</section>;
  const maxMinutes = Math.max(1, ...analytics.days.map((day) => day.focusedSeconds / 60));
  return <section className="stats-view">
    <div className="stats-metrics"><div><small>This week</small><strong>{formatHours(analytics.weekFocusedSeconds)}</strong><span>focused</span></div><div><small>Completed</small><strong>{analytics.weekCompletedSessions}</strong><span>focus sessions</span></div><div><small>Current streak</small><strong>{summary.streakDays}</strong><span>days</span></div></div>
    <div className="cap-grid"><CapMeter label="XP today" value={summary.xpToday} cap={summary.xpDailyCap} /><CapMeter label="Seeds today" value={summary.seedsToday} cap={summary.seedDailyCap} /></div>
    <div className="activity-panel"><div className="section-heading"><div><p className="eyebrow">Last 12 weeks</p><h2>Focus activity</h2></div><small>Darker days contain more focused minutes.</small></div>
      <div className="heatmap" aria-label="12 week focus activity">{analytics.days.map((day) => { const intensity = day.focusedSeconds === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((day.focusedSeconds / 60) / maxMinutes * 4))); return <span key={day.date} className={`heat-cell intensity-${intensity}`} title={`${day.date}: ${Math.round(day.focusedSeconds / 60)} focused minutes`} />; })}</div>
    </div>
  </section>;
}

function CapMeter({ label, value, cap }: { label: string; value: number; cap: number }) { return <div className="cap-meter"><div><strong>{label}</strong><span>{value.toLocaleString()} / {cap.toLocaleString()}</span></div><div><span style={{ width: `${Math.min(100, value / cap * 100)}%` }} /></div></div>; }
function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="setting-row"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} /></label>; }
function displaySeconds(timer: TimerSnapshot): number { return timer.readyForNextPhase ? getPhaseDurationSeconds(timer.preset, timer.readyForNextPhase) : timer.remainingSeconds; }
function timerLabel(timer: TimerSnapshot): string { if (timer.readyForNextPhase === "short_break") return "Short break"; if (timer.readyForNextPhase === "long_break") return "Long break"; if (timer.readyForNextPhase === "focus") return "Focus"; if (timer.phase === "focus") return "Working"; if (timer.phase === "short_break" || timer.phase === "long_break") return "Playing"; if (timer.phase === "paused") return "Paused"; return "Sleeping"; }
export function isTimerStoppable(phase: TimerSnapshot["phase"]): boolean { return phase !== "idle"; }
function primaryActionLabel(timer: TimerSnapshot): string { if (timer.phase === "paused") return "Resume"; if (timer.phase === "focus" || timer.phase === "short_break" || timer.phase === "long_break") return "Pause"; if (timer.readyForNextPhase === "focus") return "Start focus"; if (timer.readyForNextPhase) return "Start break"; return "Start focus"; }
function startPrimaryTimer(timer: TimerSnapshot): Promise<TimerSnapshot> { if (timer.phase === "paused") return window.tomatoPet.timer.resume(); if (timer.phase === "focus" || timer.phase === "short_break" || timer.phase === "long_break") return window.tomatoPet.timer.pause(); if (timer.readyForNextPhase === "focus" || !timer.readyForNextPhase) return window.tomatoPet.timer.startFocus(); return window.tomatoPet.timer.startBreak(timer.readyForNextPhase); }
function formatRemaining(totalSeconds: number): string { return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${Math.floor(totalSeconds % 60).toString().padStart(2, "0")}`; }
function formatHours(seconds: number): string { const hours = seconds / 3600; return hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Could not save"; }
