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

describe('exercise library in both languages', () => {
  it('every exercise has a French and an English name, and no two share one', async () => {
    const { LIBRARY } = await import('./exercises');
    const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const lang of ['name', 'nameFr'] as const) {
      const names = LIBRARY.map((e) => fold(e[lang] ?? ''));
      expect(names.filter((n) => !n)).toEqual([]);
      expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    }
  });
  it('body areas and equipment have distinct names in each language', async () => {
    const { AREAS, EQUIPMENT, areaLabel, equipmentLabel } = await import('./exercises');
    for (const l of ['fr', 'en'] as const) {
      setLang(l);
      const m = AREAS.map((x) => areaLabel(x));
      const e = EQUIPMENT.map((x) => equipmentLabel(x));
      expect(new Set(m).size).toBe(m.length);
      expect(new Set(e).size).toBe(e.length);
    }
  });
});

describe('body areas', () => {
  it('every muscle belongs to one of the six areas (or full body, cardio, other), shown in both languages', async () => {
    const { MUSCLES, AREAS, areaOf, areaLabel, muscleLabel, LIBRARY } = await import('./exercises');
    for (const m of MUSCLES) expect(AREAS).toContain(areaOf(m));
    for (const e of LIBRARY) expect(AREAS).toContain(areaOf(e.muscle));
    setLang('fr');
    expect(['legs', 'back', 'chest', 'core', 'shoulders', 'arms'].map((a) => areaLabel(a as never))).toEqual([
      'Jambes',
      'Dos',
      'Pectoraux',
      'Abdos',
      'Épaules',
      'Bras',
    ]);
    expect(muscleLabel('lats')).toBe('Dos');
    expect(muscleLabel('quads')).toBe('Jambes');
    setLang('en');
    expect(muscleLabel('upper_back')).toBe('Back');
  });
});
