import { describe, expect, it } from 'vitest';
import { roundLoad, suggestNext, warmupSets, withWarmups } from './progression';
import type { SetEntry } from './types';

let n = 0;
const set = (weight: number | null, reps: number | null, extra: Partial<SetEntry> = {}): SetEntry => ({ id: 's' + ++n, type: 'normal', weight, reps, done: true, ...extra });
const target = (reps: number, repsMax: number | null) => set(null, null, { done: false, target: { reps, repsMax } });

describe('progression suggestion (4.3)', () => {
  it('top of the range on every set: suggests the next weight', () => {
    const s = suggestNext([set(80, 12), set(80, 12), set(80, 12)], [target(8, 12)], 'kg')!;
    expect(s).toMatchObject({ type: 'increase', last: 80, weight: 82.5, reps: 8 });
  });

  it('not there yet: same weight, aim for the top on every set', () => {
    const s = suggestNext([set(80, 8), set(80, 8), set(80, 7)], [target(8, 8)], 'kg')!;
    expect(s).toEqual({ type: 'match', last: 80, lastReps: [8, 8, 7], weight: 80, aim: 8 });
  });

  it('only counts working sets at the top weight', () => {
    const prev = [set(40, 10, { type: 'warmup' }), set(60, 12), set(80, 10), set(80, 10), set(60, 15, { type: 'drop' })];
    expect(suggestNext(prev, [target(8, 10)], 'kg')).toMatchObject({ type: 'increase', lastReps: [10, 10], weight: 82.5 });
  });

  it('without a target: match the best set, then add a rep once every set matches', () => {
    expect(suggestNext([set(50, 10), set(50, 9)], [], 'kg')).toMatchObject({ type: 'match', aim: 10 });
    expect(suggestNext([set(50, 10), set(50, 10)], [], 'kg')).toMatchObject({ type: 'match', aim: 11 });
  });

  it('steps by 5 lb for people who lift in pounds', () => {
    const s = suggestNext([set(100 * 0.45359237, 5)], [target(5, null)], 'lb')!;
    expect(s.type).toBe('increase');
    expect(s.weight / 0.45359237).toBeCloseTo(105);
  });

  it('nothing to suggest without a usable last session', () => {
    expect(suggestNext([], [target(8, 12)], 'kg')).toBeNull();
    expect(suggestNext([set(null, 12), set(0, 10)], [], 'kg')).toBeNull();
  });
});

describe('warm-up sets (4.3)', () => {
  let i = 0;
  const id = () => 'w' + ++i;
  it('bar, then about 50, 70 and 85 % rounded to 2.5 kg', () => {
    expect(warmupSets(100, 'kg', id).map((s) => [s.weight, s.reps, s.type])).toEqual([[20, 10, 'warmup'], [50, 5, 'warmup'], [70, 3, 'warmup'], [85, 2, 'warmup']]);
  });
  it('skips steps that would repeat the bar or reach the working weight', () => {
    expect(warmupSets(40, 'kg', id).map((s) => s.weight)).toEqual([20, 27.5, 35]);
    expect(warmupSets(25, 'kg', id)).toEqual([]);
  });
  it('rounds to 5 lb in pounds', () => {
    for (const s of warmupSets(225 * 0.45359237, 'lb', id)) expect(Math.abs(s.weight! / 0.45359237 / 5 - Math.round(s.weight! / 0.45359237 / 5))).toBeLessThan(1e-6);
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
