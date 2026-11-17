import { describe, expect, it } from 'vitest';
import { importWorkoutCsv } from './csv';
import { LIBRARY } from './exercises';

const NEW = `Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes
1,2025-03-10 18:00:00,Push,3600,Bench Press (Barbell),W,40,10,,,,,
1,2025-03-10 18:00:00,Push,3600,Bench Press (Barbell),1,80,8,8,,,,Good day
1,2025-03-10 18:00:00,Push,3600,Bench Press (Barbell),Rest Timer,,,,,90,,
1,2025-03-10 18:00:00,Push,3600,Bench Press (Barbell),2,80,7,9,,,,
1,2025-03-10 18:00:00,Push,3600,Rowing Machine,1,,,,2000,600,,
2,2025-03-12 18:00:00,Legs,2700,Mystery Lift,1,100,5,,,,,`;

const OLD = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
2024-01-15 07:30:00;Morning;1h 5m;Bench Press (Barbell);1;135;10;0;0;;;
2024-01-15 07:30:00;Morning;1h 5m;Bench Press (Barbell);2;185;5;0;0;;;`;

describe('Strong import (4.3)', () => {
  it('reads a recent Strong export: workouts, set types, kg, rest rows skipped', () => {
    const res = importWorkoutCsv(NEW, LIBRARY, []);
    expect(res.workouts.map((w) => w.name)).toEqual(['Push', 'Legs']);
    const push = res.workouts[0];
    expect(push.endedAt! - push.startedAt).toBe(3600_000);
    expect(push.note).toBe('Good day');
    const bench = push.exercises[0];
    expect(bench.exerciseId).toBe(LIBRARY.find((e) => e.name === 'Bench Press (Barbell)')!.id);
    expect(bench.sets.map((s) => [s.type, s.weight, s.reps])).toEqual([
      ['warmup', 40, 10],
      ['normal', 80, 8],
      ['normal', 80, 7],
    ]);
    const row = push.exercises[1].sets[0];
    expect(row.distance).toBe(2);
    expect(row.duration).toBe(600);
    expect(res.newExercises.map((e) => e.name)).toContain('Mystery Lift');
  });

  it('reads an old export with ";" and no unit, in the person’s unit', () => {
    const lb = importWorkoutCsv(OLD, LIBRARY, [], 'lb');
    expect(lb.workouts[0].exercises[0].sets.map((s) => Math.round(s.weight! / 0.45359237))).toEqual([135, 185]);
    expect(lb.workouts[0].endedAt! - lb.workouts[0].startedAt).toBe(65 * 60000);
    const kg = importWorkoutCsv(OLD, LIBRARY, [], 'kg');
    expect(kg.workouts[0].exercises[0].sets[0].weight).toBe(135);
  });

  it('importing the same file twice skips what is already there', () => {
    const first = importWorkoutCsv(NEW, LIBRARY, []);
    const again = importWorkoutCsv(NEW, [...LIBRARY, ...first.newExercises], first.workouts);
    expect(again.workouts).toEqual([]);
    expect(again.skippedDuplicates).toBe(2);
  });
});
