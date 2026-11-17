import { describe, expect, it } from 'vitest';
import {
  crossInsights,
  liftTrends,
  muscleSets,
  recentPRs,
  strengthIndexByWeek,
  volumeStatus,
  weeklyDiet,
  weeklyTraining,
  weekStarts,
  type DietWeek,
} from './analytics';
import { LIBRARY } from './exercises';
import { addDays, dayKey, defaultNutrition } from './nutrition';
import type { Workout } from './types';
import { computePRs, registerKinds } from './utils';

const exMap = new Map(LIBRARY.map((e) => [e.id, e]));
registerKinds((id) => exMap.get(id)?.kind ?? 'weight');

const DAY = 86400000;
const NOW = new Date(2026, 10, 14, 12).getTime(); // Saturday 14 Nov 2026
let n = 0;
const session = (daysAgo: number, lifts: [string, number, number, number][]): Workout => {
  const t = NOW - daysAgo * DAY;
  return {
    id: 'w' + ++n,
    name: 'W',
    startedAt: t,
    endedAt: t + 3600000,
    exercises: lifts.map(([exerciseId, weight, reps, sets]) => ({
      id: 'x' + ++n,
      exerciseId,
      restSec: 90,
      sets: Array.from({ length: sets }, () => ({ id: 's' + ++n, type: 'normal' as const, weight, reps, done: true })),
    })),
  };
};

// 8 weeks, twice a week: bench +2.5 kg a week, squat +5 kg every other week, plank (no load).
const workouts: Workout[] = [];
for (let wk = 0; wk < 8; wk++) {
  const daysAgo = 54 - wk * 7;
  workouts.push(
    session(daysAgo, [
      ['bench_bb', 80 + wk * 2.5, 8, 3],
      ['row_bb', 70, 10, 3],
      ['plank', 0, 0, 0],
    ]),
  );
  workouts.push(
    session(daysAgo - 3, [
      ['squat_bb', 100 + Math.floor(wk / 2) * 5, 6, 3],
      ['lateral_raise_db', 10, 15, 4],
    ]),
  );
}

describe('weeks', () => {
  it('lists Mondays oldest first', () => {
    const w = weekStarts(3, NOW);
    expect(w).toHaveLength(3);
    expect(w.map((t) => new Date(t).getDay())).toEqual([1, 1, 1]);
    expect(w[2]).toBeLessThanOrEqual(NOW);
  });

  it('sums sets and volume per week', () => {
    const weeks = weeklyTraining(workouts, weekStarts(10, NOW));
    expect(weeks.reduce((t, w) => t + w.workouts, 0)).toBe(16);
    const busy = weeks.filter((w) => w.workouts === 2);
    expect(busy.length).toBeGreaterThanOrEqual(6);
    expect(busy[0].sets).toBe(13);
  });
});

describe('muscles', () => {
  it('counts working sets per primary muscle and grades them', () => {
    const m = muscleSets(workouts, exMap, NOW - 7 * DAY, NOW + DAY);
    expect(m.get('chest')).toBe(3);
    expect(m.get('shoulders')).toBe(4);
    expect([volumeStatus(6), volumeStatus(14), volumeStatus(24)]).toEqual(['low', 'ok', 'high']);
  });
});

