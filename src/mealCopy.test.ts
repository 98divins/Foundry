import { describe, expect, it } from 'vitest';
import { lastPortion } from './mealCopy';
import type { FoodEntry } from './nutrition';

let n = 0;
const e = (date: string, meal: FoodEntry['meal'], name: string, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'e' + ++n,
  date,
  meal,
  name,
  foodId: name,
  grams: 100,
  kcal: 100,
  protein: 1,
  carbs: 1,
  fat: 1,
  createdAt: n,
  ...extra,
});

describe('last portion (4.4)', () => {
  it('remembers the last portion of a food', () => {
    const log = [
      e('2026-11-10', 'breakfast', 'flocons', { grams: 40, createdAt: 1 }),
      e('2026-11-16', 'breakfast', 'flocons', { grams: 60, createdAt: 2 }),
      e('2026-11-16', 'lunch', 'quick', { grams: null, foodId: undefined }),
    ];
    expect(lastPortion(log, 'flocons')).toBe(60);
    expect(lastPortion(log, 'riz')).toBeNull();
  });
});
