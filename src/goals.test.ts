import { describe, expect, it } from 'vitest';
import { defaultState } from './store';
import type { State, Workout } from './types';
import { dietOnTarget, goalRate, weekGoal } from './goals';
import { dayKey } from './nutrition';
import { weekStart } from './utils';

const H = 3600000;
const DAY = 24 * H;
const w = (startedAt: number): Workout => ({ id: String(startedAt), name: 'W', startedAt, endedAt: startedAt + H, exercises: [] });
const entry = (date: string, kcal: number, protein: number) => ({
  id: date + kcal,
  date,
  meal: 'lunch' as const,
  name: 'x',
  grams: 100,
  kcal,
  protein,
  carbs: 0,
  fat: 0,
  createdAt: 0,
});

describe('weekly goals', () => {
  const thisWeek = weekStart(Date.now());
  const lastWeek = weekStart(thisWeek - 3.5 * DAY);
  const target = { kcal: 2500, protein: 160, carbs: 300, fat: 70 };
  const base: State = {
    ...defaultState(),
    goals: { trainingDays: 3, dietDays: 2, setAt: lastWeek - 7 * DAY },
    // Last week: 3 training days, two of them on the same day twice.
    workouts: [w(lastWeek + 10 * H), w(lastWeek + 12 * H), w(lastWeek + DAY + 10 * H), w(lastWeek + 3 * DAY + 10 * H)],
  };
  const d0 = dayKey(new Date(lastWeek + 10 * H));
  const d1 = dayKey(new Date(lastWeek + DAY + 10 * H));
  const state: State = {
    ...base,
    nutrition: {
      ...base.nutrition,
      checkIns: [{ date: '2000-01-01', expenditure: 2500, trendKg: 80, targets: target }],
      log: [entry(d0, 2450, 170), entry(d1, 3200, 170)],
    },
  };

  it('a diet day counts when calories are within 10 % and protein reaches 90 %', () => {
    expect(dietOnTarget(state.nutrition, d0)).toBe(true);
    expect(dietOnTarget(state.nutrition, d1)).toBe(false);
    expect(dietOnTarget({ ...state.nutrition, incompleteDays: [d0] }, d0)).toBe(false);
  });

  it('measures the week against the goals', () => {
    const g = weekGoal(state, state.goals!, lastWeek);
    expect(g.training).toEqual({ done: 3, goal: 3, met: true });
    expect(g.diet).toEqual({ done: 1, goal: 2, met: false });
    expect(g.met).toBe(false);
    expect(g.progress).toBeCloseTo(0.75);
  });

  it('gives the share of full weeks with goals met', () => {
    const noDiet = { ...state, goals: { ...state.goals!, dietDays: null } };
    // Two full weeks since the goals were set: the one before (nothing) and last week (met).
    expect(goalRate(noDiet, noDiet.goals, lastWeek - 7 * DAY)).toBe(50);
    expect(goalRate(noDiet, undefined, 0)).toBeNull();
  });
});
