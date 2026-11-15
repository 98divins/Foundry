import { describe, expect, it } from 'vitest';
import { ideaItems, MEAL_IDEAS } from './mealIdeas';
import { mealTotals } from './nutrition';

describe('meal ideas', () => {
  it('every ingredient is a built-in food and each meal is balanced', () => {
    for (const idea of MEAL_IDEAS) {
      const items = ideaItems(idea);
      expect(items.length, idea.id).toBe(idea.ingredients.length);
      const tot = mealTotals(items, 1);
      expect(tot.kcal, idea.id).toBeGreaterThan(150);
      expect(tot.kcal, idea.id).toBeLessThan(900);
      // At least ~15 % of calories from protein.
      expect((tot.protein * 4) / tot.kcal, idea.id).toBeGreaterThan(0.15);
    }
  });
});
