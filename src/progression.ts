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

export type Suggestion =
  /** Every working set reached the top of the target last time: go up. */
  | { type: 'increase'; last: number; lastReps: number[]; weight: number; reps: number | null }
  /** Not there yet: same weight, aim for these reps on each set. */
  | { type: 'match'; last: number; lastReps: number[]; weight: number; aim: number };

const working = (s: SetEntry) => (s.type === 'normal' || s.type === 'failure') && !!s.reps && s.weight != null && s.weight > 0;

/**
 * From last session's sets and today's target: if every set at the top weight reached the top of the
 * target range (or, with no target, the same reps on each set), suggest the next weight; otherwise
 * recall the target ("last time 80 × 8, 8, 7: aim for 8, 8, 8").
 */
export function suggestNext(prev: SetEntry[], today: SetEntry[], unit: Unit): Suggestion | null {
  const work = prev.filter(working);
  if (!work.length) return null;
  const last = Math.max(...work.map((s) => s.weight!));
  const lastReps = work.filter((s) => s.weight === last).map((s) => s.reps!);
  const target = today.find((s) => s.target)?.target ?? null;
  const top = target ? (target.repsMax ?? target.reps) : null;
  if (top != null) {
    if (lastReps.every((r) => r >= top)) return { type: 'increase', last, lastReps, weight: last + weightStep(unit), reps: target!.reps };
    return { type: 'match', last, lastReps, weight: last, aim: top };
  }
  const best = Math.max(...lastReps);
  // No target: once every set hits the same reps, add one; else match the best set on every set.
  if (lastReps.length > 1 && lastReps.every((r) => r === best)) return { type: 'match', last, lastReps, weight: last, aim: best + 1 };
  return { type: 'match', last, lastReps, weight: last, aim: best };
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
