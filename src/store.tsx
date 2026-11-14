import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { displayName, LIBRARY } from './exercises';
import type { Exercise, Routine, State, WorkoutExercise } from './types';
import { registerKinds, uid } from './utils';

const KEY = 'foundry:v1';

const block = (exerciseId: string, sets: number, reps: number, restSec = 120): WorkoutExercise => ({
  id: uid(),
  exerciseId,
  restSec,
  sets: Array.from({ length: sets }, () => ({ id: uid(), type: 'normal' as const, weight: null, reps, done: false })),
});

function starterRoutines(): Routine[] {
  const now = Date.now();
  return [
    {
      id: uid(),
      name: 'Push',
      updatedAt: now,
      exercises: [
        block('bench_bb', 3, 8, 150),
        block('ohp_bb', 3, 8, 150),
        block('incline_bench_db', 3, 10),
        block('lateral_raise_db', 3, 12, 60),
        block('pushdown', 3, 12, 60),
      ],
    },
    {
      id: uid(),
      name: 'Pull',
      updatedAt: now,
      exercises: [
        block('deadlift_bb', 3, 5, 180),
        block('pull_up', 3, 8),
        block('row_bb', 3, 8),
        block('face_pull', 3, 15, 60),
        block('curl_db', 3, 10, 60),
      ],
    },
    {
      id: uid(),
      name: 'Legs',
      updatedAt: now,
      exercises: [
        block('squat_bb', 3, 6, 180),
        block('rdl_bb', 3, 8, 150),
        block('leg_press', 3, 10),
        block('lying_leg_curl', 3, 12, 60),
        block('standing_calf_raise', 3, 12, 60),
      ],
    },
  ];
}

export function defaultState(): State {
  return {
    version: 1,
    workouts: [],
    routines: starterRoutines(),
    folders: [],
    customExercises: [],
    active: null,
    rest: null,
    settings: { unit: 'kg', defaultRest: 90, sound: true, exerciseLang: 'fr' },
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw) as Partial<State>;
    const base = defaultState();
    return { ...base, ...saved, settings: { ...base.settings, ...saved.settings } } as State;
  } catch {
    return defaultState();
  }
}

/** Light shape check for backups before they replace everything. */
export function parseBackup(text: string): State {
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !Array.isArray(data.workouts) || !Array.isArray(data.routines)) {
    throw new Error('This file is not a Foundry backup.');
  }
  const base = defaultState();
  return { ...base, ...data, settings: { ...base.settings, ...data.settings } };
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

  const lang = state.settings.exerciseLang;
  const custom = state.customExercises;
  const lib = useMemo(() => {
    const exercises = [...LIBRARY, ...custom].map((e) => ({ ...e, label: displayName(e, lang) }));
    const exMap = new Map(exercises.map((e) => [e.id, e]));
    registerKinds((id) => exMap.get(id)?.kind ?? 'weight');
    return { exercises, exMap };
  }, [custom, lang]);

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
  return e?.label ?? e?.name ?? 'Deleted exercise';
}
