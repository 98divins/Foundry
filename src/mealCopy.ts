/**
 * Faster logging (plan 4.4): copy a meal from a previous day, and reuse the last portion of a food.
 * Pure functions, tested in mealCopy.test.ts.
 */
import { addDays, type FoodEntry, type Meal } from './nutrition';

/** The same meal on the most recent earlier day that has it (up to `maxDays` back). Planned entries are skipped. */
export function previousMeal(log: FoodEntry[], date: string, meal: Meal, maxDays = 7): { date: string; entries: FoodEntry[] } | null {
  for (let i = 1; i <= maxDays; i++) {
    const d = addDays(date, -i);
    const entries = log.filter((e) => e.date === d && e.meal === meal && !e.planned).sort((a, b) => a.createdAt - b.createdAt);
    if (entries.length) return { date: d, entries };
  }
  return null;
}

/** Copies entries to another day and meal: new ids, same foods and amounts; a saved-meal group stays one group. */
export function copyEntries(entries: FoodEntry[], date: string, meal: Meal, makeId: () => string, now: number, today: string): FoodEntry[] {
  const groups = new Map<string, string>();
  return entries.map((e, i) => {
    const copy: FoodEntry = { ...e, id: makeId(), date, meal, createdAt: now + i };
    if (date > today) copy.planned = true;
    else delete copy.planned;
    if (e.group) {
      if (!groups.has(e.group.id)) groups.set(e.group.id, makeId());
      copy.group = { ...e.group, id: groups.get(e.group.id)! };
    }
    return copy;
  });
}

/** The amount last logged for a food (grams), or null when it was never logged with an amount. */
export function lastPortion(log: FoodEntry[], foodId: string): number | null {
  let best: FoodEntry | null = null;
  for (const e of log) if (e.foodId === foodId && e.grams && (!best || e.createdAt > best.createdAt)) best = e;
  return best?.grams ?? null;
}
