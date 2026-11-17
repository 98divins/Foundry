import { describe, expect, it } from 'vitest';
import { challengesOf, monthChallenges } from './challenges';
import { defaultState } from './store';
import type { State, Workout } from './types';

describe('monthly challenges', () => {
  it('picks three different challenges, one about training, changing every month', () => {
    const a = challengesOf('2026-11').map((c) => c.id);
    const b = challengesOf('2026-12').map((c) => c.id);
    expect(new Set(a).size).toBe(3);
    expect(['workouts12', 'days16', 'sets250']).toContain(a[0]);
    expect(a).not.toEqual(b);
  });
  it('measures progress from the month’s workouts only', () => {
    const set = (i: number) => ({ id: 'x' + i, type: 'normal' as const, weight: 50, reps: 10, done: true });
    const w = (d: number): Workout => ({
      id: 'w' + d,
      name: 'W',
      startedAt: new Date(2026, 10, d, 10).getTime(),
      endedAt: new Date(2026, 10, d, 11).getTime(),
      exercises: [{ id: 'e' + d, exerciseId: 'bench_bb', restSec: 90, sets: [1, 2, 3, 4, 5, 6].map((i) => set(d * 10 + i)) }],
    });
    const old: Workout = { ...w(1), id: 'old', startedAt: new Date(2026, 9, 20, 10).getTime(), endedAt: new Date(2026, 9, 20, 11).getTime() };
    const s = { ...defaultState(), workouts: [w(2), w(3), w(5), old] } as State;
    const first = monthChallenges(s, '2026-11')[0];
    const expected = { workouts12: 3, days16: 3, sets250: 18 }[first.def.id as 'workouts12'];
    expect(first.value).toBe(expected);
    expect(first.done).toBe(false);
  });
});
