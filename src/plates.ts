/** Plate calculator (plan 4.3): which plates to load on each side of the bar. Works in the display unit. */
import type { Unit } from './types';

export const PLATES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};
export const BARS: Record<Unit, number[]> = { kg: [20, 15, 10], lb: [45, 35, 25] };

/**
 * Plates per side for a total weight on a bar, largest first. `left` is what could not be loaded on
 * each side with standard plates (0 when exact). Null when the total is lighter than the bar.
 */
export function platesPerSide(total: number, bar: number, unit: Unit): { plates: number[]; left: number } | null {
  if (!(total >= bar)) return null;
  let side = (total - bar) / 2;
  const plates: number[] = [];
  for (const p of PLATES[unit]) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side -= p;
    }
  }
  return { plates, left: Math.round(side * 1000) / 1000 };
}
