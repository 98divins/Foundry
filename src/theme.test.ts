import { describe, expect, it } from 'vitest';
import { contrast, inkFor, parseHex, readableOn } from './theme';

describe('custom accent', () => {
  it('keeps every colour readable on both backgrounds', () => {
    for (const hex of ['#f2c230', '#ffffff', '#000000', '#3d5bff', '#ec4899', '#123456']) {
      expect(contrast(parseHex(readableOn(hex, [13, 16, 21]))!, [13, 16, 21])).toBeGreaterThanOrEqual(3);
      expect(contrast(parseHex(readableOn(hex, [243, 245, 248]))!, [243, 245, 248])).toBeGreaterThanOrEqual(3);
    }
  });
  it('leaves an already readable colour alone', () => {
    expect(readableOn('#3d5bff', [13, 16, 21])).toBe('#3d5bff');
  });
  it('puts dark text on light accents', () => {
    expect(inkFor('#f2c230')).toBe('#0d1015');
    expect(inkFor('#2443f2')).toBe('#ffffff');
  });
});
