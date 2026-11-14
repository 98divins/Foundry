import { describe, expect, it } from 'vitest';
import {
  addDays,
  checkInDue,
  computeTargets,
  currentExpenditure,
  dayTotals,
  daysBetween,
  defaultNutrition,
  expenditureSeries,
  initialExpenditure,
  KCAL_PER_KG,
  makeCheckIn,
  scaleFood,
  weightTrend,
  type Food,
  type NutritionState,
} from './nutrition';

const profile = { sex: 'male' as const, birthYear: 1996, heightCm: 180, activity: 'moderate' as const };

/** A person whose true expenditure is `tdee`, eating `intake` daily, weighing in every morning with ±0.6 kg noise. */
function simulate(days: number, tdee: number, intake: number, startKg = 85, start = '2026-09-01'): NutritionState {
  const n: NutritionState = { ...defaultNutrition(), profile };
  let kg = startKg;
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const noise = Math.sin(i * 2.3) * 0.6;
    n.weights.push({ date, kg: Math.round((kg + noise) * 10) / 10 });
    n.log.push({ id: 'e' + i, date, meal: 'lunch', name: 'Food', grams: null, kcal: intake, protein: 150, carbs: 200, fat: 70, createdAt: 0 });
    kg += (intake - tdee) / KCAL_PER_KG;
  }
  return n;
}

describe('dates', () => {
  it('adds days across months and counts them', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });
});

describe('food maths', () => {
  const skyr: Food = { id: 'f', name: 'Skyr', per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 }, source: 'custom' };
  it('scales per-100 g values', () => {
    expect(scaleFood(skyr, 150)).toEqual({ kcal: 95, protein: 16.5, carbs: 6, fat: 0.3 });
  });
  it('totals a day', () => {
    const n = simulate(2, 2500, 2000);
    expect(dayTotals(n.log, '2026-09-01').kcal).toBe(2000);
    expect(dayTotals(n.log, '2026-09-03').kcal).toBe(0);
  });
});

describe('weight trend', () => {
  it('smooths noise and keeps the trend on missing days', () => {
    const t = weightTrend(
      [
        { date: '2026-09-01', kg: 80 },
        { date: '2026-09-02', kg: 82 },
        { date: '2026-09-04', kg: 80 },
      ],
      '2026-09-05',
    );
    expect(t.map((x) => x.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);
    expect(t[1].trend).toBeCloseTo(80.2);
    expect(t[2].trend).toBeCloseTo(80.2);
    expect(t[2].scale).toBeNull();
  });
});

describe('expenditure', () => {
  it('starts from Mifflin-St Jeor × activity', () => {
    // 10×85 + 6.25×180 − 5×30 + 5 = 1830; × 1.55
    expect(initialExpenditure(profile, 85, '2026-09-01')).toBe(2837);
  });

  it('converges toward the true expenditure after six weeks', () => {
    const n = simulate(42, 2600, 2100);
    const seed = initialExpenditure(profile, 85, '2026-10-12');
    const est = currentExpenditure(n, '2026-10-12')!;
    expect(Math.abs(seed - 2600)).toBeGreaterThan(200);
    expect(Math.abs(est - 2600)).toBeLessThan(Math.abs(seed - 2600) / 2);
  });

  it('ignores days marked as not fully logged', () => {
    const n = simulate(30, 2600, 2100);
    // Two days logged with almost nothing, flagged as incomplete, must not drag the estimate down.
    n.log.push({ id: 'x', date: '2026-09-20', meal: 'snacks', name: 'x', grams: null, kcal: -1800, protein: 0, carbs: 0, fat: 0, createdAt: 0 });
    const flagged = { ...n, incompleteDays: ['2026-09-20'] };
    const a = currentExpenditure(simulate(30, 2600, 2100), '2026-09-30')!;
    const b = currentExpenditure(flagged, '2026-09-30')!;
    expect(Math.abs(a - b)).toBeLessThan(25);
  });

  it('needs a profile and a weigh-in', () => {
    expect(expenditureSeries(defaultNutrition())).toEqual([]);
  });
});

describe('targets and check-ins', () => {
  it('builds calories from expenditure and rate, macros from weight', () => {
    const t = computeTargets(2600, 80, { ...defaultNutrition(), profile, rateKgPerWeek: -0.5 });
    expect(t.kcal).toBe(2050); // 2600 − 550, rounded to 10
    expect(t.protein).toBe(160);
    expect(t.fat).toBe(Math.round((0.28 * 2050) / 9));
    expect(t.carbs).toBe(Math.round((2050 - 4 * 160 - 9 * t.fat) / 4));
  });

  it('never goes below a safe calorie floor', () => {
    expect(computeTargets(1500, 60, { ...defaultNutrition(), profile: { ...profile, sex: 'female' }, rateKgPerWeek: -1 }).kcal).toBe(1200);
  });

  it('is due weekly on the chosen day', () => {
    const n = simulate(10, 2600, 2100);
    expect(checkInDue(n, '2026-09-10')).toBe(true);
    const ci = makeCheckIn(n, '2026-09-10')!;
    const after = { ...n, checkIns: [ci], checkInDay: 1 };
    expect(checkInDue(after, '2026-09-10')).toBe(false);
    expect(checkInDue(after, '2026-09-13')).toBe(false); // Sunday
    expect(checkInDue(after, '2026-09-14')).toBe(true); // Monday
    expect(checkInDue({ ...after, checkInDay: 3 }, '2026-09-17')).toBe(true); // a week later anyway
  });
});
