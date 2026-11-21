import { memoByRef } from './memo';
import type { ExerciseKind, PRKind, SetEntry, Unit, Workout, WorkoutExercise } from './types';
import { locale, t, getLang } from './i18n';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const LB_PER_KG = 2.20462262;

/** Convert stored kilograms to the display unit, rounded for humans. */
export function toDisplay(kg: number, unit: Unit): number {
  return unit === 'lb' ? Math.round(kg * LB_PER_KG * 10) / 10 : Math.round(kg * 100) / 100;
}

export function fromDisplay(value: number, unit: Unit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

/** Decimal comma in French (82,5), point in English (82.5). Display only, never stored. */
export const dec = (s: string) => (getLang() === 'fr' ? s.replace('.', ',') : s);

export function fmtNum(v: number): string {
  return dec(String(Math.round(v * 100) / 100));
}

export function fmtWeight(kg: number | null, unit: Unit): string {
  if (kg == null) return '–';
  return `${fmtNum(toDisplay(kg, unit))} ${unit}`;
}

/** Estimates are rounded to one decimal; more would be false precision. */
export function fmtEstimate(kg: number | null, unit: Unit): string {
  if (!kg) return '–';
  return `${dec(String(Math.round(toDisplay(kg, unit) * 10) / 10))} ${unit}`;
}

/** Large volumes read better compacted: 12 450 kg → 12.4 t / 27.4k lb. */
export function fmtVolume(kg: number, unit: Unit): string {
  const v = toDisplay(kg, unit);
  if (unit === 'kg' && v >= 10000) return `${dec((v / 1000).toFixed(1))} t`;
  if (v >= 10000) return `${dec((v / 1000).toFixed(1))}k ${unit}`;
  return `${Math.round(v).toLocaleString(locale())} ${unit}`;
}

/** Estimated one-rep max (Epley formula). */
export function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/* The store registers how each exercise is tracked, so stats can treat cardio or assisted sets correctly. */
let kindOf: (exerciseId: string) => ExerciseKind = () => 'weight';
let cardioOf: (exerciseId: string) => boolean = () => false;
/**
 * Whether an exercise counts as cardio in stats, leaderboards and challenges: tracked as distance and
 * time, or in the Cardio area while tracked by time only (stair machine, jump rope, HIIT…).
 */
export const isCardioExercise = (exerciseId: string) => kindOf(exerciseId) === 'cardio' || cardioOf(exerciseId);
export function registerCardio(fn: (exerciseId: string) => boolean) {
  cardioOf = fn;
}
export function registerKinds(fn: (exerciseId: string) => ExerciseKind) {
  kindOf = fn;
}
export const exerciseKind = (exerciseId: string) => kindOf(exerciseId);
let loadsOf: (exerciseId: string) => 1 | 2 = () => 1;
/** How many dumbbells are lifted at once: people log one dumbbell's weight, volume counts each. */
export const loadFactor = (exerciseId: string) => loadsOf(exerciseId);
export function registerLoads(fn: (exerciseId: string) => 1 | 2) {
  loadsOf = fn;
}
/** Lifted load of a set of this exercise (weight × reps × dumbbells). Records and 1RM use one dumbbell. */
export const setVolumeOf = (s: SetEntry, exerciseId: string) => setVolume(s, kindOf(exerciseId)) * loadsOf(exerciseId);

/** A set counts toward stats once it is completed, is not a warm-up and has something logged. */
export const countsForStats = (s: SetEntry) => s.done && s.type !== 'warmup' && ((s.reps ?? 0) > 0 || (s.duration ?? 0) > 0 || (s.distance ?? 0) > 0);

/** Whether a set holds something the user typed, for its kind (ignores hints and placeholders). */
export function hasEntry(s: SetEntry, kind: ExerciseKind): boolean {
  switch (kind) {
    case 'weight':
      return (s.reps ?? 0) > 0 && s.weight != null;
    case 'duration':
      return (s.duration ?? 0) > 0;
    case 'cardio':
      return (s.duration ?? 0) > 0 || (s.distance ?? 0) > 0;
    default:
      return (s.reps ?? 0) > 0;
  }
}

/** Lifted load per set. Assistance, holds and cardio move no external load. */
export function setVolume(s: SetEntry, kind: ExerciseKind): number {
  if (kind !== 'weight' && kind !== 'bodyweight') return 0;
  return (s.weight ?? 0) * (s.reps ?? 0);
}

export function exerciseVolume(we: WorkoutExercise): number {
  const kind = kindOf(we.exerciseId);
  return we.sets.filter(countsForStats).reduce((t, s) => t + setVolume(s, kind) * loadsOf(we.exerciseId), 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((t, we) => t + exerciseVolume(we), 0);
}

export function workoutSetCount(w: Workout): number {
  return w.exercises.reduce((t, we) => t + we.sets.filter(countsForStats).length, 0);
}

/** "1:30", "45" (seconds for holds, minutes for cardio), "1:02:00". Returns seconds. */
export function parseTime(text: string, plainUnit: 'sec' | 'min'): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * (plainUnit === 'min' ? 60 : 1));
  const parts = t.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p) && !/^\d+$/.test(p))) return undefined;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** A distance in the user's unit (km or mi). */
