import { describe, expect, it } from 'vitest';
import { foodUsage, searchFoods } from './foods';
import type { Food } from './nutrition';

const food = (id: string, name: string): Food => ({ id, name, per100: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, source: 'generic' });
const NOW = new Date(2026, 10, 17, 8, 0).getTime();
const DAY = 86400000;
const entry = (foodId: string, meal: string, daysAgo: number, hour = 8) => {
  const d = new Date(NOW - daysAgo * DAY);
  d.setHours(hour);
  return { foodId, meal, createdAt: d.getTime() };
};

describe('foods you eat first (4.4)', () => {
  it('scores foods logged at this meal above the same food logged at other meals', () => {
    const u = foodUsage([entry('skyr', 'breakfast', 1), entry('rice', 'lunch', 1, 12)], 'breakfast', NOW);
    expect(u.get('skyr')!).toBeGreaterThan(u.get('rice')! * 3);
  });

  it('recent entries count more than old ones; frequency adds up', () => {
    const u = foodUsage([entry('a', 'breakfast', 1), entry('b', 'breakfast', 90), entry('c', 'breakfast', 3), entry('c', 'breakfast', 4)], 'breakfast', NOW);
    expect(u.get('a')!).toBeGreaterThan(u.get('b')! * 10);
    expect(u.get('c')!).toBeGreaterThan(u.get('a')!);
  });

  it('entries without a food (quick add) are ignored', () => {
    expect(foodUsage([{ meal: 'lunch', createdAt: NOW }], 'lunch', NOW).size).toBe(0);
  });

  it('search puts the food the person eats first, even when another name matches better', () => {
    const list = [food('lait', 'Lait demi-écrémé'), food('lait-avoine', 'Boisson avoine (lait d’avoine)'), food('lait-ent', 'Lait entier')];
    expect(searchFoods(list, 'lait').at(-1)!.id).toBe('lait-avoine');
    const u = foodUsage([entry('lait-avoine', 'breakfast', 1), entry('lait-avoine', 'breakfast', 2)], 'breakfast', NOW);
    const ranked = searchFoods(list, 'lait', 40, (f) => u.get(f.id) ?? 0);
    expect(ranked[0].id).toBe('lait-avoine');
    // Without usage, the text order stays.
    expect(searchFoods(list, 'lait', 40, () => 0).map((f) => f.id)).toEqual(searchFoods(list, 'lait').map((f) => f.id));
  });

  it('a used food beyond the plain limit still makes the list', () => {
    const list = Array.from({ length: 60 }, (_, i) => food('p' + i, 'Pain ' + 'x'.repeat(i)));
    const ranked = searchFoods(list, 'pain', 40, (f) => (f.id === 'p59' ? 2 : 0));
    expect(ranked[0].id).toBe('p59');
  });
});
