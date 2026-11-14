import { describe, expect, it } from 'vitest';
import { LIBRARY } from './exercises';
import { PROGRAMS, routinesFromProgram } from './programs';

const ids = new Set(LIBRARY.map((e) => e.id));

describe('example programs', () => {
  it('only use exercises from the library', () => {
    for (const p of PROGRAMS) for (const r of p.routines) for (const we of r.exercises) expect(ids.has(we.exerciseId), we.exerciseId).toBe(true);
  });

  it('copy into fresh routines in a folder', () => {
    const [a, b] = [routinesFromProgram(PROGRAMS[0], 'f'), routinesFromProgram(PROGRAMS[0], 'f')];
    expect(a.map((r) => r.name)).toEqual(['Full Body A', 'Full Body B']);
    expect(a[0].folderId).toBe('f');
    expect(a[0].id).not.toBe(b[0].id);
    expect(new Set(a.flatMap((r) => r.exercises.flatMap((we) => we.sets.map((s) => s.id)))).size).toBe(
      a.reduce((n, r) => n + r.exercises.reduce((m, we) => m + we.sets.length, 0), 0),
    );
    expect(a[0].exercises[0].sets[0]).toMatchObject({ reps: 6, repsMax: 8, done: false });
  });
});
