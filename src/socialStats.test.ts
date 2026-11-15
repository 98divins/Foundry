import { describe, expect, it } from 'vitest';
import { defaultState } from './store';
import type { State, Workout } from './types';
import { buildPublicStats, metricValue, rankBoard } from './socialStats';
import { weekStart } from './utils';

const H = 3600000;
const set = (weight: number, reps: number) => ({ id: Math.random().toString(), type: 'normal' as const, weight, reps, done: true });
const w = (startedAt: number, exerciseId = 'bench_bb', weight = 80, reps = 5): Workout => ({
  id: String(startedAt),
  name: 'W',
  startedAt,
  endedAt: startedAt + H,
  exercises: [{ id: 'e' + startedAt, exerciseId, restSec: 90, sets: [set(weight, reps), set(weight, reps)] }],
});

describe('friends stats', () => {
  const now = weekStart(Date.now()) + 3 * 24 * H + 12 * H;
  const today = weekStart(now) + 10 * H;
  const state: State = { ...defaultState(), workouts: [w(today), w(today + 2 * H, 'squat_bb', 100, 5), w(today + 24 * H)] };

  it('counts training days, not routines, and only shares a summary', () => {
    const s = buildPublicStats(state, now);
    expect(s.weekWorkouts).toBe(3);
    expect(s.weekDays).toBe(2);
    expect(s.weekSets).toBe(6);
    expect(s.lifts.bench_bb).toBeGreaterThan(80);
    expect(s.lifts.squat_bb).toBeGreaterThan(100);
    expect(Object.keys(s)).not.toContain('workouts');
  });

  it('a friend’s weekly numbers from a past week count as zero', () => {
    const s = buildPublicStats(state, now);
    expect(metricValue(s, 'weekDays', now)).toBe(2);
    expect(metricValue(s, 'weekDays', now + 7 * 24 * H)).toBe(0);
    expect(metricValue(null, 'weekDays', now)).toBeNull();
  });

  it('ranks highest first, shares ranks on ties, puts no data last', () => {
    const s = (weekDays: number) => ({ ...buildPublicStats(state, now), weekDays });
    const rows = rankBoard([{ person: 'a', stats: s(2) }, { person: 'b', stats: s(4) }, { person: 'c', stats: null }, { person: 'd', stats: s(2) }], 'weekDays', now);
    expect(rows.map((r) => [r.person, r.rank])).toEqual([['b', 1], ['a', 2], ['d', 2], ['c', 4]]);
  });
});
