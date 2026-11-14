export type Unit = 'kg' | 'lb';
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'full_body'
  | 'other';
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';
/** weight: load × reps. bodyweight: reps, with optional added load. */
export type ExerciseKind = 'weight' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  kind: ExerciseKind;
  custom?: boolean;
}

/** Weights are always stored in kilograms. */
export interface SetEntry {
  id: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
  restSec: number;
  note?: string;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
  exercises: WorkoutExercise[];
  note?: string;
  routineId?: string;
}

export interface Routine {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  updatedAt: number;
  /** Folder the routine is filed in; none means "My routines". */
  folderId?: string;
}

export interface RoutineFolder {
  id: string;
  name: string;
  collapsed?: boolean;
}

export interface Settings {
  unit: Unit;
  defaultRest: number;
  sound: boolean;
}

export interface RestTimer {
  endsAt: number;
  total: number;
}

export interface State {
  version: 1;
  workouts: Workout[];
  routines: Routine[];
  folders: RoutineFolder[];
  customExercises: Exercise[];
  active: Workout | null;
  rest: RestTimer | null;
  settings: Settings;
}

export type PRKind = 'weight' | '1rm' | 'volume' | 'reps';
