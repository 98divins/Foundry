import { describe, expect, it } from 'vitest';
import { isHidden, withHidden } from './reports';

describe('reported content', () => {
  it('is hidden for the person who reported it', () => {
    const h = withHidden(undefined, 'food', 'c-1');
    expect(isHidden(h, 'food', 'c-1')).toBe(true);
    expect(isHidden(h, 'meal', 'c-1')).toBe(false);
    expect(isHidden(h, 'food', 'c-2')).toBe(false);
  });
  it('keeps no duplicates and a bounded list', () => {
    let h: string[] = [];
    for (let i = 0; i < 600; i++) h = withHidden(h, 'comment', String(i % 550));
    expect(new Set(h).size).toBe(h.length);
    expect(h.length).toBeLessThanOrEqual(500);
    expect(isHidden(h, 'comment', '549')).toBe(true);
  });
});
