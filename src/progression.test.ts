import { describe, expect, it } from 'vitest';
import { bestLastSet, fillWithBest, roundLoad, warmupSets, withWarmups } from './progression';
import type { SetEntry } from './types';

let n = 0;
const set = (weight: number | null, reps: number | null, extra: Partial<SetEntry> = {}): SetEntry => ({
  id: 's' + ++n,
  type: 'normal',
  weight,
  reps,
  done: true,
  ...extra,
});

describe('best set from last time (4.3)', () => {
  it('the heaviest working set, most reps at that weight; warm-ups and drops ignored', () => {
    const prev = [set(60, 10, { type: 'warmup' }), set(100, 8), set(106, 7), set(106, 8), set(80, 15, { type: 'drop' })];
    expect(bestLastSet(prev)).toEqual({ weight: 106, reps: 8 });
    expect(bestLastSet([set(null, 12), set(0, 10)])).toBeNull();
    expect(bestLastSet([])).toBeNull();
  });
  it('fills only empty working sets', () => {
    const today = [
      set(20, 10, { type: 'warmup', done: false }),
      set(null, null, { done: false }),
      set(100, null, { done: false }),
      set(null, null, { done: true }),
    ];
    const out = fillWithBest(today, { weight: 106, reps: 8 });
    expect(out.map((s) => [s.weight, s.reps])).toEqual([
      [20, 10],
      [106, 8],
      [100, null],
      [null, null],
    ]);
  });
});

describe('warm-up sets (4.3)', () => {
  let i = 0;
  const id = () => 'w' + ++i;
  it('bar, then about 50, 70 and 85 % rounded to 2.5 kg', () => {
    expect(warmupSets(100, 'kg', id).map((s) => [s.weight, s.reps, s.type])).toEqual([
      [20, 10, 'warmup'],
      [50, 5, 'warmup'],
      [70, 3, 'warmup'],
      [85, 2, 'warmup'],
    ]);
  });
  it('skips steps that would repeat the bar or reach the working weight', () => {
    expect(warmupSets(40, 'kg', id).map((s) => s.weight)).toEqual([20, 27.5, 35]);
    expect(warmupSets(25, 'kg', id)).toEqual([]);
  });
  it('rounds to 5 lb in pounds', () => {
    for (const s of warmupSets(225 * 0.45359237, 'lb', id))
      expect(Math.abs(s.weight! / 0.45359237 / 5 - Math.round(s.weight! / 0.45359237 / 5))).toBeLessThan(1e-6);
    expect(roundLoad(61, 'kg')).toBe(60);
  });
  it('replaces warm-ups not done yet, keeps the rest', () => {
    const sets = [set(20, 10, { type: 'warmup', done: true }), set(40, 5, { type: 'warmup', done: false }), set(80, 8, { done: false })];
    const out = withWarmups(sets, warmupSets(80, 'kg', id));
    expect(out.filter((s) => s.type === 'warmup' && !s.done).map((s) => s.weight)).toEqual([20, 40, 55, 67.5]);
    expect(out.some((s) => s.weight === 40 && s.id === sets[1].id)).toBe(false);
    expect(out.at(-1)!.weight).toBe(80);
  });
});

describe('Previous column', () => {
  it('warm-ups face last time’s warm-ups, working sets face working sets', async () => {
    const { prevFor } = await import('./components/WorkoutEditor');
    const prev = [set(60, 8, { type: 'warmup' }), set(100, 7), set(100, 8)];
    const today = [set(20, 10, { type: 'warmup' }), set(50, 5, { type: 'warmup' }), set(null, null), set(null, null)];
    expect(prevFor(today, 0, prev)!.weight).toBe(60);
    expect(prevFor(today, 1, prev)).toBeUndefined();
    expect(prevFor(today, 2, prev)!.reps).toBe(7);
    expect(prevFor(today, 3, prev)!.reps).toBe(8);
  });
});
