import { describe, expect, it } from 'vitest';
import { phasesOf, totalSeconds } from './intervals';

describe('interval plans', () => {
  it('builds prepare, rounds with rests between them, cycle rests and cool-down', () => {
    const p = { prepare: 10, work: 20, rest: 10, rounds: 3, cycles: 2, cycleRest: 60, cooldown: 30, moves: ['A', 'B'] };
    const ph = phasesOf(p);
    expect(ph.map((x) => x.kind).join(',')).toBe('prepare,work,rest,work,rest,work,cycleRest,work,rest,work,rest,work,cooldown');
    expect(ph.filter((x) => x.kind === 'work').map((x) => x.move).join('')).toBe('ABABAB');
    expect(totalSeconds(p)).toBe(10 + 6 * 20 + 4 * 10 + 60 + 30);
  });
  it('skips zero-length rests', () => {
    expect(phasesOf({ prepare: 0, work: 60, rest: 0, rounds: 3, cycles: 1, cycleRest: 0, cooldown: 0 }).length).toBe(3);
  });
});
