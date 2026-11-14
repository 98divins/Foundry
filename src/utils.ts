import type { PRKind, SetEntry, Unit, Workout, WorkoutExercise } from './types';

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const LB_PER_KG = 2.20462262;

/** Convert stored kilograms to the display unit, rounded for humans. */
export function toDisplay(kg: number, unit: Unit): number {
  return unit === 'lb' ? Math.round(kg * LB_PER_KG * 10) / 10 : Math.round(kg * 100) / 100;
}

export function fromDisplay(value: number, unit: Unit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

export function fmtNum(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export function fmtWeight(kg: number | null, unit: Unit): string {
  if (kg == null) return '–';
  return `${fmtNum(toDisplay(kg, unit))} ${unit}`;
}

/** Estimates are rounded to one decimal; more would be false precision. */
export function fmtEstimate(kg: number | null, unit: Unit): string {
  if (!kg) return '–';
  return `${Math.round(toDisplay(kg, unit) * 10) / 10} ${unit}`;
}

/** Large volumes read better compacted: 12 450 kg → 12.4 t / 27.4k lb. */
export function fmtVolume(kg: number, unit: Unit): string {
  const v = toDisplay(kg, unit);
  if (unit === 'kg' && v >= 10000) return `${(v / 1000).toFixed(1)} t`;
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(v).toLocaleString('en-US')} ${unit}`;
}

/** Estimated one-rep max (Epley formula). */
export function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** A set counts toward stats once it is completed, is not a warm-up and has reps. */
export const countsForStats = (s: SetEntry) => s.done && s.type !== 'warmup' && (s.reps ?? 0) > 0;

export function exerciseVolume(we: WorkoutExercise): number {
  return we.sets.filter(countsForStats).reduce((t, s) => t + (s.weight ?? 0) * (s.reps ?? 0), 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((t, we) => t + exerciseVolume(we), 0);
}

export function workoutSetCount(w: Workout): number {
  return w.exercises.reduce((t, we) => t + we.sets.filter(countsForStats).length, 0);
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
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function defaultWorkoutName(ts = Date.now()): string {
  const h = new Date(ts).getHours();
  if (h < 11) return 'Morning workout';
  if (h < 17) return 'Afternoon workout';
  return 'Evening workout';
}

export const finished = (workouts: Workout[]) =>
  workouts.filter((w) => w.endedAt != null).sort((a, b) => a.startedAt - b.startedAt);

export interface Session {
  workoutId: string;
  date: number;
  sets: SetEntry[];
  bestWeight: number;
  best1rm: number;
  bestSetVolume: number;
  bestReps: number;
  volume: number;
}

/** One entry per finished workout that contains the exercise, oldest first. */
export function exerciseSessions(workouts: Workout[], exerciseId: string): Session[] {
  const out: Session[] = [];
  for (const w of finished(workouts)) {
    const sets = w.exercises
      .filter((we) => we.exerciseId === exerciseId)
      .flatMap((we) => we.sets)
      .filter(countsForStats);
    if (!sets.length) continue;
    out.push({
      workoutId: w.id,
      date: w.startedAt,
      sets,
      bestWeight: Math.max(...sets.map((s) => s.weight ?? 0)),
      best1rm: Math.max(...sets.map((s) => epley(s.weight ?? 0, s.reps ?? 0))),
      bestSetVolume: Math.max(...sets.map((s) => (s.weight ?? 0) * (s.reps ?? 0))),
      bestReps: Math.max(...sets.map((s) => s.reps ?? 0)),
      volume: sets.reduce((t, s) => t + (s.weight ?? 0) * (s.reps ?? 0), 0),
    });
  }
  return out;
}

/**
 * Personal records, keyed by set id. A set is a record when it beats every
 * earlier workout for that exercise; the first session sets the baseline.
 * Within one workout only the best set per metric is flagged.
 */
export function computePRs(workouts: Workout[]): Map<string, PRKind[]> {
  const bests = new Map<string, Record<PRKind, number>>();
  const result = new Map<string, PRKind[]>();
  const flag = (id: string, k: PRKind) => result.set(id, [...(result.get(id) ?? []), k]);

  for (const w of finished(workouts)) {
    const byExercise = new Map<string, SetEntry[]>();
    for (const we of w.exercises) {
      const sets = we.sets.filter(countsForStats);
      if (sets.length) byExercise.set(we.exerciseId, [...(byExercise.get(we.exerciseId) ?? []), ...sets]);
    }
    for (const [exId, sets] of byExercise) {
      const metric: Record<PRKind, (s: SetEntry) => number> = {
        weight: (s) => s.weight ?? 0,
        '1rm': (s) => epley(s.weight ?? 0, s.reps ?? 0),
        volume: (s) => (s.weight ?? 0) * (s.reps ?? 0),
        reps: (s) => s.reps ?? 0,
      };
      const prev = bests.get(exId);
      const next = { ...(prev ?? { weight: 0, '1rm': 0, volume: 0, reps: 0 }) };
      for (const k of Object.keys(metric) as PRKind[]) {
        let top: SetEntry | null = null;
        for (const s of sets) if (!top || metric[k](s) > metric[k](top)) top = s;
        if (!top) continue;
        const v = metric[k](top);
        // Reps only count as a record when there is no load to compare.
        const relevant = k === 'reps' ? sets.every((s) => !s.weight) : v > 0;
        if (prev && relevant && v > prev[k] + 1e-9) flag(top.id, k);
        next[k] = Math.max(next[k], v);
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

export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

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
