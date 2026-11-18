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
    const rows = rankBoard(
      [
        { person: 'a', stats: s(2) },
        { person: 'b', stats: s(4) },
        { person: 'c', stats: null },
        { person: 'd', stats: s(2) },
      ],
      'days',
      'week',
      now,
    );
    expect(rows.map((r) => [r.person, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['d', 2],
      ['c', 4],
    ]);
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
      id: 'c',
      name: 'Run',
      startedAt: t0,
      endedAt: t0 + H,
      exercises: [
        {
          id: 'a',
          exerciseId: 'run',
          restSec: 0,
          sets: [{ id: 's1', type: 'normal' as const, weight: null, reps: null, duration: 1800, distance: 5, done: true }],
        },
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
    const w = (d: number) => ({
      id: 'w' + d,
      name: 'W',
      startedAt: at(d),
      endedAt: at(d) + H,
      exercises: [{ id: 'e' + d, exerciseId: 'bench_bb', restSec: 90, sets: [set(d * 10), set(d * 10 + 1)] }],
    });
    const s = { ...defaultState(), workouts: [w(2), w(5), w(9)] };
    const enc = encodeDays(s, at(10));
    const r = rangeTotals(enc, at(4), at(9));
    expect(r).toMatchObject({ days: 2, sets: 4, volume: 2000 });
    expect(rangeTotals(undefined, at(1), at(9))).toBeNull();
  });
});

describe('head-to-head periods', () => {
  it('"this week" only counts the current week, from its first day', async () => {
    const { buildPublicStats, metricValue, liftsFor } = await import('./socialStats');
    const H = 3600000;
    const now = weekStart(Date.now()) + 2 * 24 * H + 12 * H;
    const start = weekStart(now);
    let k = 0;
    const set = (weight: number, reps: number) => ({ id: 'h' + k++, type: 'normal' as const, weight, reps, done: true });
    const w = (at: number, weight: number) => ({
      id: 'w' + k++,
      name: 'W',
      startedAt: at,
      endedAt: at + H,
      exercises: [{ id: 'e' + k++, exerciseId: 'bench_bb', restSec: 90, sets: [set(weight, 5)] }],
    });
    // Last week: 60 then a record at 100. This week: 80 (not a record) and one session.
    const s = buildPublicStats({ ...defaultState(), workouts: [w(start - 6 * 24 * H, 60), w(start - 2 * 24 * H, 100), w(start + 10 * H, 80)] } as State, now);
    expect(metricValue(s, 'days', 'week', now)).toBe(1);
    expect(metricValue(s, 'prs', 'week', now)).toBe(0);
    expect(metricValue(s, 'prs', '30', now)).toBe(1);
    expect(liftsFor(s, 'week', now)?.bench_bb).toBeLessThan(liftsFor(s, '30', now)!.bench_bb!);
  });
  it('averages training days per week over the chosen period', async () => {
    const { daysPerWeek } = await import('./socialStats');
    const s = {
      v: 1,
      week: 0,
      weekDays: 0,
      weekWorkouts: 0,
      weekSets: 0,
      weekVolume: 0,
      weekMinutes: 0,
      avgDays4w: 0,
      streak: 0,
      prs30: 0,
      strength4w: null,
      totalWorkouts: 0,
      lastWorkoutAt: null,
      lifts: {},
      periods: { '30': { days: 12, sets: 0, volume: 0, prs: 0, strength: null, goals: null } },
    } as const;
    expect(daysPerWeek(s as never, '30')).toBe(2.8);
    expect(daysPerWeek(null, '30')).toBeNull();
  });
});

describe('comparisons over dates', () => {
  it('ranks by any value, ties share a rank, missing last', async () => {
    const { rankBy } = await import('./socialStats');
    const rows = rankBy(
      [
        { person: 'a', stats: null },
        { person: 'b', stats: null },
        { person: 'c', stats: null },
        { person: 'd', stats: null },
      ],
      () => null,
    );
    expect(rows.every((r) => r.value == null)).toBe(true);
    const v: Record<string, number | null> = { a: 3, b: 5, c: 3, d: null };
    const people = Object.keys(v).map((k) => ({ person: k, stats: { k } as never }));
    const ranked = rankBy(people, (s) => v[(s as unknown as { k: string }).k]);
    expect(ranked.map((r) => [r.person, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });
  it('the score counts figures won, not ties or missing ones', async () => {
    const { compareScore } = await import('./socialStats');
    expect(
      compareScore([
        [1, 1],
        [20, 33],
        [0, 0],
        [15, 20],
        [6127, 5449],
        [1, 0],
        [70, 54],
      ]),
    ).toEqual([3, 2]);
    expect(
      compareScore([
        [5, null],
        [null, 3],
      ]),
    ).toEqual([0, 0]);
  });
  it('picks the shortest period reaching back to a date', async () => {
    const { coveringPeriod } = await import('./socialStats');
    const now = Date.UTC(2026, 10, 17);
    expect(coveringPeriod(now - 3 * 86400000, now)).toBe('week');
    expect(coveringPeriod(now - 20 * 86400000, now)).toBe('30');
    expect(coveringPeriod(now - 100 * 86400000, now)).toBe('182');
    expect(coveringPeriod(now - 300 * 86400000, now)).toBe('365');
  });
});

describe('cardio minutes', () => {
  it('count cardio-area exercises tracked by time only (stair machine) as well as distance + time ones', async () => {
    const { cardioIn } = await import('./socialStats');
    const { LIBRARY } = await import('./exercises');
    const { registerCardio, registerKinds } = await import('./utils');
    const byId = new Map(LIBRARY.map((e) => [e.id, e]));
    registerKinds((id) => byId.get(id)?.kind ?? 'weight');
    registerCardio((id) => byId.get(id)?.muscle === 'cardio');
    const at = Date.UTC(2026, 10, 17, 19);
    const set = (id: string, extra: object) => ({ id, type: 'normal' as const, weight: null, reps: null, done: true, ...extra });
    const w = {
      id: 'w',
      name: 'Cardio x Abs',
      startedAt: at,
      endedAt: at + 28 * 60000,
      exercises: [
        { id: 'a', exerciseId: 'stair_machine_steps', restSec: 0, sets: [set('s1', { duration: 960 })] },
        { id: 'b', exerciseId: 'plank', restSec: 0, sets: [set('s2', { duration: 60 })] },
      ],
    };
    expect(byId.get('stair_machine_steps')?.kind).toBe('duration');
    expect(cardioIn([w], at - 1, at + 86400000).cardio).toBe(16); // the plank is not cardio
  });
});
