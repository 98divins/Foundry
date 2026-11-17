import { afterEach, describe, expect, it } from 'vitest';
import { FR_FOOD_LIST, foodName, itemName, portionLabel, searchFoods } from './foods';
import { FOOD_EN, PORTION_EN } from './foodsEn';
import { MEAL_IDEAS, ideaItems } from './mealIdeas';
import { setLang } from './i18n';

afterEach(() => setLang('fr'));

describe('one language for the whole app', () => {
  it('every built-in food and portion has an English name', () => {
    for (const f of FR_FOOD_LIST) {
      expect(FOOD_EN[f.id], f.name).toBeTruthy();
      if (f.serving) expect(PORTION_EN[f.serving.label], f.serving.label).toBeTruthy();
    }
    expect(Object.keys(FOOD_EN).length).toBe(FR_FOOD_LIST.length);
  });

  it('no two built-in foods share a name, in either language', () => {
    const fr = FR_FOOD_LIST.map((f) => f.name.toLowerCase());
    const en = FR_FOOD_LIST.map((f) => FOOD_EN[f.id].toLowerCase());
    expect(fr.filter((n, i) => fr.indexOf(n) !== i)).toEqual([]);
    expect(en.filter((n, i) => en.indexOf(n) !== i)).toEqual([]);
  });

  it('names follow the app language; logged items too, from their food id', () => {
    const banana = FR_FOOD_LIST.find((f) => f.id === 'g-fr-banane')!;
    setLang('en');
    expect(foodName(banana)).toBe('Banana');
    expect(itemName({ foodId: 'g-fr-banane', name: 'Banane' })).toBe('Banana');
    expect(portionLabel('1 banane')).toBe('1 banana');
    expect(itemName({ name: 'My sauce' })).toBe('My sauce');
    setLang('fr');
    expect(itemName({ foodId: 'g-fr-banane', name: 'Banana' })).toBe('Banane');
  });

  it('search finds built-in foods by their French or English name', () => {
    expect(searchFoods(FR_FOOD_LIST, 'banana')[0].id).toBe('g-fr-banane');
    expect(searchFoods(FR_FOOD_LIST, 'banane')[0].id).toBe('g-fr-banane');
  });

  it('every meal idea is made of built-in foods, so it exists in both languages', () => {
    for (const idea of MEAL_IDEAS) {
      expect(ideaItems(idea).length, idea.name).toBe(idea.ingredients.length);
      for (const [id] of idea.ingredients) expect(FOOD_EN[id], id).toBeTruthy();
    }
  });
});
