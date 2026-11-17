import { describe, expect, it } from 'vitest';
import { previousRange, rangeOf, weeksIn, dayKeyAt } from './period';

const NOW = new Date(2026, 10, 18, 15, 0).getTime(); // Wed 18 Nov 2026, 15:00
const DAY = 86400000;

describe('periods on statistics screens', () => {
  it('"last N days" ends tonight and spans N whole days', () => {
    const r = rangeOf({ kind: 'last', days: 30 }, NOW);
    expect(dayKeyAt(r.to - 1)).toBe('2026-11-18');
    expect(dayKeyAt(r.from)).toBe('2026-10-20');
    expect(Math.round((r.to - r.from) / DAY)).toBe(30);
  });

  it('any dates include both days, in any order', () => {
    const r = rangeOf({ kind: 'dates', from: '2026-11-10', to: '2026-11-01' }, NOW);
    expect(dayKeyAt(r.from)).toBe('2026-11-01');
    expect(dayKeyAt(r.to - 1)).toBe('2026-11-10');
  });

  it('the previous range has the same length, just before', () => {
    const r = rangeOf({ kind: 'dates', from: '2026-11-01', to: '2026-11-10' }, NOW);
    const p = previousRange(r);
    expect(dayKeyAt(p.from)).toBe('2026-10-22');
    expect(p.to).toBe(r.from);
  });

  it('lists the weeks touching a range, capped to the latest ones', () => {
    const r = rangeOf({ kind: 'dates', from: '2026-11-04', to: '2026-11-18' }, NOW);
    expect(weeksIn(r).map(dayKeyAt)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(weeksIn(rangeOf({ kind: 'last', days: 3650 }, NOW), 52)).toHaveLength(52);
  });
});
