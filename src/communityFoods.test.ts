import { describe, expect, it } from 'vitest';
import { canPublishFood } from './cloud/social';
import type { Food } from './nutrition';

const food = (over: Partial<Food>): Food => ({ id: 'c-1', name: 'Sauce', per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 }, source: 'custom', ...over });

describe('community foods', () => {
  it('only foods the member typed in are shared', () => {
    expect(canPublishFood(food({}))).toBe(true);
  });
  it('shares a scanned Open Food Facts product only when it has a real barcode', () => {
    expect(canPublishFood(food({ source: 'off', id: 'off-3017620422003', barcode: '3017620422003' }))).toBe(true);
    expect(canPublishFood(food({ source: 'off', id: 'off-nutella' }))).toBe(false);
    expect(canPublishFood(food({ source: 'custom', id: 'off-3017620422003' }))).toBe(false);
  });
  it('never republishes generic foods or another member’s food', () => {
    expect(canPublishFood(food({ source: 'generic', id: 'g-fr-12' }))).toBe(false);
    expect(canPublishFood(food({ source: 'community' }))).toBe(false);
  });
});
