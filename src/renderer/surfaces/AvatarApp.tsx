import "pixi.js/unsafe-eval";
import { Application, Assets, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { Pause, Power, Square, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PetManifest } from "../../shared/petManifest";
import { validatePetManifest } from "../../shared/petManifest";
import { getPhaseDurationSeconds } from "../../shared/timerPresets";
import type { AppSettings, AvatarDisplayMode, PetState, RewardEvent, TimerSnapshot } from "../../shared/types";
import { BREAK_PROMPTS } from "../../shared/wellness";
import { usePetGesture, useWindowDragGesture } from "../hooks/useAvatarGestures";
import { useFocusAudio } from "../hooks/useFocusAudio";
import { useInteractiveRegions } from "../hooks/useInteractiveRegions";
import { useTimerState } from "../hooks/useTimerState";

export function AvatarApp() {
  const state = useTimerState();
  const [mode, setMode] = useState<AvatarDisplayMode>("full");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [rewards, setRewards] = useState<RewardEvent[]>([]);
  const rewardTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    Promise.all([window.tomatoPet.avatar.getMode(), window.tomatoPet.settings.get()]).then(([nextMode, nextSettings]) => {
      setMode(nextMode); setSettings(nextSettings);
    });
    const stopMode = window.tomatoPet.avatar.onMode(setMode);
    const stopSettings = window.tomatoPet.settings.onChanged(setSettings);
    const stopProgression = window.tomatoPet.progression.onChanged(({ reward }) => {
      if (reward.awardedXp <= 0) return;
      setRewards((current) => [...current, reward].slice(-3));
      rewardTimeoutsRef.current.push(window.setTimeout(() => {
        setRewards((current) => current.filter((item) => item.id !== reward.id));
      }, 1_500));
    });
    window.tomatoPet.progression.rendererReady();
    return () => {
      stopMode(); stopSettings(); stopProgression();
      rewardTimeoutsRef.current.forEach(window.clearTimeout);
      rewardTimeoutsRef.current = [];
    };
  }, []);

  useFocusAudio(state, settings);

  if (!state || !settings) return null;
  if (mode === "mini") {
    return <MiniTimer state={state} settings={settings} rewards={rewards} />;
  }
  return <FullAvatar state={state} settings={settings} rewards={rewards} />;
}

function FullAvatar({ state, settings, rewards }: { state: TimerSnapshot; settings: AppSettings; rewards: RewardEvent[] }) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragTargetRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<Sprite | null>(null);
  const animationTexturesRef = useRef<Record<PetState, Texture[]> | null>(null);
  const appRef = useRef<Application | null>(null);
  const petStateRef = useRef<PetState>(state.petState);
  const pokeStartedRef = useRef(0);
  const [bubbleOpen, setBubbleOpen] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  petStateRef.current = state.petState;

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const container = containerRef.current;
      if (!container) return;
      try {
        const bundle = await window.tomatoPet.assets.getPet("tomato");
        const manifest = validatePetManifest(bundle.manifest);
        const app = new Application();
        await app.init({ backgroundAlpha: 0, antialias: true, resizeTo: container });
        if (cancelled) { app.destroy(); return; }
        container.appendChild(app.canvas);
        appRef.current = app;
        const texture = await Assets.load(bundle.spriteSheetDataUrl);
        const animations = createAnimationTextures(manifest, texture);
        animationTexturesRef.current = animations;
        const sprite = new Sprite(animations.sleeping[0]);
        sprite.anchor.set(0.5); sprite.x = 132; sprite.y = 142; sprite.scale.set(0.5);
        app.stage.addChild(sprite); spriteRef.current = sprite;
        app.ticker.add((ticker) => {
          const definition = manifest.states[petStateRef.current];
          const frames = animations[petStateRef.current];
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          sprite.texture = frames[reduced ? 0 : Math.floor(ticker.lastTime / definition.frameDurationMs) % frames.length];
          const elapsed = performance.now() - pokeStartedRef.current;
          const progress = elapsed >= 0 && elapsed < 420 && !reduced ? elapsed / 420 : -1;
          const bounce = progress >= 0 ? Math.sin(progress * Math.PI) : 0;
          sprite.y = 142 - bounce * 18;
          sprite.scale.set(0.5 + bounce * 0.025, 0.5 - bounce * 0.018);
        });
      } catch (error) { if (!cancelled) setLoadError(error instanceof Error ? error.message : "The pet could not be loaded."); }
    }
    setup();
    return () => { cancelled = true; appRef.current?.destroy(true); appRef.current = null; spriteRef.current = null; };
  }, []);

  const poke = useCallback(() => {
    pokeStartedRef.current = performance.now();
    if (settings.petSoundsEnabled) playPopSound();
    if (state.phase === "short_break" || state.phase === "long_break") {
      spawnHearts(appRef.current);
      window.tomatoPet.progression.petCurrentBreak();
    }
  }, [settings.petSoundsEnabled, state.phase]);

  const toggleBubbles = useCallback(() => {
    const shouldOpen = !bubbleOpen;
    setBubbleOpen(shouldOpen);
    setControlsOpen(shouldOpen);
  }, [bubbleOpen]);
  const toggleControls = useCallback(() => setControlsOpen((value) => !value), []);
  useEffect(() => { window.tomatoPet.avatar.setExpanded(bubbleOpen); }, [bubbleOpen]);
  usePetGesture(dragTargetRef, poke, toggleBubbles);
  useInteractiveRegions(surfaceRef);

  return (
    <main ref={surfaceRef} className="avatar-surface">
      <RewardToasts rewards={rewards} />
      <div ref={containerRef} className="avatar-canvas" />
      <div ref={dragTargetRef} className="avatar-drag-target" data-avatar-interactive aria-label="Tomato pet" />
      {loadError && <p className="avatar-error" data-avatar-interactive>Pet failed to load<br /><small>{loadError}</small></p>}
      {bubbleOpen && <TimerBubble state={state} settings={settings} controlsOpen={controlsOpen} onToggleControls={toggleControls} />}
    </main>
  );
}

