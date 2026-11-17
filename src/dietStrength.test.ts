import { describe, expect, it } from 'vitest';
import { dietTips, endPhase, phaseReview, startPhase, weeklyCard, type WeekSummary } from './dietStrength';
import { addDays, defaultNutrition, type NutritionState } from './nutrition';
import type { Workout } from './types';

const wk = (o: Partial<WeekSummary>): WeekSummary => ({
  start: 0,
  loggedDays: 7,
  kcalGap: -400,
  proteinPerKg: 1.4,
  weightChange: -0.5,
  strengthDelta: -1,
  ...o,
});
const NOW_WEEK = wk({ loggedDays: 2, kcalGap: null, strengthDelta: null }); // week in progress, always last
const ids = (ws: WeekSummary[], kg = 80) => dietTips([...ws, NOW_WEEK], kg).map((t) => t.id);

describe('weekly card (4.5)', () => {
  it('needs a full last week and an earlier week with data', () => {
    expect(weeklyCard([wk({}), NOW_WEEK])).toBeNull();
    expect(weeklyCard([wk({ loggedDays: 0 }), wk({}), NOW_WEEK])).toBeNull();
    expect(weeklyCard([wk({ loggedDays: 2 }), wk({ kcalGap: -300 }), NOW_WEEK])!.kcalGap).toBe(-300);
    expect(weeklyCard([wk({}), wk({ loggedDays: 3 }), NOW_WEEK])).toBeNull();
  });
});

describe('rule-based tips (4.5)', () => {
  it('deficit + strength down two weeks + protein under 1.6 g/kg', () => {
    expect(ids([wk({}), wk({})])).toEqual(['protein-cut']);
  });
  it('stays silent with one bad week only, or when strength holds', () => {
    expect(ids([wk({ strengthDelta: 0.5 }), wk({})])).toEqual([]);
    expect(ids([wk({}), wk({ strengthDelta: 0 })])).toEqual([]);
  });
  it('stays silent when a week was not logged enough', () => {
    expect(ids([wk({ loggedDays: 3 }), wk({})])).toEqual([]);
  });
  it('ignores the week in progress', () => {
    expect(dietTips([wk({ strengthDelta: 1 }), wk({}), wk({})], 80).map((t) => t.id)).toEqual([]);
  });
  it('protein fine but losing over 1 % a week with strength down: suggests a slower rate', () => {
    expect(ids([wk({ proteinPerKg: 2, weightChange: -0.9 }), wk({ proteinPerKg: 2, weightChange: -1 })])).toEqual(['fast-loss']);
    expect(ids([wk({ proteinPerKg: 2, weightChange: -0.5 }), wk({ proteinPerKg: 2 })])).toEqual([]);
  });
  it('gaining over 0.5 % a week for three weeks with strength flat', () => {
    const g = (d: number) => wk({ kcalGap: 500, weightChange: 0.5, proteinPerKg: 2, strengthDelta: d });
    expect(ids([g(0.2), g(0), g(0.1)])).toEqual(['fast-gain']);
    expect(ids([g(1), g(0.5), g(0.5)])).toEqual([]);
    expect(ids([g(0), g(0)])).toEqual([]); // only two weeks
  });
  it('low protein on its own', () => {
    expect(
      ids([wk({ kcalGap: 0, weightChange: 0, proteinPerKg: 1, strengthDelta: 1 }), wk({ kcalGap: 0, weightChange: 0, proteinPerKg: 1.1, strengthDelta: 1 })]),
    ).toEqual(['low-protein']);
  });
});

describe('phases (4.5)', () => {
  it('starting a phase ends the running one the day before; later ones are replaced', () => {
    let ph = startPhase(undefined, 'bulk', '2026-01-01', 'a');
    ph = startPhase(ph, 'cut', '2026-06-01', 'b');
    expect(ph).toEqual([
      { id: 'a', kind: 'bulk', start: '2026-01-01', end: '2026-05-31' },
      { id: 'b', kind: 'cut', start: '2026-06-01' },
    ]);
    expect(startPhase(ph, 'maintain', '2026-06-01', 'c').map((p) => p.id)).toEqual(['a', 'c']);
    expect(endPhase(ph, '2026-07-01')[1].end).toBe('2026-07-01');
  });

  it('reviews weight and strength between the start and the end of a phase', () => {
    const start = '2026-01-05';
    const n: NutritionState = { ...defaultNutrition(), weights: [], log: [] };
    for (let i = 0; i < 56; i++) {
      const d = addDays(start, i);
      n.weights.push({ date: d, kg: 90 - i * 0.05 });
      n.log.push({ id: 'l' + i, date: d, meal: 'lunch', name: 'x', grams: 1, kcal: 2200, protein: 160, carbs: 0, fat: 0, createdAt: i });
    }
    const t0 = new Date(start + 'T18:00').getTime();
    const bench = (day: number, kg: number): Workout => ({
      id: 'w' + day,
      name: 'W',
      startedAt: t0 + day * 86400000,
      endedAt: t0 + day * 86400000 + 3600000,
      exercises: [{ id: 'e' + day, exerciseId: 'bench_bb', restSec: 90, sets: [{ id: 's' + day, type: 'normal', weight: kg, reps: 5, done: true }] }],
    });
    const r = phaseReview({ id: 'p', kind: 'cut', start, end: addDays(start, 55) }, [bench(2, 100), bench(50, 95)], n);
    expect(r.days).toBe(56);
    expect(r.weightChange).toBeLessThan(-1.5);
    expect(r.strengthChange).toBe(-5);
    expect(r.lifts).toBe(1);
    expect(r.avgKcal).toBe(2200);
    expect(r.proteinPerKg).toBeGreaterThan(1.7);
    // Too short to compare strength.
    expect(phaseReview({ id: 'q', kind: 'cut', start, end: addDays(start, 10) }, [bench(2, 100), bench(9, 95)], n).strengthChange).toBeNull();
  });
});
