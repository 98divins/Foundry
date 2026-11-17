import { describe, expect, it } from 'vitest';
import { platesPerSide } from './plates';

describe('plate calculator (4.3)', () => {
  it('loads the largest plates first', () => {
    expect(platesPerSide(100, 20, 'kg')).toEqual({ plates: [25, 15], left: 0 });
    expect(platesPerSide(142.5, 20, 'kg')).toEqual({ plates: [25, 25, 10, 1.25], left: 0 });
    expect(platesPerSide(225, 45, 'lb')).toEqual({ plates: [45, 45], left: 0 });
  });
  it('the empty bar needs no plate; lighter than the bar is impossible', () => {
    expect(platesPerSide(20, 20, 'kg')).toEqual({ plates: [], left: 0 });
    expect(platesPerSide(15, 20, 'kg')).toBeNull();
  });
  it('says what cannot be loaded with standard plates', () => {
    expect(platesPerSide(101, 20, 'kg')).toEqual({ plates: [25, 15], left: 0.5 });
  });
});
