import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { displayName, LIBRARY } from './exercises';
import type { Exercise, State } from './types';
import { registerKinds, registerPrefs } from './utils';
import { defaultNutrition, type NutritionState } from './nutrition';
import { t, setLang, detectLang } from './i18n';

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
    settings: { unit: 'kg', defaultRest: 90, sound: true, exerciseLang: 'fr' },
    nutrition: defaultNutrition(),
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw) as Partial<State>;
    const base = defaultState();
    return {
      ...base,
      ...saved,
      settings: { ...base.settings, ...saved.settings },
      nutrition: { ...base.nutrition, ...saved.nutrition },
    } as State;
  } catch {
    return defaultState();
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
  update: (fn: (s: State) => State) => void;
  exercises: Exercise[];
  exMap: Map<string, Exercise>;
  saveError: boolean;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [state]);

  useEffect(() => {
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  setLang(state.settings.appLang ?? detectLang());
  registerPrefs({ weekStartsOn: state.settings.weekStartsOn ?? 1, distanceUnit: state.settings.distanceUnit ?? 'km' });
  const lang = state.settings.exerciseLang;
  const custom = state.customExercises;
  const lib = useMemo(() => {
    const exercises = [...LIBRARY, ...custom].map((e) => ({ ...e, label: displayName(e, lang) }));
    const exMap = new Map(exercises.map((e) => [e.id, e]));
    registerKinds((id) => exMap.get(id)?.kind ?? 'weight');
    return { exercises, exMap };
  }, [custom, lang, state.settings.appLang]);

  const value = useMemo<Ctx>(() => ({ state, update: setState, ...lib, saveError }), [state, lib, saveError]);

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
