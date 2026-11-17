/**
 * Workout parity (plan 4.3): what to aim for today from last time, and generated warm-up sets.
 * Pure functions, tested in progression.test.ts. Weights are stored in kg.
 */
import type { SetEntry, Unit } from './types';

const LB = 0.45359237;

/** The smallest usual jump: 2.5 kg, or 5 lb. */
export const weightStep = (unit: Unit) => (unit === 'lb' ? 5 * LB : 2.5);

/** Rounds a weight (kg) to what can be loaded: 2.5 kg steps, or 5 lb steps. */
export function roundLoad(kg: number, unit: Unit): number {
  const step = weightStep(unit);
  return Math.round(kg / step) * step;
}

const working = (s: SetEntry) => (s.type === 'normal' || s.type === 'failure') && !!s.reps && s.weight != null && s.weight > 0;

/**
 * Last session's best working set: the heaviest, then the most reps at that weight. Shown as a
 * reference ("last time, best set: 106 kg × 8"); it does not push for more.
 */
export function bestLastSet(prev: SetEntry[]): { weight: number; reps: number } | null {
  let best: SetEntry | null = null;
  for (const s of prev.filter(working)) if (!best || s.weight! > best.weight! || (s.weight === best.weight && s.reps! > best.reps!)) best = s;
  return best ? { weight: best.weight!, reps: best.reps! } : null;
}

/** Fills the empty working sets (no weight and no reps yet) with that set. */
export function fillWithBest(sets: SetEntry[], best: { weight: number; reps: number }): SetEntry[] {
  return sets.map((s) => (!s.done && s.type !== 'warmup' && s.type !== 'drop' && s.weight == null && s.reps == null ? { ...s, weight: best.weight, reps: best.reps } : s));
}

/**
 * Warm-up sets before a working weight: the empty bar, then about 50 %, 70 % and 85 %, rounded to
 * loadable weights, fewer reps as it gets heavier. Nothing for light weights.
 */
export function warmupSets(work: number, unit: Unit, makeId: () => string): SetEntry[] {
  const bar = unit === 'lb' ? 45 * LB : 20;
  if (work < bar * 1.5) return [];
  const steps: [number, number][] = [[0, 10], [0.5, 5], [0.7, 3], [0.85, 2]];
  const out: SetEntry[] = [];
  let lastW = -1;
  for (const [pct, reps] of steps) {
    const w = pct === 0 ? bar : roundLoad(work * pct, unit);
    if (w <= lastW || (pct > 0 && w <= bar) || w >= work - 1e-9) continue;
    out.push({ id: makeId(), type: 'warmup', weight: w, reps, done: false });
    lastW = w;
  }
  return out;
}

/** Puts generated warm-ups before the working sets, replacing warm-ups not done yet. */
export function withWarmups(sets: SetEntry[], warmups: SetEntry[]): SetEntry[] {
  return [...warmups, ...sets.filter((s) => s.type !== 'warmup' || s.done)];
}
