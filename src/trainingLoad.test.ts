import { describe, expect, it } from 'vitest';
import { loadRatio, weeklyLoad } from './trainingLoad';
import type { Workout } from './types';
import { weekStart } from './utils';

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 17, 12);
let n = 0;
/** A workout `daysAgo` with `sets` working sets of 100 kg × 5 (plus one warm-up that never counts). */
function w(daysAgo: number, sets: number, rpe?: number): Workout {
  const start = NOW - daysAgo * DAY;
  return {
    id: 'w' + ++n, name: 'W', startedAt: start, endedAt: start + 60 * 60000,
    exercises: [{
      id: 'e' + n, exerciseId: 'bench_bb', restSec: 90,
      sets: [
        { id: 'wu' + n, type: 'warmup', weight: 40, reps: 10, done: true },
        ...Array.from({ length: sets }, (_, i) => ({ id: `s${n}-${i}`, type: 'normal' as const, weight: 100, reps: 5, done: true, ...(rpe ? { rpe } : {}) })),
      ],
    }],
  };
}

describe('training load', () => {
  it('counts working sets, tonnage, minutes and effort per week', () => {
    const [wk] = weeklyLoad([w(0, 10, 8), w(1, 6), w(3, 99)], [weekStart(NOW)]); // the 3rd is the week before
    expect(wk.sets).toBe(16);
    expect(wk.tonnage).toBe(16 * 500);
    expect(wk.minutes).toBe(120);
    expect(wk.effort).toBe(8 * 60);
  });

  it('steady when this week matches the usual', () => {
    const r = loadRatio([w(1, 15), w(9, 15), w(16, 15), w(23, 15)], NOW)!;
    expect(r.zone).toBe('steady');
    expect(r.ratio).toBe(1);
  });

  it('flags a sudden jump and a light week', () => {
    expect(loadRatio([w(1, 40), w(9, 10), w(16, 10), w(23, 10)], NOW)!.zone).toBe('jump');
    expect(loadRatio([w(1, 3), w(9, 20), w(16, 20), w(23, 20)], NOW)!.zone).toBe('low');
  });

  it('says nothing without at least three weeks of history', () => {
    expect(loadRatio([w(1, 15), w(9, 15)], NOW)).toBeNull();
    expect(loadRatio([], NOW)).toBeNull();
  });
});
