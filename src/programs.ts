import type { Routine, WorkoutExercise } from './types';
import { uid } from './utils';
import { t, tk } from './i18n';

/** Example programs users can browse and copy into their own routines. */
export interface Program {
  id: string;
  name: string;
  level: 'Beginner' | 'Intermediate';
  daysPerWeek: number;
  goal: string;
  description: string;
  routines: { name: string; exercises: Omit<WorkoutExercise, 'id'>[] }[];
}

/** sets × reps range (e.g. 8-12) with rest in seconds. */
const ex = (exerciseId: string, sets: number, reps: number, repsMax: number | null, restSec: number, note?: string) => ({
  exerciseId,
  restSec,
  ...(note ? { note } : {}),
  sets: Array.from({ length: sets }, () => ({
    id: '',
    type: 'normal' as const,
    weight: null,
    reps,
    repsMax,
    done: false,
  })),
});

export const PROGRAMS: Program[] = [
  {
    id: 'full-body-3',
    name: tk('Full Body'),
    level: 'Beginner',
    daysPerWeek: 3,
    goal: tk('Strength and muscle'),
    description:
      tk('Two full-body workouts done in turn (A, B, A, then B, A, B). Every muscle is trained three times every two weeks, with the big lifts first. A good first program.'),
    routines: [
      {
        name: tk('Full Body A'),
        exercises: [
          ex('squat_bb', 3, 6, 8, 150, tk('Main lift. Add weight when you hit 8 reps on every set.')),
          ex('bench_db', 3, 8, 10, 120),
          ex('row_db', 3, 8, 12, 90),
          ex('rdl_db', 2, 10, 12, 90),
          ex('lateral_raise_db', 2, 12, 15, 60),
          ex('plank', 2, 0, null, 60),
        ],
      },
      {
        name: tk('Full Body B'),
        exercises: [
          ex('deadlift_bb', 3, 5, 6, 180, tk('Main lift. Keep 1-2 reps in reserve.')),
          ex('ohp_bb', 3, 6, 8, 120),
          ex('lat_pulldown', 3, 8, 12, 90),
          ex('goblet_squat', 2, 10, 12, 90),
          ex('curl_db', 2, 10, 12, 60),
          ex('pushdown', 2, 10, 12, 60),
        ],
      },
    ],
  },
  {
    id: 'upper-lower-4',
    name: tk('Upper / Lower'),
    level: 'Intermediate',
    daysPerWeek: 4,
    goal: tk('Muscle growth'),
    description:
      tk('Upper body and lower body on alternate days, each twice a week. One heavier day and one lighter, higher-rep day for each.'),
    routines: [
      {
        name: tk('Upper (heavy)'),
        exercises: [
          ex('bench_bb', 3, 5, 8, 150),
          ex('row_bb', 3, 6, 8, 150),
          ex('ohp_bb', 2, 6, 8, 120),
          ex('pull_up', 2, 6, 10, 120),
          ex('skullcrusher', 2, 8, 10, 90),
          ex('curl_db', 2, 8, 10, 90),
        ],
      },
      {
        name: tk('Lower (heavy)'),
        exercises: [
          ex('squat_bb', 3, 5, 8, 180),
          ex('rdl_bb', 3, 6, 8, 150),
          ex('leg_press', 2, 8, 10, 120),
          ex('lying_leg_curl', 2, 8, 10, 90),
          ex('standing_calf_raise', 3, 8, 12, 60),
        ],
      },
      {
        name: tk('Upper (volume)'),
        exercises: [
          ex('incline_bench_db', 3, 8, 12, 120),
          ex('seated_row_cable', 3, 10, 12, 90),
          ex('shoulder_press_db', 2, 10, 12, 90),
          ex('lat_pulldown', 2, 10, 12, 90),
          ex('lateral_raise_db', 3, 12, 15, 60),
          ex('triceps_rope_pushdown', 2, 12, 15, 60),
          ex('hammer_curl', 2, 12, 15, 60),
        ],
      },
      {
        name: tk('Lower (volume)'),
        exercises: [
          ex('bulgarian_split_squat', 3, 8, 12, 90),
          ex('hip_thrust', 3, 8, 12, 90),
          ex('leg_extension', 2, 12, 15, 60),
          ex('seated_leg_curl', 2, 12, 15, 60),
          ex('seated_calf_raise', 3, 12, 15, 60),
          ex('hanging_leg_raise', 2, 10, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'ppl-3',
    name: tk('Push / Pull / Legs'),
    level: 'Intermediate',
    daysPerWeek: 3,
    goal: tk('Muscle growth'),
    description:
      tk('Pressing muscles, pulling muscles and legs on separate days. Run it once a week (3 days) or twice (6 days) as you progress.'),
    routines: [
      {
        name: tk('Push'),
        exercises: [
          ex('bench_bb', 3, 6, 8, 150),
          ex('ohp_bb', 3, 6, 8, 150),
          ex('incline_bench_db', 3, 8, 12, 120),
          ex('lateral_raise_db', 3, 12, 15, 60),
          ex('pushdown', 3, 10, 12, 60),
        ],
      },
      {
        name: tk('Pull'),
        exercises: [
          ex('deadlift_bb', 3, 5, 6, 180),
          ex('pull_up', 3, 6, 10, 120),
          ex('row_bb', 3, 8, 10, 120),
          ex('face_pull', 3, 12, 15, 60),
          ex('curl_db', 3, 10, 12, 60),
        ],
      },
      {
        name: tk('Legs'),
        exercises: [
          ex('squat_bb', 3, 6, 8, 180),
          ex('rdl_bb', 3, 8, 10, 150),
          ex('leg_press', 3, 10, 12, 120),
          ex('lying_leg_curl', 3, 10, 12, 60),
          ex('standing_calf_raise', 3, 10, 15, 60),
        ],
      },
    ],
  },
];

/** Fresh routines (new ids) for a program, ready to store in a new folder. */
export function routinesFromProgram(p: Program, folderId: string): Routine[] {
  return p.routines.map((r) => ({
    id: uid(),
    name: t(r.name),
    folderId,
    updatedAt: Date.now(),
    exercises: r.exercises.map((we) => ({
      ...we,
      ...(we.note ? { note: t(we.note) } : {}),
      id: uid(),
      sets: we.sets.map((s) => ({ ...s, id: uid(), reps: s.reps || null })),
    })),
  }));
}

/**
 * Programs announced but not available yet: shown with a "Coming soon" badge. They are written from
 * scratch. No real person's name, image or brand appears here without a signed agreement.
 */
export const COMING_SOON: { id: string; name: string; description: string; level: string; daysPerWeek: number; goal: string }[] = [
  { id: 'cs-sci-ul', name: tk('Science-based Upper / Lower'), description: tk('Five days, evidence-based volume and progression, built around the big lifts.'), level: tk('Intermediate'), daysPerWeek: 5, goal: tk('Muscle growth') },
  { id: 'cs-powerbuilding', name: tk('Powerbuilding'), description: tk('Heavy compound work for strength plus accessories for size.'), level: tk('Intermediate'), daysPerWeek: 4, goal: tk('Strength and muscle') },
  { id: 'cs-classic', name: tk('Classic physique'), description: tk('High-volume Push / Pull / Legs for a balanced, aesthetic physique.'), level: tk('Advanced'), daysPerWeek: 6, goal: tk('Aesthetics') },
  { id: 'cs-fb-essentials', name: tk('Full body essentials'), description: tk('Three short full-body sessions a week for busy schedules.'), level: tk('Beginner'), daysPerWeek: 3, goal: tk('Strength and muscle') },
];