export function fmtKm(km: number): string {
  return `${dec(String(kmToDisplay(km)))} ${prefs.distanceUnit}`;
}

/** One set as a short line, e.g. "80 kg × 8", "+10 kg × 6", "−20 kg × 8", "1:30", "5 km · 25:00". */
export function fmtSet(s: Pick<SetEntry, 'weight' | 'reps' | 'duration' | 'distance'>, kind: ExerciseKind, unit: Unit): string {
  const w = s.weight ? fmtNum(toDisplay(s.weight, unit)) : null;
  switch (kind) {
    case 'duration':
      return s.duration ? fmtClock(s.duration) : '–';
    case 'cardio': {
      const parts = [s.distance ? fmtKm(s.distance) : null, s.duration ? fmtClock(s.duration) : null].filter(Boolean);
      return parts.join(' · ') || '–';
    }
    case 'assisted':
      return `${w ? `−${w} ${unit} × ` : ''}${s.reps ?? '–'}${w ? '' : ' ' + t('reps')}`;
    case 'bodyweight':
      return `${w ? `+${w} ${unit} × ` : ''}${s.reps ?? '–'}${w ? '' : ' ' + t('reps')}`;
    default:
      return `${w ? `${w} ${unit} × ` : ''}${s.reps ?? '–'}${w ? '' : ' ' + t('reps')}`;
  }
}

