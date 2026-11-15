import { describe, expect, it } from 'vitest';
import { workbook } from './xlsx';
import { buildWorkbook } from './export';
import { defaultState } from './store';

describe('xlsx writer', () => {
  it('produces a valid zip with the workbook parts', async () => {
    const blob = workbook([{ name: 'Test', rows: [['A', 'B'], [1, 'x & y']] }]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Local file header signature at the start, end-of-central-directory signature at the end.
    expect([...buf.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...buf.slice(buf.length - 22, buf.length - 18)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
    const text = new TextDecoder().decode(buf);
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('x &amp; y');
    expect(text).toContain('<v>1</v>');
  });
  it('builds the export from an empty state without crashing', async () => {
    const blob = buildWorkbook(defaultState(), new Map());
    expect(blob.size).toBeGreaterThan(1000);
  });
});
