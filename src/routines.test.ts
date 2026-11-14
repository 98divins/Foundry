import { describe, expect, it } from 'vitest';
import { LIBRARY } from './exercises';
import {
  codeFromText,
  decodeRoutines,
  encodeRoutines,
  exerciseRepRange,
  linkWithNext,
  liveSetFromRoutine,
  parseRepRange,
  routineSummary,
  supersetSlots,
  unlink,
} from './routines';
import type { Routine, SetEntry, WorkoutExercise } from './types';

const exMap = new Map(LIBRARY.map((e) => [e.id, e]));
const s = (reps: number | null, repsMax: number | null = null): SetEntry => ({
  id: Math.random().toString(36),
  type: 'normal',
  weight: null,
  reps,
  repsMax,
  done: false,
});
const block = (exerciseId: string, sets: SetEntry[], restSec = 90, supersetId?: string): WorkoutExercise => ({
  id: Math.random().toString(36),
  exerciseId,
  restSec,
  sets,
  ...(supersetId ? { supersetId } : {}),
});

describe('rep ranges', () => {
  it('parses numbers and ranges', () => {
    expect(parseRepRange('8-12')).toEqual({ reps: 8, repsMax: 12 });
    expect(parseRepRange(' 10 ')).toEqual({ reps: 10, repsMax: null });
    expect(parseRepRange('8-')).toEqual({ reps: 8, repsMax: null });
    expect(parseRepRange('12-8')).toEqual({ reps: 12, repsMax: null });
    expect(parseRepRange('')).toEqual({ reps: null, repsMax: null });
    expect(parseRepRange('abc')).toBeUndefined();
  });

  it('summarises the range across sets', () => {
    expect(exerciseRepRange([s(4, 6), s(8, 10)])).toBe('4-10');
    expect(exerciseRepRange([s(15), s(15)])).toBe('15');
    expect(exerciseRepRange([s(null)])).toBe('');
  });

  it('turns routine targets into hints on live sets', () => {
    const live = liveSetFromRoutine({ ...s(8, 12), weight: 40 });
    expect(live).toMatchObject({ reps: null, repsMax: null, weight: 40, done: false, target: { reps: 8, repsMax: 12 } });
  });
});

describe('supersets', () => {
  const list = [block('a', []), block('b', []), block('c', []), block('d', [])];

  it('groups consecutive exercises and ignores lone ids', () => {
    const linked = linkWithNext(linkWithNext(list, 0), 2);
    const slots = supersetSlots(linked);
    expect(slots.map((x) => x.group)).toEqual([0, 0, 1, 1]);
    expect(slots.map((x) => [x.first, x.last])).toEqual([[true, false], [false, true], [true, false], [false, true]]);
    expect(supersetSlots(unlink(linked, 1)).map((x) => x.group)).toEqual([null, null, 0, 0]);
  });

  it('extends an existing superset to three exercises', () => {
    const three = linkWithNext(linkWithNext(list, 0), 1);
    expect(supersetSlots(three).map((x) => x.group)).toEqual([0, 0, 0, null]);
  });
});

describe('summary', () => {
  it('counts sets per muscle and estimates time from rest', () => {
    const sum = routineSummary(
      [block('bench_bb', [s(8), s(8)], 150), block('pull_up', [s(6), { ...s(10), type: 'warmup' }], 90)],
      exMap,
    );
    expect(sum).toMatchObject({ exercises: 2, sets: 4 });
    expect(sum.seconds).toBe(2 * (45 + 150) + 2 * (45 + 90));
    expect(sum.muscles).toEqual([
      ['chest', 2],
      ['lats', 1],
    ]);
  });
});

describe('share links', () => {
  const routine: Routine = {
    id: 'r1',
    name: 'Upper A',
    updatedAt: 0,
    folderId: 'f1',
    exercises: [
      { ...block('bench_bb', [s(6, 10), s(6, 10)], 150), note: '45° bench. RIR 1-2.' },
      block('face_pull', [s(10, 12)], 30, 'x'),
      block('lateral_raise_cable', [s(10, 15)], 90, 'x'),
    ],
  };

  it('round-trips routines, folder, notes, ranges and supersets', async () => {
    const code = await encodeRoutines({ id: 'f1', name: 'Upper/Lower x2' }, [routine]);
    expect(code[0]).toBe('z');
    const back = await decodeRoutines(code);
    expect(back.folder).toBe('Upper/Lower x2');
    const r = back.routines[0];
    expect(r.name).toBe('Upper A');
    expect(r.id).not.toBe('r1');
    expect(r.exercises.map((we) => we.exerciseId)).toEqual(['bench_bb', 'face_pull', 'lateral_raise_cable']);
    expect(r.exercises[0].note).toBe('45° bench. RIR 1-2.');
    expect(r.exercises[0].sets[1]).toMatchObject({ reps: 6, repsMax: 10, done: false });
    expect(supersetSlots(r.exercises).map((x) => x.group)).toEqual([null, 0, 0]);
  });

  it('finds the code in a pasted link', () => {
    expect(codeFromText('https://x.github.io/Foundry/#/import/zAbc123_-xyz')).toBe('zAbc123_-xyz');
    expect(codeFromText('  zAbc123_-xyz ')).toBe('zAbc123_-xyz');
    expect(codeFromText('hello')).toBeNull();
  });

  it('explains a damaged link', async () => {
    await expect(decodeRoutines('zNotReallyAPack')).rejects.toThrow(/incomplete or damaged/);
  });
});
