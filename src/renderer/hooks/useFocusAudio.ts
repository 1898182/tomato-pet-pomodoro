import { useEffect, useRef } from "react";
import type { AppSettings, TimerSnapshot } from "../../shared/types";

const FADE_DURATION_MS = 220;
const MAX_PLAYBACK_VOLUME = 0.4;

export function useFocusAudio(state: TimerSnapshot | null, settings: AppSettings | null): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    stopFade(fadeTimerRef);
    const shouldPlay = state?.phase === "focus" && settings?.focusAudioEnabled;
    if (!shouldPlay) {
      fadeTimerRef.current = fadeOutAudio(audioRef.current);
      return;
    }

    const source = getAudioSource(settings.focusAudioTrack);
    if (!audioRef.current || audioRef.current.src !== source) {
      audioRef.current?.pause();
      audioRef.current = new Audio(source);
      audioRef.current.loop = true;
      audioRef.current.preload = "auto";
    }

    audioRef.current.volume = toPlaybackVolume(settings.focusAudioVolume);
    void audioRef.current.play().catch((error: unknown) => {
      console.warn("Focus audio could not start.", error);
    });
  }, [settings?.focusAudioEnabled, settings?.focusAudioTrack, state?.phase]);

  useEffect(() => {
    if (audioRef.current && settings) audioRef.current.volume = toPlaybackVolume(settings.focusAudioVolume);
  }, [settings?.focusAudioVolume]);

  useEffect(() => () => {
    stopFade(fadeTimerRef);
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);
}

export function toPlaybackVolume(settingVolume: number): number {
  const normalized = Math.min(1, Math.max(0, settingVolume));
  return normalized * normalized * MAX_PLAYBACK_VOLUME;
}

function getAudioSource(track: AppSettings["focusAudioTrack"]): string {
  const fileName = track === "gentle_rain" ? "gentle-rain" : "brown-noise";
  return new URL(`./assets/audio/${fileName}.wav`, window.location.href).href;
}

function fadeOutAudio(audio: HTMLAudioElement | null): number | null {
  if (!audio || audio.paused) return null;
  const startVolume = audio.volume;
  const startedAt = performance.now();
  const timer = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / FADE_DURATION_MS);
    audio.volume = startVolume * (1 - progress);
    if (progress < 1) return;
    window.clearInterval(timer);
    audio.pause();
    audio.volume = startVolume;
  }, 25);
  return timer;
}

function stopFade(fadeTimerRef: React.RefObject<number | null>): void {
  if (fadeTimerRef.current === null) return;
  window.clearInterval(fadeTimerRef.current);
  fadeTimerRef.current = null;
}
