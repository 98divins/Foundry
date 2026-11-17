/**
 * Ready-made meal ideas: classic, balanced and quick to prepare. Ingredients point to built-in foods,
 * so calories and macros come from the same values as the rest of the app.
 */
import { FR_FOOD_LIST } from './foods';
import { tk } from './i18n';
import { scaleFood, type MealItem } from './nutrition';

export type IdeaTag = 'breakfast' | 'main' | 'snack' | 'veggie';

export interface MealIdea {
  id: string;
  name: string;
  description: string;
  tags: IdeaTag[];
  minutes: number;
  ingredients: [foodId: string, grams: number][];
}

export const MEAL_IDEAS: MealIdea[] = [
  {
    id: 'overnight-oats-whey',
    name: tk('Overnight oats with whey'),
    description: tk('Mix the night before, eat cold in the morning. Oats, milk, whey, chia and red fruit.'),
    tags: ['breakfast'],
    minutes: 5,
    ingredients: [
      ['g-fr-flocons-d-avoine', 60],
      ['g-fr-lait-demi-ecreme', 150],
      ['g-fr-whey-proteine', 30],
      ['g-fr-graines-de-chia', 10],
      ['g-fr-fruits-rouges-surgeles', 80],
    ],
  },
  {
    id: 'eggs-toast-avocado',
    name: tk('Eggs, wholemeal toast and avocado'),
    description: tk('Three eggs scrambled or fried, two slices of wholemeal bread, half an avocado and cherry tomatoes.'),
    tags: ['breakfast', 'veggie'],
    minutes: 10,
    ingredients: [
      ['g-fr-uf-entier-cru', 150],
      ['g-fr-pain-complet', 70],
      ['g-fr-avocat', 70],
      ['g-fr-tomates-cerises', 100],
    ],
  },
  {
    id: 'skyr-granola-banana',
    name: tk('Skyr, granola and banana'),
    description: tk('A high-protein bowl ready in two minutes.'),
    tags: ['breakfast', 'snack', 'veggie'],
    minutes: 2,
    ingredients: [
      ['g-fr-skyr-nature', 200],
      ['g-fr-granola', 40],
      ['g-fr-banane', 100],
    ],
  },
  {
    id: 'chicken-rice-broccoli',
    name: tk('Chicken, rice and broccoli'),
    description: tk('The classic: chicken breast, basmati rice, broccoli and a drizzle of olive oil.'),
    tags: ['main'],
    minutes: 20,
    ingredients: [
      ['g-fr-blanc-de-poulet-cuit', 150],
      ['g-fr-riz-basmati-cuit', 200],
      ['g-fr-brocoli-cuit', 150],
      ['g-fr-huile-d-olive', 5],
    ],
  },
  {
    id: 'salmon-sweet-potato',
    name: tk('Salmon, sweet potato and green beans'),
    description: tk('Oven-baked salmon fillet with sweet potato and green beans.'),
    tags: ['main'],
    minutes: 25,
    ingredients: [
      ['g-fr-saumon-d-elevage-cuit', 125],
      ['g-fr-patate-douce-cuite', 200],
      ['g-fr-haricots-verts-cuits', 150],
    ],
  },
  {
    id: 'beef-pasta-tomato',
    name: tk('Lean beef pasta with tomato sauce'),
    description: tk('Wholemeal pasta, 5 % fat minced beef and plain tomato sauce, grated cheese on top.'),
    tags: ['main'],
    minutes: 15,
    ingredients: [
      ['g-fr-pates-completes-cuites', 200],
      ['g-fr-buf-hache-5-mg-cru', 125],
      ['g-fr-coulis-sauce-tomate-nature', 120],
      ['g-fr-fromage-rape-emmental', 15],
    ],
  },
  {
    id: 'tuna-quinoa-salad',
    name: tk('Tuna and quinoa salad'),
    description: tk('Cold salad: quinoa, tuna, cucumber, cherry tomatoes and a little olive oil.'),
    tags: ['main'],
    minutes: 10,
    ingredients: [
      ['g-fr-quinoa-cuit', 180],
      ['g-fr-thon-au-naturel-egoutte', 112],
      ['g-fr-concombre', 100],
      ['g-fr-tomates-cerises', 100],
      ['g-fr-huile-d-olive', 10],
    ],
  },
  {
    id: 'chicken-wrap',
    name: tk('Chicken wrap'),
    description: tk('Wheat tortilla, chicken, salad, carrot and a spoon of hummus.'),
    tags: ['main'],
    minutes: 10,
    ingredients: [
      ['g-fr-tortilla-de-ble', 60],
      ['g-fr-blanc-de-poulet-cuit', 120],
      ['g-fr-salade-verte', 30],
      ['g-fr-carotte-crue', 50],
      ['g-fr-houmous', 30],
    ],
  },
  {
    id: 'tofu-stir-fry',
    name: tk('Tofu and vegetable stir-fry with rice'),
    description: tk('Firm tofu and frozen stir-fry vegetables in a pan with soy sauce, on brown rice.'),
    tags: ['main', 'veggie'],
    minutes: 15,
    ingredients: [
      ['g-fr-tofu-ferme', 150],
      ['g-fr-legumes-pour-poelee-surgeles', 200],
      ['g-fr-riz-complet-cuit', 180],
      ['g-fr-sauce-soja', 15],
      ['g-fr-huile-d-olive', 5],
    ],
  },
  {
    id: 'lentil-bowl',
    name: tk('Lentil and feta bowl'),
    description: tk('Lentils, rice, red pepper, courgette and feta: complete plant and dairy protein.'),
    tags: ['main', 'veggie'],
    minutes: 15,
    ingredients: [
      ['g-fr-lentilles-cuites', 200],
      ['g-fr-riz-blanc-cuit', 100],
      ['g-fr-poivron-rouge', 80],
      ['g-fr-courgette', 100],
      ['g-fr-feta', 30],
    ],
  },
  {
    id: 'ham-cheese-omelette',
    name: tk('Ham and cheese omelette with salad'),
    description: tk('Three-egg omelette with ham and emmental, a green salad on the side.'),
    tags: ['main'],
    minutes: 10,
    ingredients: [
      ['g-fr-uf-entier-cru', 150],
      ['g-fr-jambon-blanc-tranche', 40],
      ['g-fr-emmental-gruyere', 20],
      ['g-fr-salade-verte', 50],
      ['g-fr-pain-complet', 35],
    ],
  },
  {
    id: 'quark-fruit-almonds',
    name: tk('Fat-free quark, red fruit and almonds'),
    description: tk('A light, protein-rich snack.'),
    tags: ['snack', 'veggie'],
    minutes: 2,
    ingredients: [
      ['g-fr-fromage-blanc-0', 200],
      ['g-fr-fruits-rouges-surgeles', 100],
      ['g-fr-amandes', 15],
      ['g-fr-miel', 10],
    ],
  },
  {
    id: 'protein-shake-banana-pb',
    name: tk('Banana and peanut butter protein shake'),
    description: tk('Blend whey, milk, a banana and a spoon of peanut butter.'),
    tags: ['snack', 'breakfast'],
    minutes: 3,
    ingredients: [
      ['g-fr-whey-proteine', 30],
      ['g-fr-lait-demi-ecreme', 250],
      ['g-fr-banane', 100],
      ['g-fr-beurre-de-cacahuete', 15],
    ],
  },
  {
    id: 'chickpea-salad',
    name: tk('Chickpea, cucumber and feta salad'),
    description: tk('Chickpeas, cucumber, cherry tomatoes, feta and olive oil. No cooking.'),
    tags: ['main', 'veggie'],
    minutes: 5,
    ingredients: [
      ['g-fr-pois-chiches-en-conserve-egouttes', 200],
      ['g-fr-concombre', 100],
      ['g-fr-tomates-cerises', 100],
      ['g-fr-feta', 40],
      ['g-fr-huile-d-olive', 10],
    ],
  },
];

const byId = new Map(FR_FOOD_LIST.map((f) => [f.id, f]));

/** Ingredients with their calories and macros, ready to become a saved meal. */
export function ideaItems(idea: MealIdea): MealItem[] {
  return idea.ingredients.flatMap(([id, grams]) => {
    const f = byId.get(id);
    return f ? [{ foodId: f.id, name: f.name, grams, ...scaleFood(f, grams) }] : [];
  });
}
