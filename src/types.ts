import type { NutritionState } from './nutrition';

export type Unit = 'kg' | 'lb';
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type Muscle =
  | 'chest'
  | 'upper_back'
  | 'lats'
  | 'lower_back'
  | 'traps'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'neck'
  | 'full_body'
  | 'cardio'
  | 'other'
  /** Body areas, used by custom exercises (and 'back' by the first library). */
  | 'back'
  | 'legs'
  | 'arms'
  | 'core';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'plate' | 'suspension' | 'other';
/**
 * weight: load × reps. bodyweight: reps, optional added load. assisted: reps, the load is the help
 * (so it never counts as volume). duration: a timed hold. cardio: distance and time.
 */
export type ExerciseKind = 'weight' | 'bodyweight' | 'assisted' | 'duration' | 'cardio';
export type NameLang = 'fr' | 'en';

export interface Exercise {
  id: string;
  /** English name (also what CSV files use). */
  name: string;
  nameFr?: string;
  /** Free Exercise DB photo folder. */
  image?: string | null;
  /** Name to show, in the language picked in settings (filled in by the store). */
  label?: string;
  muscle: Muscle;
  equipment: Equipment;
  kind: ExerciseKind;
  custom?: boolean;
  /** Custom exercises: the logged set counts twice in the volume (two dumbbells, or each side). */
  loads?: 1 | 2;
  /** The person's own photo (custom exercises), see cloud/photos.ts. */
  photo?: { path: string; at: number } | null;
}

/** Weights are always stored in kilograms. */
export interface SetEntry {
  id: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  /** Seconds, for duration and cardio exercises. */
  duration?: number | null;
  /** Kilometres, for cardio exercises. */
  distance?: number | null;
  /** Upper end of a rep range in a routine ("8-12": reps 8, repsMax 12). */
  repsMax?: number | null;
  /** The routine's target, kept on a live set to show as a hint. */
  target?: { reps: number | null; repsMax: number | null } | null;
  /** Rate of perceived exertion, 6–10 (optional, Settings → Features in test). */
  rpe?: number | null;
  /** When the set was ticked (live workouts), to close a forgotten workout at its real end. */
  doneAt?: number;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
  restSec: number;
  note?: string;
  /** Consecutive exercises sharing this id are done as a superset. */
  supersetId?: string;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
  exercises: WorkoutExercise[];
  note?: string;
  routineId?: string;
  /** Kept out of the friends' activity feed (chosen when finishing, or later on the workout). */
  hideFromFeed?: boolean;
  /** While paused: when the pause started. */
  pausedAt?: number | null;
  /** Total time spent paused, left out of the duration. */
  pausedMs?: number;
}

export interface Routine {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  updatedAt: number;
  /** Folder the routine is filed in; none means "My routines". */
  folderId?: string;
  /** An interval (timer) routine instead of sets: see intervals.ts. */
  interval?: import('./intervals').IntervalPlan;
}

export interface RoutineFolder {
  id: string;
  name: string;
  collapsed?: boolean;
}

export interface Settings {
  /** Shared content this person reported, hidden from their screens (see reports.ts). */
  hidden?: string[];
  unit: Unit;
  defaultRest: number;
  sound: boolean;
  /** Old setting (exercise names had their own language); names now follow the app language. */
  exerciseLang?: NameLang;
  /** When the last backup file was saved (data otherwise lives only on this device). */
  lastBackupAt?: number | null;
  /** Set once a new account has gone through the quick start. */
  onboarded?: boolean;
  /** Height entry: centimetres, or feet and inches. Stored in cm either way. */
  heightUnit?: 'cm' | 'in';
  distanceUnit?: 'km' | 'mi';
  /** 1 = Monday (default), 0 = Sunday. */
  weekStartsOn?: 0 | 1;
  /** Keep the screen on during a workout (default true). */
  keepAwake?: boolean;
  theme?: 'system' | 'light' | 'dark';
  /** Interface language. Absent = the phone's language (French or English). */
  appLang?: 'fr' | 'en';
  /** When the user accepted the terms, privacy policy and health-data processing, and which version. */
  consent?: { at: number; version: string };
  /** Separate consent for health data (healthConsent.ts). */
  healthConsent?: { at: number; version: string; withdrawn?: boolean };
  /** Share a training summary with accepted friends (default on). */
  shareStats?: boolean;
  /** Post finished workouts to the friends' feed by default (true when absent). */
  postWorkouts?: boolean;
  /** Custom accent colour (hex). Absent = Foundry cobalt. */
  accent?: string;
  /** Pure black background in dark mode (OLED). */
  pureBlack?: boolean;
  /** Notes pinned to an exercise, shown each time it comes up (exercise id → text). */
  pinnedNotes?: Record<string, string>;
  /** Dumbbells lifted at once, set by the person per exercise (exercise id → 1 or 2); absent = default. */
  loads?: Record<string, 1 | 2>;
  /** Look of the shared workout image (shareCard.ts). */
  shareTheme?: 'dark' | 'light' | 'colour';
  /** Feature switches set by this person (features.ts); absent = the feature's default. */
  features?: Partial<Record<string, boolean>>;
}

export interface RestTimer {
  endsAt: number;
  total: number;
  /** While paused: milliseconds that were left. */
  pausedLeft?: number | null;
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
  nutrition: NutritionState;
  profile?: UserProfile;
  /** Deleted items (key → time), so a deletion reaches the other devices. See cloud/merge.ts. */
  deleted?: Record<string, number>;
  /** Weekly goals (see goals.ts). */
  goals?: import('./goals').Goals;
}

export interface UserProfile {
  name: string;
  bio: string;
  /** Small JPEG data URL (256 px), synced with the rest of the data. */
  avatar?: string | null;
  /** Equipment the user shows on their profile, one item per slot (see gear.ts). */
  gear?: import('./gear').Gear;
  /** Anyone signed in with the profile link can see it (otherwise friends only). */
  isPublic?: boolean;
}

export type PRKind = 'weight' | '1rm' | 'volume' | 'reps' | 'duration' | 'distance';