function TimerBubble({ state, settings, controlsOpen, onToggleControls }: { state: TimerSnapshot; settings: AppSettings; controlsOpen: boolean; onToggleControls: () => void }) {
  const bubbleRef = useRef<HTMLElement | null>(null);
  const promptRef = useRef<HTMLElement | null>(null);
  const actionsRef = useRef<HTMLElement | null>(null);
  const [task, setTask] = useState(state.taskText);
  useEffect(() => setTask(state.taskText), [state.taskText]);
  const ready = state.readyForNextPhase;
  const displaySeconds = ready ? getPhaseDurationSeconds(state.preset, ready) : state.remainingSeconds;
  const prompt = state.phase === "short_break" && state.breakPromptId ? BREAK_PROMPTS[state.breakPromptId as keyof typeof BREAK_PROMPTS] : null;
  function saveTask() { if (task.trim() !== state.taskText) window.tomatoPet.timer.updateTask(task); }
  useWindowDragGesture(bubbleRef, onToggleControls);
  useWindowDragGesture(promptRef, ignoreBubbleClick, Boolean(prompt));
  useWindowDragGesture(actionsRef, ignoreBubbleClick);
  return (
    <div className="bubble-stack">
      {prompt && <section ref={promptRef} className="break-prompt-bubble" data-avatar-interactive aria-label="Short break suggestion">
        <p>{prompt}</p>
      </section>}
      <section ref={bubbleRef} className="timer-bubble" data-avatar-interactive aria-label="Timer; click for actions or drag to move">
        <div className="bubble-summary">
          <p className="bubble-label">{labelForPhase(state)}</p>
          <strong className="bubble-time">{formatRemaining(displaySeconds)}</strong>
          <span className="multiplier-pill" title={`Focus chain ${state.currentMultiplier.toFixed(2)}x × streak ${state.streakMultiplier.toFixed(2)}x`}>
            {state.effectiveMultiplier.toFixed(2)}x XP
          </span>
        </div>
        <label className="task-anchor" onClick={(event) => event.stopPropagation()}>
          <span>Working on:</span>
          <input value={task} maxLength={80} placeholder="Add a focus task" onChange={(event) => setTask(event.currentTarget.value)} onBlur={saveTask}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setTask(state.taskText); event.currentTarget.blur(); } }} />
        </label>
      </section>
      <div className={`bubble-controls-shell${controlsOpen ? " is-open" : ""}`} data-avatar-interactive={controlsOpen ? "" : undefined} aria-hidden={!controlsOpen}>
        <div className="bubble-controls-clip">
          <section ref={actionsRef} className="action-bubble" aria-label="Timer actions">
            <div className="bubble-actions" onClick={(event) => event.stopPropagation()}>
              {state.phase === "idle" && !ready && <button tabIndex={controlsOpen ? 0 : -1} onClick={() => window.tomatoPet.timer.startFocus()}>Start</button>}
              {ready && <button tabIndex={controlsOpen ? 0 : -1} onClick={() => startReadyPhase(ready)}>Start {ready === "focus" ? "focus" : "break"}</button>}
              {(state.phase === "focus" || state.phase === "short_break" || state.phase === "long_break") && <button tabIndex={controlsOpen ? 0 : -1} onClick={() => window.tomatoPet.timer.pause()}>Pause</button>}
              {state.phase === "paused" && <button tabIndex={controlsOpen ? 0 : -1} onClick={() => window.tomatoPet.timer.resume()}>Resume</button>}
              {state.phase !== "idle" && <button tabIndex={controlsOpen ? 0 : -1} onClick={() => window.tomatoPet.timer.stop()}>Stop</button>}
              <button tabIndex={controlsOpen ? 0 : -1} title="Toggle ambient focus sound" onClick={() => window.tomatoPet.settings.update({ focusAudioEnabled: !settings.focusAudioEnabled })}>{settings.focusAudioEnabled ? "Mute sound" : "Ambient sound"}</button>
              <button tabIndex={controlsOpen ? 0 : -1} onClick={() => window.tomatoPet.settings.open()}>Settings</button>
              <button type="button" className="action-icon-button" tabIndex={controlsOpen ? 0 : -1} title="Quit Tomato Pet" aria-label="Quit Tomato Pet" onClick={() => window.tomatoPet.app.quit()}><Power aria-hidden="true" /></button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MiniTimer({ state, settings, rewards }: { state: TimerSnapshot; settings: AppSettings; rewards: RewardEvent[] }) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  useInteractiveRegions(surfaceRef);
  return <main ref={surfaceRef} className="mini-timer" data-avatar-interactive aria-label={`Focus timer, ${formatRemaining(state.remainingSeconds)} remaining`}>
    <RewardToasts rewards={rewards} compact />
    <strong>{formatRemaining(state.remainingSeconds)}</strong>
    <div className="mini-actions">
      <button type="button" title="Pause timer" aria-label="Pause timer" onClick={() => window.tomatoPet.timer.pause()}><Pause aria-hidden="true" /></button>
      <button type="button" title="Stop timer" aria-label="Stop timer" onClick={() => window.tomatoPet.timer.stop()}><Square aria-hidden="true" /></button>
      <button type="button" title={settings.focusAudioEnabled ? "Mute ambient focus sound" : "Enable ambient focus sound"} aria-label={settings.focusAudioEnabled ? "Mute ambient focus sound" : "Enable ambient focus sound"}
        onClick={() => window.tomatoPet.settings.update({ focusAudioEnabled: !settings.focusAudioEnabled })}>
        {settings.focusAudioEnabled ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      </button>
    </div>
  </main>;
}

