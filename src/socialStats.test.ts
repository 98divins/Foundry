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
    expect(metricValue(s, 'days', 'week', now)).toBe(2);
    expect(metricValue(s, 'days', 'week', now + 7 * 24 * H)).toBe(0);
    expect(metricValue(null, 'days', 'week', now)).toBeNull();
  });

  it('ranks highest first, shares ranks on ties, puts no data last', () => {
    const s = (weekDays: number) => ({ ...buildPublicStats(state, now), weekDays });
    const rows = rankBoard([{ person: 'a', stats: s(2) }, { person: 'b', stats: s(4) }, { person: 'c', stats: null }, { person: 'd', stats: s(2) }], 'days', 'week', now);
    expect(rows.map((r) => [r.person, r.rank])).toEqual([['b', 1], ['a', 2], ['d', 2], ['c', 4]]);
  });

  it('also ranks over a month, six months and a year', () => {
    const s = buildPublicStats(state, now);
    expect(metricValue(s, 'days', '30', now)).toBe(2);
    expect(metricValue(s, 'sets', '365', now)).toBe(6);
    // Older app versions publish no rolling periods: no value rather than a wrong one.
    expect(metricValue({ ...s, periods: undefined }, 'days', '182', now)).toBeNull();
  });
});

describe('cardio in the leaderboard', () => {
  it('sums minutes and km of cardio sets only', async () => {
    const { cardioIn } = await import('./socialStats');
    const { registerKinds } = await import('./utils');
    registerKinds((id) => (id === 'run' ? 'cardio' : 'weight'));
    const H = 3600000;
    const t0 = Date.now() - H;
    const w = {
      id: 'c', name: 'Run', startedAt: t0, endedAt: t0 + H,
      exercises: [
        { id: 'a', exerciseId: 'run', restSec: 0, sets: [{ id: 's1', type: 'normal' as const, weight: null, reps: null, duration: 1800, distance: 5, done: true }] },
        { id: 'b', exerciseId: 'bench_bb', restSec: 90, sets: [{ id: 's2', type: 'normal' as const, weight: 80, reps: 5, duration: 600, done: true }] },
      ],
    };
    expect(cardioIn([w], t0 - 1, t0 + 2 * H)).toEqual({ cardio: 30, cardioKm: 5 });
    registerKinds(() => 'weight');
  });
});

describe('comparisons over any dates', () => {
  it('sums the shared per-day summary between two dates', async () => {
    const { encodeDays, rangeTotals } = await import('./socialStats');
    const H = 3600000;
    const set = (i: number) => ({ id: 'r' + i, type: 'normal' as const, weight: 100, reps: 5, done: true });
    const at = (d: number) => new Date(2026, 10, d, 10).getTime();
    const w = (d: number) => ({ id: 'w' + d, name: 'W', startedAt: at(d), endedAt: at(d) + H, exercises: [{ id: 'e' + d, exerciseId: 'bench_bb', restSec: 90, sets: [set(d * 10), set(d * 10 + 1)] }] });
    const s = { ...defaultState(), workouts: [w(2), w(5), w(9)] };
    const enc = encodeDays(s, at(10));
    const r = rangeTotals(enc, at(4), at(9));
    expect(r).toMatchObject({ days: 2, sets: 4, volume: 2000 });
    expect(rangeTotals(undefined, at(1), at(9))).toBeNull();
  });
});
