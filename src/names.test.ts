import { describe, expect, it } from 'vitest';

/** Real people's names must not appear in the app without a signed agreement (docs/PLAN_CORRECTIF.md, 2.6). */
const FORBIDDEN = ['nippard', 'bumstead', 'cbum', 'israetel', 'schwarzenegger', 'jeff seid', 'zyzz', 'sulek', 'tibo inshape', 'jujufitcat'];

const sources = {
  ...import.meta.glob(['/src/**/*.{ts,tsx,css}', '!/src/names.test.ts'], { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob(['/public/**/*.{json,webmanifest}', '/index.html'], { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;

describe('no real person’s name', () => {
  it('appears in the app’s code, texts or data', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const hits: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      const low = text.toLowerCase();
      for (const n of FORBIDDEN) if (new RegExp(`\\b${n}\\b`).test(low)) hits.push(`${file}: ${n}`);
    }
    expect(hits).toEqual([]);
  });
});
