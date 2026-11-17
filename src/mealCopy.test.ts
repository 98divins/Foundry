import { describe, expect, it } from 'vitest';
import { copyEntries, lastPortion, previousMeal } from './mealCopy';
import type { FoodEntry } from './nutrition';

let n = 0;
const e = (date: string, meal: FoodEntry['meal'], name: string, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'e' + ++n, date, meal, name, foodId: name, grams: 100, kcal: 100, protein: 1, carbs: 1, fat: 1, createdAt: n, ...extra,
});

describe('copy a previous meal (4.4)', () => {
  it('finds yesterday’s meal, else the last day that has it', () => {
    const log = [e('2026-11-16', 'breakfast', 'skyr'), e('2026-11-16', 'breakfast', 'banane'), e('2026-11-16', 'lunch', 'riz'), e('2026-11-14', 'dinner', 'saumon')];
    expect(previousMeal(log, '2026-11-17', 'breakfast')!.entries.map((x) => x.name)).toEqual(['skyr', 'banane']);
    expect(previousMeal(log, '2026-11-17', 'dinner')!.date).toBe('2026-11-14');
    expect(previousMeal(log, '2026-11-17', 'snacks')).toBeNull();
    expect(previousMeal(log, '2026-11-30', 'breakfast')).toBeNull(); // more than a week back
  });

  it('ignores planned entries that were never eaten', () => {
    const log = [e('2026-11-16', 'lunch', 'plan', { planned: true }), e('2026-11-15', 'lunch', 'pâtes')];
    expect(previousMeal(log, '2026-11-17', 'lunch')!.entries.map((x) => x.name)).toEqual(['pâtes']);
  });

  it('copies with new ids, keeps amounts, keeps saved-meal groups together', () => {
    const g = { id: 'g1', savedMealId: 'm1', name: 'Bol', servings: 1 };
    const src = [e('2026-11-16', 'breakfast', 'a', { group: g }), e('2026-11-16', 'breakfast', 'b', { group: g }), e('2026-11-16', 'breakfast', 'c', { grams: 30 })];
    let i = 0;
    const out = copyEntries(src, '2026-11-17', 'snacks', () => 'n' + ++i, 1000, '2026-11-17');
    expect(out.map((x) => [x.date, x.meal, x.grams])).toEqual([['2026-11-17', 'snacks', 100], ['2026-11-17', 'snacks', 100], ['2026-11-17', 'snacks', 30]]);
    expect(new Set(out.map((x) => x.id)).size).toBe(3);
    expect(out.some((x) => src.some((s) => s.id === x.id))).toBe(false);
    expect(out[0].group!.id).toBe(out[1].group!.id);
    expect(out[0].group!.id).not.toBe('g1');
    expect(out.every((x) => !x.planned)).toBe(true);
    expect(copyEntries(src, '2026-11-18', 'lunch', () => 'x', 0, '2026-11-17').every((x) => x.planned)).toBe(true);
  });

  it('remembers the last portion of a food', () => {
    const log = [e('2026-11-10', 'breakfast', 'flocons', { grams: 40, createdAt: 1 }), e('2026-11-16', 'breakfast', 'flocons', { grams: 60, createdAt: 2 }), e('2026-11-16', 'lunch', 'quick', { grams: null, foodId: undefined })];
    expect(lastPortion(log, 'flocons')).toBe(60);
    expect(lastPortion(log, 'riz')).toBeNull();
  });
});
