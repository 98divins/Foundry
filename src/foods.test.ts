import { describe, expect, it } from 'vitest';
import { FR_FOOD_LIST, foodFromOff, searchFoods } from './foods';

describe('built-in French foods', () => {
  it('has unique ids and sensible values', () => {
    expect(FR_FOOD_LIST.length).toBeGreaterThan(140);
    expect(new Set(FR_FOOD_LIST.map((f) => f.id)).size).toBe(FR_FOOD_LIST.length);
    for (const f of FR_FOOD_LIST) {
      const { kcal, protein, carbs, fat, fiber } = f.per100;
      expect(kcal).toBeGreaterThanOrEqual(0);
      // Calories roughly agree with macros; fibre counts about 2 kcal/g. Alcohol is not a macro, and
      // USDA uses food-specific energy factors for cocoa, so those are left out.
      const fromMacros = 4 * protein + 4 * (carbs - (fiber ?? 0)) + 2 * (fiber ?? 0) + 9 * fat;
      if (!/vin|bière|cacao/i.test(f.name)) expect(Math.abs(kcal - fromMacros)).toBeLessThan(0.2 * kcal + 25);
    }
  });

  it('finds foods without accents, best match first', () => {
    const r = searchFoods(FR_FOOD_LIST, 'oeuf');
    expect(r[0].name).toMatch(/^Œuf|^Oeuf/);
    expect(searchFoods(FR_FOOD_LIST, 'poulet blanc cuit')[0].name).toBe('Blanc de poulet, cuit');
    expect(searchFoods(FR_FOOD_LIST, 'riz complet').map((f) => f.name).sort()).toEqual(['Riz complet, cru', 'Riz complet, cuit']);
  });
});

describe('Open Food Facts mapping', () => {
  it('maps a product with kcal, macros and serving', () => {
    const f = foodFromOff({
      code: '3017620422003',
      product_name: 'Nutella',
      product_name_fr: 'Nutella',
      brands: 'Ferrero, Nutella',
      serving_size: '15 g',
      serving_quantity: '15',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: 0 },
    });
    expect(f).toMatchObject({
      id: 'off-3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      per100: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
      serving: { label: '15 g', grams: 15 },
      barcode: '3017620422003',
    });
  });

  it('derives kcal from kJ or macros, and rejects products without nutrition', () => {
    expect(foodFromOff({ product_name: 'A', nutriments: { energy_100g: 418.4, proteins_100g: 1, carbohydrates_100g: 2, fat_100g: 3 } })?.per100.kcal).toBe(100);
    expect(foodFromOff({ product_name: 'B', nutriments: { proteins_100g: 10, carbohydrates_100g: 10, fat_100g: 10 } })?.per100.kcal).toBe(170);
    expect(foodFromOff({ product_name: 'C', nutriments: {} })).toBeNull();
    expect(foodFromOff({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
  });
});
