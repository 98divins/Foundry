import { describe, expect, it } from 'vitest';
import { exportWorkoutCsv, importWorkoutCsv, parseCSV, parseDate } from './csv';
import { LIBRARY } from './exercises';
import type { SetEntry, Workout } from './types';
import {
  computePRs,
  epley,
  exerciseSessions,
  fmtSet,
  hasEntry,
  fromDisplay,
  niceTicks,
  parseTime,
  previousSets,
  registerKinds,
  toDisplay,
  workoutVolume,
} from './utils';

const kinds = new Map(LIBRARY.map((e) => [e.id, e.kind]));
registerKinds((id) => kinds.get(id) ?? 'weight');

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
    const prs = computePRs([workout('1', 1, 'pull_up', [set('a', null, 8)]), workout('2', 2, 'pull_up', [set('b', null, 10)])]);
    expect(prs.get('b')).toEqual(['reps']);
  });
});

describe('exercise kinds', () => {
  it('library covers the full list with unique ids', () => {
    expect(LIBRARY.length).toBe(451);
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
    expect(LIBRARY.find((e) => e.id === 'bench_bb')?.nameFr).toBe('Développé couché (barre)');
    expect(LIBRARY.find((e) => e.name === 'Plank')?.kind).toBe('duration');
    expect(LIBRARY.find((e) => e.name === 'Running')?.kind).toBe('cardio');
    expect(LIBRARY.find((e) => e.name === 'Pull Up (Assisted)')?.kind).toBe('assisted');
  });

  it('knows when a set has something typed in', () => {
    expect(hasEntry(set('a', 80, 8), 'weight')).toBe(true);
    expect(hasEntry({ ...set('a', null, 8) }, 'weight')).toBe(false);
    expect(hasEntry({ ...set('a', null, 0), reps: null, target: { reps: 8, repsMax: 12 } }, 'bodyweight')).toBe(false);
    expect(hasEntry(set('a', null, 10), 'bodyweight')).toBe(true);
    expect(hasEntry({ ...set('a', null, 0), reps: null, duration: 60 }, 'duration')).toBe(true);
    expect(hasEntry({ ...set('a', null, 0), reps: null, distance: 3 }, 'cardio')).toBe(true);
  });

  it('parses times typed on a number pad', () => {
    expect(parseTime('90', 'sec')).toBe(90);
    expect(parseTime('25', 'min')).toBe(1500);
    expect(parseTime('1:30', 'sec')).toBe(90);
    expect(parseTime('1:02:00', 'min')).toBe(3720);
    expect(parseTime('', 'sec')).toBe(null);
    expect(parseTime('1:x', 'sec')).toBe(undefined);
  });

  it('formats sets per kind', () => {
    expect(fmtSet({ weight: 80, reps: 8 }, 'weight', 'kg')).toBe('80 kg × 8');
    expect(fmtSet({ weight: 10, reps: 6 }, 'bodyweight', 'kg')).toBe('+10 kg × 6');
    expect(fmtSet({ weight: null, reps: 12 }, 'bodyweight', 'kg')).toBe('12 reps');
    expect(fmtSet({ weight: 20, reps: 8 }, 'assisted', 'kg')).toBe('−20 kg × 8');
    expect(fmtSet({ weight: null, reps: null, duration: 90 }, 'duration', 'kg')).toBe('1:30');
    expect(fmtSet({ weight: null, reps: null, duration: 1500, distance: 5 }, 'cardio', 'kg')).toBe('5 km · 25:00');
  });

  it('keeps assistance, holds and cardio out of volume', () => {
    const w: Workout = {
      ...workout('1', 1, 'pull_up_assisted', [set('a', 30, 8)]),
      exercises: [
        { id: 'x', exerciseId: 'pull_up_assisted', restSec: 90, sets: [set('a', 30, 8)] },
        { id: 'y', exerciseId: 'bench_bb', restSec: 90, sets: [set('b', 100, 5)] },
      ],
    };
    expect(workoutVolume(w)).toBe(500);
  });

  it('flags longest hold and farthest run', () => {
    const t = (id: string, duration: number, distance: number | null = null): SetEntry => ({
      ...set(id, null, 0),
      reps: null,
      duration,
      distance,
    });
    const prs = computePRs([
      workout('1', 1, 'plank', [t('a', 60)]),
      workout('2', 2, 'plank', [t('b', 90)]),
      workout('3', 3, 'running', [t('c', 1500, 5)]),
      workout('4', 4, 'running', [t('d', 1400, 6)]),
    ]);
    expect(prs.get('b')).toEqual(['duration']);
    expect(prs.get('d')).toEqual(['distance']);
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

  it('imports durations, distances and French exercise names', () => {
    const text = [
      'title,start_time,end_time,exercise_title,set_type,weight_kg,reps,distance_km,duration_seconds',
      'Cardio,"10 Nov 2026, 07:00","10 Nov 2026, 07:40",Course à pied,normal,,,5.2,1680',
      'Cardio,"10 Nov 2026, 07:00","10 Nov 2026, 07:40",Planche,normal,,,,75',
    ].join('\n');
    const res = importWorkoutCsv(text, LIBRARY, []);
    expect(res.newExercises).toHaveLength(0);
    const [run, plank] = res.workouts[0].exercises;
    expect(run.exerciseId).toBe('running');
    expect(run.sets[0]).toMatchObject({ distance: 5.2, duration: 1680 });
    expect(plank.exerciseId).toBe('plank');
    expect(plank.sets[0].duration).toBe(75);
  });

  it('rejects files without workout columns', () => {
    expect(() => importWorkoutCsv('name,value\na,1', LIBRARY, [])).toThrow(/Missing column/);
  });
});

describe('height units', () => {
  it('converts between cm and feet + inches', async () => {
    const { cmToFtIn, ftInToCm, fmtHeight } = await import('./utils');
    expect(cmToFtIn(180)).toEqual({ ft: 5, inch: 11 });
    expect(cmToFtIn(152.4)).toEqual({ ft: 5, inch: 0 });
    expect(ftInToCm(5, 11)).toBe(180.3);
    expect(cmToFtIn(ftInToCm(6, 2))).toEqual({ ft: 6, inch: 2 });
    expect(fmtHeight(180, 'in')).toBe('5′11″');
    expect(fmtHeight(180.3)).toBe('180 cm');
  });
});

describe('display preferences', () => {
  it('starts weeks on Monday or Sunday', async () => {
    const { registerPrefs, weekStart } = await import('./utils');
    const wed = new Date(2026, 10, 11, 15).getTime(); // Wednesday 11 Nov 2026
    registerPrefs({ weekStartsOn: 1 });
    expect(new Date(weekStart(wed)).getDate()).toBe(9); // Monday
    registerPrefs({ weekStartsOn: 0 });
    expect(new Date(weekStart(wed)).getDate()).toBe(8); // Sunday
    expect(new Date(weekStart(new Date(2026, 10, 8, 9).getTime())).getDate()).toBe(8);
    registerPrefs({ weekStartsOn: 1 });
  });

  it('shows distances in km or miles, storing km', async () => {
    const { registerPrefs, fmtKm, displayToKm, kmToDisplay } = await import('./utils');
    registerPrefs({ distanceUnit: 'mi' });
    expect(fmtKm(10)).toBe('6.21 mi');
    expect(kmToDisplay(displayToKm(3.1))).toBe(3.1);
    registerPrefs({ distanceUnit: 'km' });
    expect(fmtKm(5)).toBe('5 km');
  });
});

describe('pausing a workout', () => {
  it('leaves paused time out of the duration', async () => {
    const { workoutElapsed } = await import('./utils');
    const t0 = 1_000_000;
    expect(workoutElapsed({ startedAt: t0 }, t0 + 60_000)).toBe(60_000);
    // Paused for 20 s earlier, now running again.
    expect(workoutElapsed({ startedAt: t0, pausedMs: 20_000 }, t0 + 60_000)).toBe(40_000);
    // Paused since t0 + 30 s: the clock stays at 30 s.
    expect(workoutElapsed({ startedAt: t0, pausedAt: t0 + 30_000 }, t0 + 90_000)).toBe(30_000);
  });
});
