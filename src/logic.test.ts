import { describe, expect, it } from 'vitest';
import { exportWorkoutCsv, importWorkoutCsv, parseCSV, parseDate } from './csv';
import { LIBRARY } from './exercises';
import type { SetEntry, Workout } from './types';
import { computePRs, epley, exerciseSessions, fromDisplay, niceTicks, previousSets, toDisplay } from './utils';

const set = (id: string, weight: number | null, reps: number, extra: Partial<SetEntry> = {}): SetEntry => ({
  id,
  type: 'normal',
  weight,
  reps,
  done: true,
  ...extra,
});

const workout = (id: string, day: number, exerciseId: string, sets: SetEntry[]): Workout => ({
  id,
  name: 'W' + id,
  startedAt: Date.UTC(2026, 0, day, 10),
  endedAt: Date.UTC(2026, 0, day, 11),
  exercises: [{ id: 'we' + id, exerciseId, restSec: 90, sets }],
});

describe('numbers', () => {
  it('estimates 1RM with Epley', () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(100, 10)).toBeCloseTo(133.33, 1);
    expect(epley(0, 5)).toBe(0);
  });

  it('round-trips pounds', () => {
    expect(toDisplay(fromDisplay(225, 'lb'), 'lb')).toBe(225);
    expect(toDisplay(82.5, 'kg')).toBe(82.5);
  });

  it('builds round axis ticks', () => {
    expect(niceTicks(62, 98, 4)).toEqual([60, 70, 80, 90, 100]);
  });
});

describe('records', () => {
  const history = [
    workout('1', 1, 'bench_bb', [set('a', 80, 5), set('b', 80, 5)]),
    workout('2', 3, 'bench_bb', [set('c', 85, 3), set('d', 80, 8)]),
    workout('3', 5, 'bench_bb', [set('e', 60, 10, { type: 'warmup' }), set('f', 82.5, 5)]),
  ];

  it('first session is the baseline, later improvements are flagged once', () => {
    const prs = computePRs(history);
    expect(prs.has('a')).toBe(false);
    expect(prs.get('c')).toContain('weight');
    expect(prs.get('d')).toEqual(expect.arrayContaining(['1rm', 'volume']));
    expect(prs.has('e')).toBe(false); // warm-ups never count
    expect(prs.has('f')).toBe(false);
  });

  it('summarises sessions per exercise', () => {
    const s = exerciseSessions(history, 'bench_bb');
    expect(s).toHaveLength(3);
    expect(s[1].bestWeight).toBe(85);
    expect(s[2].sets).toHaveLength(1);
  });

  it('finds the previous session before a date', () => {
    const prev = previousSets(history, 'bench_bb', Date.UTC(2026, 0, 4));
    expect(prev.map((x) => x.id)).toEqual(['c', 'd']);
  });

  it('flags rep records for bodyweight work', () => {
    const prs = computePRs([
      workout('1', 1, 'pull_up', [set('a', null, 8)]),
      workout('2', 2, 'pull_up', [set('b', null, 10)]),
    ]);
    expect(prs.get('b')).toEqual(['reps']);
  });
});

describe('csv', () => {
  it('parses quotes and newlines', () => {
    expect(parseCSV('a,"b,c","say ""hi"""\r\n1,"two\nlines",3\n')).toEqual([
      ['a', 'b,c', 'say "hi"'],
      ['1', 'two\nlines', '3'],
    ]);
  });

  it('parses export dates', () => {
    expect(new Date(parseDate('14 Nov 2026, 18:05')!).getHours()).toBe(18);
  });

  const csv = [
    'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
    'Push,"12 Nov 2026, 18:00","12 Nov 2026, 19:10",,Bench Press (Barbell),,,0,warmup,40,10,,,',
    'Push,"12 Nov 2026, 18:00","12 Nov 2026, 19:10",,Bench Press (Barbell),,,1,normal,80,5,,,',
    'Push,"12 Nov 2026, 18:00","12 Nov 2026, 19:10",,Landmine Press,,,0,normal,30,10,,,',
    'Push,"12 Nov 2026, 18:00","12 Nov 2026, 19:10",,Ring Dip,,,0,failure,,12,,,',
    'Legs,"14 Nov 2026, 09:00","14 Nov 2026, 10:00",Felt strong,Squat (Barbell),,,0,dropset,100,5,,,',
  ].join('\n');

  it('imports workouts, matches known exercises and creates unknown ones', () => {
    const res = importWorkoutCsv(csv, LIBRARY, []);
    expect(res.workouts).toHaveLength(2);
    const push = res.workouts[0];
    expect(push.exercises).toHaveLength(3);
    expect(push.exercises[0].exerciseId).toBe('bench_bb');
    expect(push.exercises[0].sets.map((s) => s.type)).toEqual(['warmup', 'normal']);
    expect(push.endedAt! - push.startedAt).toBe(70 * 60000);
    expect(res.newExercises.map((e) => e.name).sort()).toEqual(['Landmine Press', 'Ring Dip']);
    expect(res.newExercises.find((e) => e.name === 'Ring Dip')!.kind).toBe('bodyweight');
    expect(res.workouts[1].note).toBe('Felt strong');
    expect(res.workouts[1].exercises[0].sets[0].type).toBe('drop');
  });

  it('skips workouts that are already imported', () => {
    const first = importWorkoutCsv(csv, LIBRARY, []);
    const again = importWorkoutCsv(csv, [...LIBRARY, ...first.newExercises], first.workouts);
    expect(again.workouts).toHaveLength(0);
    expect(again.skippedDuplicates).toBe(2);
  });

  it('round-trips through its own export', () => {
    const first = importWorkoutCsv(csv, LIBRARY, []);
    const all = [...LIBRARY, ...first.newExercises];
    const out = exportWorkoutCsv(first.workouts, new Map(all.map((e) => [e.id, e])));
    const back = importWorkoutCsv(out, all, []);
    expect(back.workouts).toHaveLength(2);
    expect(back.workouts[0].exercises.flatMap((e) => e.sets)).toHaveLength(4);
    expect(back.newExercises).toHaveLength(0);
  });

  it('rejects files without workout columns', () => {
    expect(() => importWorkoutCsv('name,value\na,1', LIBRARY, [])).toThrow(/Missing column/);
  });
});
