import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyMealToLog,
  entriesFromMeal,
  itemsFromEntries,
  mealTotals,
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

describe('saved meals', () => {
  let k = 0;
  const id = () => 'id' + ++k;
  const meal = {
    id: 'm1',
    name: 'Bowl',
    updatedAt: 0,
    items: [
      { foodId: 'rice', name: 'Rice', grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0.5 },
      { foodId: 'chicken', name: 'Chicken', grams: 120, kcal: 198, protein: 37, carbs: 0, fat: 4.3 },
    ],
  };

  it('logs a copy of the items × servings, grouped', () => {
    const e = entriesFromMeal(meal, 1.5, '2026-11-10', 'lunch', id, 1000);
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ name: 'Rice', grams: 225, kcal: 293, date: '2026-11-10', meal: 'lunch' });
    expect(e[0].group).toEqual(e[1].group);
    expect(e[0].group).toMatchObject({ savedMealId: 'm1', servings: 1.5 });
    expect(mealTotals(meal.items, 2).kcal).toBe(786);
  });

  it('leaves past days alone unless asked, then updates every logging at its servings', () => {
    const past = [
      ...entriesFromMeal(meal, 1, '2026-11-03', 'lunch', id, 1),
      { id: 'other', date: '2026-11-03', meal: 'dinner' as const, name: 'Soup', grams: null, kcal: 300, protein: 10, carbs: 30, fat: 10, createdAt: 5 },
      ...entriesFromMeal(meal, 2, '2026-11-04', 'dinner', id, 10),
    ];
    const edited = { ...meal, name: 'Bowl v2', items: [meal.items[0], { name: 'Avocado', grams: 50, kcal: 80, protein: 1, carbs: 4, fat: 7.5 }] };
    // Editing the saved meal by itself changes nothing in the log (the log holds copies).
    expect(past.filter((e) => e.name === 'Chicken')).toHaveLength(2);
    const { log, groups } = applyMealToLog(past, edited, id);
    expect(groups).toBe(2);
    expect(log.filter((e) => e.name === 'Chicken')).toHaveLength(0);
    const day2 = log.filter((e) => e.date === '2026-11-04');
    expect(day2.map((e) => [e.name, e.kcal, e.meal])).toEqual([
      ['Rice', 390, 'dinner'],
      ['Avocado', 160, 'dinner'],
    ]);
    expect(day2[0].group?.name).toBe('Bowl v2');
    expect(log.find((e) => e.id === 'other')).toBeTruthy();
  });

  it('turns logged entries into meal items', () => {
    const items = itemsFromEntries(entriesFromMeal(meal, 1, '2026-11-10', 'lunch', id));
    expect(items).toEqual(meal.items);
  });
});

describe('planned meals', () => {
  it('do not count until confirmed', async () => {
    const { dayTotals } = await import('./nutrition');
    const e = (id: string, kcal: number, planned?: boolean) => ({ id, date: '2026-11-20', meal: 'lunch' as const, name: id, grams: 100, kcal, protein: 10, carbs: 10, fat: 1, createdAt: 0, ...(planned ? { planned } : {}) });
    expect(dayTotals([e('a', 300), e('b', 500, true)], '2026-11-20').kcal).toBe(300);
    expect(dayTotals([e('a', 300), e('b', 500, false)], '2026-11-20').kcal).toBe(800);
  });
});

describe('planned foods', () => {
  it('are left out of the expenditure estimate until confirmed', () => {
    const today = '2026-11-16';
    const build = (withPlanned: boolean): NutritionState => {
      const n = { ...defaultNutrition(), profile };
      for (let i = 60; i >= 1; i--) {
        const date = addDays(today, -i);
        n.weights.push({ date, kg: 80 });
        n.log.push({ id: 'a' + i, date, meal: 'lunch', name: 'x', grams: null, kcal: 2500, protein: 0, carbs: 0, fat: 0, createdAt: 0 });
        if (withPlanned) n.log.push({ id: 'p' + i, date, meal: 'dinner', name: 'planned', grams: null, kcal: 800, protein: 0, carbs: 0, fat: 0, createdAt: 0, planned: true });
      }
      return n;
    };
    const plain = expenditureSeries(build(false), today).at(-1)!;
    const planned = expenditureSeries(build(true), today).at(-1)!;
    expect(plain.raw).toBe(2500);
    expect(planned).toEqual(plain);
  });
});