export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h}h ${min % 60}min` : `${min}min`;
}

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(locale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

export function defaultWorkoutName(ts = Date.now()): string {
  const h = new Date(ts).getHours();
  if (h < 11) return t('Morning workout');
  if (h < 17) return t('Afternoon workout');
  return t('Evening workout');
}

export const finished = (workouts: Workout[]) => workouts.filter((w) => w.endedAt != null).sort((a, b) => a.startedAt - b.startedAt);

export interface Session {
  workoutId: string;
  date: number;
  sets: SetEntry[];
  bestWeight: number;
  best1rm: number;
  bestSetVolume: number;
  bestReps: number;
  volume: number;
  /** Longest single set, in seconds. */
  bestDuration: number;
  totalDuration: number;
  totalDistance: number;
}

/** One entry per finished workout that contains the exercise, oldest first. */
export function exerciseSessions(workouts: Workout[], exerciseId: string): Session[] {
  const kind = kindOf(exerciseId);
  const out: Session[] = [];
  for (const w of finished(workouts)) {
    const sets = w.exercises
      .filter((we) => we.exerciseId === exerciseId)
      .flatMap((we) => we.sets)
      .filter(countsForStats);
    if (!sets.length) continue;
    const loaded = kind === 'weight' || kind === 'bodyweight';
    out.push({
      workoutId: w.id,
      date: w.startedAt,
      sets,
      bestWeight: loaded ? Math.max(...sets.map((s) => s.weight ?? 0)) : 0,
      best1rm: loaded ? Math.max(...sets.map((s) => epley(s.weight ?? 0, s.reps ?? 0))) : 0,
      bestSetVolume: Math.max(...sets.map((s) => setVolume(s, kind))),
      bestReps: Math.max(...sets.map((s) => s.reps ?? 0)),
      volume: sets.reduce((t, s) => t + setVolume(s, kind), 0) * loadsOf(exerciseId),
      bestDuration: Math.max(...sets.map((s) => s.duration ?? 0)),
      totalDuration: sets.reduce((t, s) => t + (s.duration ?? 0), 0),
      totalDistance: sets.reduce((t, s) => t + (s.distance ?? 0), 0),
    });
  }
  return out;
}

const PR_METRICS: Record<ExerciseKind, PRKind[]> = {
  weight: ['weight', '1rm', 'volume'],
  bodyweight: ['weight', '1rm', 'volume', 'reps'],
  assisted: ['reps'],
  duration: ['duration'],
  cardio: ['distance', 'duration'],
};

/**
 * Personal records, keyed by set id. A set is a record when it beats every
 * earlier workout for that exercise; the first session sets the baseline.
 * Within one workout only the best set per metric is flagged.
 */
/** Records per set, computed once per list of workouts (memo.ts). */
/** Sessions of an exercise that only set the starting point: no record before the next one. */
export const RECORD_AFTER_SESSIONS = 3;

export const computePRs = (workouts: Workout[]): Map<string, PRKind[]> => prsMemo(workouts, undefined);
const prsMemo = memoByRef((workouts: Workout[], _: undefined) => computePRsUncached(workouts));

function computePRsUncached(workouts: Workout[]): Map<string, PRKind[]> {
  const bests = new Map<string, Partial<Record<PRKind, number>>>();
  const result = new Map<string, PRKind[]>();
  const flag = (id: string, k: PRKind) => result.set(id, [...(result.get(id) ?? []), k]);
  const metric: Record<PRKind, (s: SetEntry) => number> = {
    weight: (s) => s.weight ?? 0,
    '1rm': (s) => epley(s.weight ?? 0, s.reps ?? 0),
    volume: (s) => (s.weight ?? 0) * (s.reps ?? 0),
    reps: (s) => s.reps ?? 0,
    duration: (s) => s.duration ?? 0,
    distance: (s) => s.distance ?? 0,
  };

  const sessionsSeen = new Map<string, number>();
  for (const w of finished(workouts)) {
    const byExercise = new Map<string, SetEntry[]>();
    for (const we of w.exercises) {
      const sets = we.sets.filter(countsForStats);
      if (sets.length) byExercise.set(we.exerciseId, [...(byExercise.get(we.exerciseId) ?? []), ...sets]);
    }
    for (const [exId, sets] of byExercise) {
      const prev = bests.get(exId);
      // The first sessions of an exercise only set the starting point: records count from the 4th.
      const seen = sessionsSeen.get(exId) ?? 0;
      sessionsSeen.set(exId, seen + 1);
      const counts = seen >= RECORD_AFTER_SESSIONS;
      const next = { ...(prev ?? {}) };
      for (const k of PR_METRICS[kindOf(exId)]) {
        let top: SetEntry | null = null;
        for (const s of sets) if (!top || metric[k](s) > metric[k](top)) top = s;
        if (!top) continue;
        const v = metric[k](top);
        // Rep records only count when no set carried extra load.
        const relevant = k === 'reps' ? sets.every((s) => !s.weight) || kindOf(exId) === 'assisted' : v > 0;
        if (prev && counts && relevant && v > (prev[k] ?? 0) + 1e-9) flag(top.id, k);
        next[k] = Math.max(next[k] ?? 0, v);
      }
      bests.set(exId, next);
    }
  }
  return result;
}

/** Sets from the most recent finished workout before `before` that used this exercise. */
export function previousSets(workouts: Workout[], exerciseId: string, before: number): SetEntry[] {
  let best: Workout | null = null;
  for (const w of workouts) {
    if (w.endedAt == null || w.startedAt >= before) continue;
    if (!w.exercises.some((we) => we.exerciseId === exerciseId)) continue;
    if (!best || w.startedAt > best.startedAt) best = w;
  }
  if (!best) return [];
  return best.exercises.find((we) => we.exerciseId === exerciseId)!.sets.filter((s) => s.done);
}

/* Display preferences the store registers, so helpers do not need them passed everywhere. */
const prefs = { weekStartsOn: 1 as 0 | 1, distanceUnit: 'km' as 'km' | 'mi' };
export function registerPrefs(p: Partial<typeof prefs>) {
  Object.assign(prefs, p);
}

export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 7 - prefs.weekStartsOn) % 7));
  return d.getTime();
}

const KM_PER_MI = 1.609344;
export const distUnit = () => prefs.distanceUnit;
/** km (stored) → the user's unit, rounded to 2 decimals. */
export const kmToDisplay = (km: number) => Math.round((prefs.distanceUnit === 'mi' ? km / KM_PER_MI : km) * 100) / 100;
export const displayToKm = (v: number) => (prefs.distanceUnit === 'mi' ? v * KM_PER_MI : v);

/** Ticks on round numbers covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min = min - 1;
    max = max + 1;
  }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 180 cm → { ft: 5, inch: 11 } (rounded to the nearest inch). */
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const total = Math.round(cm / 2.54);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}

export const ftInToCm = (ft: number, inch: number) => Math.round((ft * 12 + inch) * 2.54 * 10) / 10;

export function fmtHeight(cm: number, unit: 'cm' | 'in' = 'cm'): string {
  if (unit === 'cm') return `${Math.round(cm)} cm`;
  const { ft, inch } = cmToFtIn(cm);
  return `${ft}′${inch}″`;
}

/** Time trained so far, pauses left out. */
export function workoutElapsed(w: Pick<Workout, 'startedAt' | 'pausedAt' | 'pausedMs'>, now = Date.now()): number {
  return Math.max(0, (w.pausedAt ?? now) - w.startedAt - (w.pausedMs ?? 0));
}
