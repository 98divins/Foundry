import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { diffSize, diffStates, joinState, openDb, readAll, writeDiff, writeDoc } from './db';
import { recordDeletions } from './cloud/merge';
import { displayName, LIBRARY } from './exercises';
import type { Exercise, State } from './types';
import { registerKinds, registerPrefs } from './utils';
import { defaultNutrition, type NutritionState } from './nutrition';
import { t, setLang, detectLang, getLang } from './i18n';

const KEY = 'foundry:v1';

export function defaultState(): State {
  return {
    version: 1,
    workouts: [],
    routines: [],
    folders: [],
    customExercises: [],
    active: null,
    rest: null,
    settings: { unit: 'kg', defaultRest: 90, sound: true },
    nutrition: defaultNutrition(),
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return fromSaved(JSON.parse(raw) as Partial<State>);
  } catch {
    return defaultState();
  }
}

function fromSaved(saved: Partial<State>): State {
  const base = defaultState();
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...saved.settings },
    nutrition: { ...base.nutrition, ...saved.nutrition },
  } as State;
}

/* ---------- Where the state lives on this device (docs/SYNC_V2.md, 3.1) ---------- */

/** The old localStorage copy is kept, read-only, this long after moving to IndexedDB (to go back). */
const LEGACY_DAYS = 30;
const MIGRATED = 'meta:migrated';

export interface Boot {
  state: State;
  db: IDBDatabase | null;
}

/**
 * Load the state before the app renders: from IndexedDB, moving the localStorage copy there the
 * first time; from localStorage when IndexedDB is not available.
 */
export async function bootState(): Promise<Boot> {
  const db = await openDb();
  if (!db) return { state: load(), db: null };
  try {
    const t0 = performance.now();
    const { items, docs, legacy } = await readAll(db);
    const t1 = performance.now();
    const meta = docs.get(MIGRATED) as { at: number } | undefined;
    if (meta) {
      docs.delete(MIGRATED);
      if (Date.now() - meta.at > LEGACY_DAYS * 86400000) forgetLegacyCopy();
      const state = joinState(items, docs, defaultState());
      // Still in the first format (one entry per item): convert once to monthly chunks.
      if (legacy) await writeDiff(db, { put: [], del: [], docs: [] }, null, state);
      // Startup timings, checked by the performance script.
      performance.measure?.('foundry-read', { start: t0, end: t1 });
      performance.measure?.('foundry-join', { start: t1, end: performance.now() });
      return { state, db };
    }
    // First launch with IndexedDB: copy everything over, all or nothing, then mark it done.
    const state = load();
    await writeDiff(db, { put: [], del: [], docs: [] }, null, state);
    await writeDoc(db, MIGRATED, { at: Date.now(), from: 'localStorage' });
    return { state, db };
  } catch {
    return { state: load(), db: null };
  }
}

/** Remove the old localStorage copy (after the grace period, or on log out so no data stays behind). */
export function forgetLegacyCopy() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Light shape check for backups before they replace everything. */
export function parseBackup(text: string): State {
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !Array.isArray(data.workouts) || !Array.isArray(data.routines)) {
    throw new Error(t('This file is not a Foundry backup.'));
  }
  const base = defaultState();
  return { ...base, ...data, settings: { ...base.settings, ...data.settings }, nutrition: { ...base.nutrition, ...data.nutrition } };
}

interface Ctx {
  state: State;
  /** Every change goes through here; items that disappear are recorded so the deletion syncs. */
  update: (fn: (s: State) => State) => void;
  /** Swap the whole state without recording deletions (cloud copy arriving, device cleared on log out). */
  replace: (s: State) => void;
  exercises: Exercise[];
  exMap: Map<string, Exercise>;
  saveError: boolean;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children, boot }: { children: ReactNode; boot?: Boot }) {
  const [state, setState] = useState<State>(() => boot?.state ?? load());
  const [saveError, setSaveError] = useState(false);
  const db = useRef<IDBDatabase | null>(boot?.db ?? null);
  // What IndexedDB holds: the next write only sends the difference.
  const written = useRef<State | null>(boot?.db ? boot.state : null);
  const latest = useRef(state);
  latest.current = state;
  const timer = useRef<number>();

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const s = latest.current;
    if (db.current && written.current) {
      const t0 = performance.now();
      const next = s;
      const d = diffStates(written.current, next);
      // Time spent on the main thread to find what to save (checked by the performance script).
      performance.measure?.('foundry-save', { start: t0, end: performance.now() });
      if (!diffSize(d)) return;
      const prev = written.current;
      written.current = next;
      writeDiff(db.current, d, prev, next).then(
        () => setSaveError(false),
        (e) => {
          console.warn('IndexedDB write failed, using localStorage', e);
          // IndexedDB failed: keep the data safe in localStorage instead, and say so if that fails too.
          db.current = null;
          written.current = null;
          try {
            localStorage.setItem(KEY, JSON.stringify(latest.current));
          } catch {
            setSaveError(true);
          }
        },
      );
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, []);

  useEffect(() => {
    // Writes are grouped: a burst of changes (ticking sets) becomes one small write.
    clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, db.current ? 300 : 0);
  }, [state, flush]);

  useEffect(() => {
    // Leaving the app (switching app, locking the phone): write now.
    const now = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', now);
    addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', now);
      removeEventListener('pagehide', flush);
    };
  }, [flush]);

  useEffect(() => {
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  setLang(state.settings.appLang ?? detectLang());
  registerPrefs({ weekStartsOn: state.settings.weekStartsOn ?? 1, distanceUnit: state.settings.distanceUnit ?? 'km' });
  const lang = getLang();
  const custom = state.customExercises;
  const lib = useMemo(() => {
    const exercises = [...LIBRARY, ...custom].map((e) => ({ ...e, label: displayName(e, lang) }));
    const exMap = new Map(exercises.map((e) => [e.id, e]));
    registerKinds((id) => exMap.get(id)?.kind ?? 'weight');
    return { exercises, exMap };
  }, [custom, lang, state.settings.appLang]);

  const update = useCallback((fn: (s: State) => State) => {
    setState((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      const deleted = recordDeletions(prev, next);
      return deleted === next.deleted ? next : { ...next, deleted };
    });
  }, []);
  const value = useMemo<Ctx>(() => ({ state, update, replace: setState, ...lib, saveError }), [state, update, lib, saveError]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

export function exerciseName(exMap: Map<string, Exercise>, id: string) {
  const e = exMap.get(id);
  return e?.label ?? e?.name ?? t('Deleted exercise');
}

/** The nutrition part of the state, with an updater scoped to it. */
export function useNutrition() {
  const { state, update } = useStore();
  const setN = (fn: (n: NutritionState) => NutritionState) => update((s) => ({ ...s, nutrition: fn(s.nutrition) }));
  return { n: state.nutrition, setN, unit: state.settings.unit };
}
