/**
 * Time ranges chosen on statistics screens: a preset (last N days) or any dates. Pure helpers,
 * tested in period.test.ts. `to` is exclusive (the start of the day after the last one).
 */
import { weekStart } from './utils';

const DAY = 86400000;

export type Period = { kind: 'last'; days: number } | { kind: 'dates'; from: string; to: string };
export interface Range {
  from: number;
  to: number;
}

const dayStart = (key: string) => new Date(key + 'T00:00').getTime();
const startOfToday = (now: number) => new Date(new Date(now).toDateString()).getTime();

export function rangeOf(p: Period, now = Date.now()): Range {
  if (p.kind === 'dates') {
    const [a, b] = p.from <= p.to ? [p.from, p.to] : [p.to, p.from];
    return { from: dayStart(a), to: dayStart(b) + DAY };
  }
  const to = startOfToday(now) + DAY;
  return { from: to - p.days * DAY, to };
}

/** The range of the same length just before (to compare with). */
export const previousRange = (r: Range): Range => ({ from: r.from - (r.to - r.from), to: r.from });

/** Monday (or Sunday) of every week touching the range, oldest first, at most `max` weeks (the latest). */
export function weeksIn(r: Range, max = 104): number[] {
  const out: number[] = [];
  for (let w = weekStart(r.to - 1); w >= weekStart(r.from) && out.length < max; w = weekStart(w - 3.5 * DAY)) out.unshift(w);
  return out;
}

/** Day key (YYYY-MM-DD, local) of a time. */
export function dayKeyAt(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