function RewardToasts({ rewards, compact = false }: { rewards: RewardEvent[]; compact?: boolean }) {
  return <div className={`reward-toast-layer${compact ? " is-compact" : ""}`} aria-live="polite" aria-atomic="false">
    {rewards.map((reward, index) => <span key={reward.id} className="reward-toast" style={{ "--reward-index": index } as React.CSSProperties}>+{reward.awardedXp} XP</span>)}
  </div>;
}

function createAnimationTextures(manifest: PetManifest, baseTexture: Texture): Record<PetState, Texture[]> {
  return Object.fromEntries((Object.keys(manifest.states) as PetState[]).map((petState) => [petState,
    manifest.states[petState].frames.map((frame) => new Texture({ source: baseTexture.source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }))])) as Record<PetState, Texture[]>;
}

function spawnHearts(app: Application | null) {
  if (!app || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let index = 0; index < 5; index += 1) {
    const heart = new Graphics().moveTo(0, 5).bezierCurveTo(-12, -4, -9, -14, 0, -7).bezierCurveTo(9, -14, 12, -4, 0, 5).fill({ color: 0xef476f, alpha: 0.9 });
    heart.x = 105 + index * 13; heart.y = 112 + (index % 2) * 10; heart.scale.set(0.45 + index * 0.04); app.stage.addChild(heart);
    const start = performance.now();
    const animate = () => { const p = (performance.now() - start) / 900; heart.y -= 0.8; heart.x += Math.sin(p * 8 + index) * 0.5; heart.alpha = 1 - p;
      if (p >= 1) { app.ticker.remove(animate); heart.destroy(); } };
    app.ticker.add(animate);
  }
}

function playPopSound() {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.type = "sine"; oscillator.frequency.setValueAtTime(520, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(220, context.currentTime + 0.09);
  gain.gain.setValueAtTime(0.08, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
  oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.11); oscillator.onended = () => context.close();
}

function startReadyPhase(phase: TimerSnapshot["readyForNextPhase"]) { if (phase === "focus") window.tomatoPet.timer.startFocus(); else if (phase) window.tomatoPet.timer.startBreak(phase); }

function ignoreBubbleClick() {}

function labelForPhase(state: TimerSnapshot) {
  if (state.readyForNextPhase === "short_break") return "Next: short break";
  if (state.readyForNextPhase === "long_break") return "Next: long break";
  if (state.readyForNextPhase === "focus") return "Next: focus";
  if (state.phase === "focus") return "Focus"; if (state.phase === "short_break") return "Short break";
  if (state.phase === "long_break") return "Long break"; if (state.phase === "paused") return "Paused"; return "Idle";
}
function formatRemaining(totalSeconds: number) { const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0"); const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0"); return `${minutes}:${seconds}`; }
