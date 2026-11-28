import { describe, expect, it } from 'vitest';
import { autoFinish, autoFinishAt } from './autoFinish';
import { defaultState } from './store';
import type { State, Workout } from './types';

const M = 60000;
const t0 = Date.UTC(2026, 10, 20, 18);
const w = (sets: { done: boolean; doneAt?: number }[]): Workout => ({
  id: 'a',
  name: 'W',
  startedAt: t0,
  endedAt: null,
  exercises: [{ id: 'e', exerciseId: 'bench_bb', restSec: 90, sets: sets.map((x, i) => ({ id: 's' + i, type: 'normal', weight: 60, reps: 5, ...x })) }],
});

describe('closing a forgotten workout', () => {
  it('closes 30 min after the last set once every set is ticked', () => {
    const x = w([
      { done: true, doneAt: t0 + 20 * M },
      { done: true, doneAt: t0 + 40 * M },
    ]);
    expect(autoFinishAt(x, t0 + 69 * M)).toBeNull();
    expect(autoFinishAt(x, t0 + 71 * M)).toBe(t0 + 40 * M);
  });

  it('with sets left, waits 4 hours without activity', () => {
    const x = w([{ done: true, doneAt: t0 + 20 * M }, { done: false }]);
    expect(autoFinishAt(x, t0 + 3 * 60 * M)).toBeNull();
    expect(autoFinishAt(x, t0 + 20 * M + 4 * 60 * M + M)).toBe(t0 + 20 * M);
  });

  it('saves the ticked sets with the end at the last set, and drops an empty workout', () => {
    const base = defaultState() as State;
    const s = autoFinish({ ...base, active: w([{ done: true, doneAt: t0 + 30 * M }, { done: false }]) }, t0 + 5 * 60 * M);
    expect(s.active).toBeNull();
    expect(s.workouts.at(-1)).toMatchObject({ endedAt: t0 + 30 * M });
    expect(s.workouts.at(-1)!.exercises[0].sets).toHaveLength(1);
    const empty = autoFinish({ ...base, active: w([{ done: false }]) }, t0 + 5 * 60 * M);
    expect(empty.active).toBeNull();
    expect(empty.workouts).toHaveLength(base.workouts.length);
  });
});