describe('strength', () => {
  it('ranks lifts and measures their progress', () => {
    const t = liftTrends(workouts, { now: NOW });
    const bench = t.find((x) => x.exerciseId === 'bench_bb')!;
    expect(bench.sessions).toBe(8);
    expect(bench.current).toBeCloseTo(97.5 * (1 + 8 / 30));
    expect(bench.changePct).toBeGreaterThan(15);
    expect(t.some((x) => x.exerciseId === 'plank')).toBe(false); // no load, no 1RM
  });

  it('builds a strength index that starts at 100 and rises', () => {
    const idx = strengthIndexByWeek(workouts, weekStarts(9, NOW)).filter((v): v is number => v != null);
    expect(idx[0]).toBe(100);
    // Bench +23 %, squat +15 %, row and raises flat: about +9 % on average.
    expect(idx[idx.length - 1]).toBeGreaterThan(105);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it('lists recent records newest first', () => {
    const prs = recentPRs(workouts, computePRs(workouts), 30, NOW);
    expect(prs.length).toBeGreaterThan(0);
    expect(prs[0].date).toBeGreaterThanOrEqual(prs[prs.length - 1].date);
    expect(prs.every((p) => p.date >= NOW - 30 * DAY)).toBe(true);
  });
});

describe('diet × training', () => {
  it('summarises logged days, protein per kg and weight change per week', () => {
    const nut = { ...defaultNutrition() };
    const starts = weekStarts(2, NOW);
    const first = dayKey(new Date(starts[0]));
    for (let i = -1; i < 14; i++) {
      const d = addDays(first, i);
      nut.weights.push({ date: d, kg: 80 - i * 0.05 });
      if (i >= 0 && i < 5)
        nut.log.push({ id: 'e' + i, date: d, meal: 'lunch', name: 'x', grams: null, kcal: 2000, protein: 160, carbs: 0, fat: 0, createdAt: 0 });
    }
    const [w1] = weeklyDiet(nut, starts);
    expect(w1.loggedDays).toBe(5);
    expect(w1.avgKcal).toBe(2000);
    expect(w1.proteinPerKg).toBeCloseTo(2, 1);
    expect(w1.weightChange).toBeCloseTo(-0.35, 2);
  });

  it('only draws conclusions with enough weeks on both sides', () => {
    const week = (p: number, wc: number): DietWeek => ({ start: 0, loggedDays: 6, avgKcal: 2200, avgProtein: p * 80, proteinPerKg: p, weightChange: wc });
    const index = [100, 102, 102.5, 105, 105.2, 107.5, 107.6];
    const diet = [week(2, 0), week(2, 0), week(1.2, -0.4), week(2.1, 0), week(1.1, -0.5), week(2, -0.1), week(1.3, -0.3)];
    const insights = crossInsights(index, diet, 2);
    expect(insights.map((i) => i.title)).toEqual(['Your strength moves more in high-protein weeks', 'Strength slows in your faster-loss weeks']);
    expect(crossInsights(index.slice(0, 4), diet.slice(0, 4), 2)).toEqual([]);
  });
});

describe('training days and week streak', () => {
  const at = (daysAgo: number, hour = 10) => {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d.getTime() - daysAgo * 86400000;
  };
  const w = (start: number) => ({ id: String(start), name: 'W', startedAt: start, endedAt: start + 3600000, exercises: [] });

  it('counts three routines on the same day as one training day', async () => {
    const { trainingDays } = await import('./analytics');
    expect(trainingDays([w(at(0, 9)), w(at(0, 10)), w(at(0, 11)), w(at(1))])).toBe(2);
  });

  it('counts weeks in a row and keeps last week’s streak until this week is over', async () => {
    const { weekStreak } = await import('./analytics');
    const { weekStart } = await import('./utils');
    const thisWeek = weekStart(Date.now()) + 3600000;
    const weeksAgo = (k: number) => thisWeek - k * 7 * 86400000;
    expect(weekStreak([w(thisWeek), w(weeksAgo(1)), w(weeksAgo(2))]).weeks).toBe(3);
    const pending = weekStreak([w(weeksAgo(1)), w(weeksAgo(2))]);
    expect(pending).toEqual({ weeks: 2, thisWeekDone: false });
    expect(weekStreak([w(thisWeek), w(weeksAgo(2))]).weeks).toBe(1);
    expect(weekStreak([]).weeks).toBe(0);
  });
});

describe('strength breakdown', () => {
  it('lists each lift of the week against its first session, biggest changes first', async () => {
    const { strengthBreakdown, weekStarts } = await import('./analytics');
    const DAY = 86400000;
    const now = Date.UTC(2026, 10, 18, 12);
    const w = (id: string, ex: string, at: number, kg: number) => ({
      id,
      name: 'W',
      startedAt: at,
      endedAt: at + 3600000,
      exercises: [{ id: id + ex, exerciseId: ex, restSec: 90, sets: [{ id: id + ex + 's', type: 'normal' as const, weight: kg, reps: 5, done: true }] }],
    });
    const [, start] = weekStarts(2, now);
    const ws = [
      w('a', 'squat_bb', start - 7 * DAY, 100),
      w('b', 'bench_bb', start - 7 * DAY, 80),
      w('c', 'squat_bb', start + DAY, 106),
      w('d', 'bench_bb', start + DAY, 70),
    ];
    expect(strengthBreakdown(ws, start)).toEqual([
      { exerciseId: 'bench_bb', pct: -12 }, // 70 / 80 − 1 = −12.5 %
      { exerciseId: 'squat_bb', pct: 6 },
    ]);
  });
});
