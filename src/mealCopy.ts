/** Faster logging (plan 4.4): reuse the last portion of a food. Tested in mealCopy.test.ts. */
import type { FoodEntry } from './nutrition';

/** The amount last logged for a food (grams), or null when it was never logged with an amount. */
export function lastPortion(log: FoodEntry[], foodId: string): number | null {
  let best: FoodEntry | null = null;
  for (const e of log) if (e.foodId === foodId && e.grams && (!best || e.createdAt > best.createdAt)) best = e;
  return best?.grams ?? null;
}
