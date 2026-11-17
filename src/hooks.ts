import { useEffect, useRef, useState } from 'react';

/* ---------- Hash router with a depth counter so in-app Back never leaves the app ---------- */

function currentPath() {
  return location.hash.replace(/^#\/?/, '');
}

export function useRoute(): string[] {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const sync = () => setPath(currentPath());
    addEventListener('hashchange', sync);
    addEventListener('popstate', sync);
    return () => {
      removeEventListener('hashchange', sync);
      removeEventListener('popstate', sync);
    };
  }, []);
  return path.split('/').filter(Boolean);
}

export function go(path: string, opts: { replace?: boolean } = {}) {
  const depth = (history.state?.depth as number | undefined) ?? 0;
  const url = '#/' + path;
  if (opts.replace) history.replaceState({ depth }, '', url);
  else history.pushState({ depth: depth + 1 }, '', url);
  dispatchEvent(new PopStateEvent('popstate'));
}

export function back(fallback = '') {
  if ((history.state?.depth ?? 0) > 0) history.back();
  else go(fallback, { replace: true });
}

/* ---------- Misc ---------- */

export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}

/** Keeps the screen on during a workout where the browser allows it. */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () => {
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ---------- Rest-timer sound ---------- */

let audio: AudioContext | null = null;

/** Must run inside a user gesture so later beeps are allowed. */
export function primeAudio() {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    /* no audio */
  }
}

export function restDoneAlert(sound: boolean) {
  navigator.vibrate?.([200, 100, 200]);
  if (!sound || !audio) return;
  const ctx = audio;
  const t = ctx.currentTime;
  [0, 0.22, 0.44].forEach((d, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start(t + d);
    o.stop(t + d + 0.2);
  });
}
