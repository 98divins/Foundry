import { describe, expect, it } from 'vitest';
import { memoByRef } from './memo';
import { computePRs } from './utils';

describe('memoised computations', () => {
  it('compute once per input and argument, again for a new input', () => {
    let runs = 0;
    const f = memoByRef((xs: number[], k: number) => (runs++, xs.length * k));
    const a = [1, 2, 3];
    expect(f(a, 2)).toBe(6);
    expect(f(a, 2)).toBe(6);
    expect(runs).toBe(1);
    expect(f(a, 3)).toBe(9);
    expect(f([...a], 2)).toBe(6);
    expect(runs).toBe(3);
  });
  it('records are computed once for the same list of workouts', () => {
    const ws = [{ id: 'w', name: 'W', startedAt: 1, endedAt: 2, exercises: [] }];
    expect(computePRs(ws)).toBe(computePRs(ws));
    expect(computePRs([...ws])).not.toBe(computePRs(ws));
  });
});
