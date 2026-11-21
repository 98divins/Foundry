import { EXERCISE_ROWS } from './exerciseData';
import type { Equipment, Exercise, ExerciseKind, Muscle, NameLang } from './types';
import { getLang, tk } from './i18n';

export const LIBRARY: Exercise[] = EXERCISE_ROWS.map(([id, name, nameFr, muscle, equipment, kind, image]) => ({
  id,
  name,
  nameFr,
  muscle,
  equipment,
  kind,
  image,
}));

/** Photos: Free Exercise DB (public domain). jsDelivr first, GitHub raw as a fallback. */
const PHOTO_BASES = [
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/',
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/',
];
export const photoUrls = (image: string, frame: 0 | 1 = 0) => PHOTO_BASES.map((b) => `${b}${image}/${frame}.jpg`);

export function displayName(e: Exercise, lang: NameLang): string {
  return lang === 'fr' && e.nameFr ? e.nameFr : e.name;
}

/** Lowercase without accents, so "developpe" finds "Développé". */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');

export const MUSCLES: Muscle[] = [
  'chest',
  'upper_back',
  'lats',
  'lower_back',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
  'neck',
  'full_body',
  'cardio',
  'other',
];

const MUSCLE_EN: Record<Muscle, string> = {
  chest: 'Chest',
  upper_back: 'Upper back',
  lats: 'Lats',
  lower_back: 'Lower back',
  traps: 'Traps',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  adductors: 'Adductors',
  abductors: 'Abductors',
  neck: 'Neck',
  full_body: 'Full body',
  cardio: 'Cardio',
  other: 'Other',
  back: 'Back',
  legs: 'Legs',
  arms: 'Arms',
  core: 'Abs',
};
const MUSCLE_FR: Record<Muscle, string> = {
  chest: 'Pectoraux',
  upper_back: 'Haut du dos',
  lats: 'Grand dorsal',
  lower_back: 'Bas du dos',
  traps: 'Trapèzes',
  shoulders: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  abs: 'Abdominaux',
  quads: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  glutes: 'Fessiers',
  calves: 'Mollets',
  adductors: 'Adducteurs',
  abductors: 'Abducteurs',
  neck: 'Cou',
  full_body: 'Corps entier',
  cardio: 'Cardio',
  other: 'Autre',
  back: 'Dos',
  legs: 'Jambes',
  arms: 'Bras',
  core: 'Abdos',
};

export const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'plate', 'suspension', 'other'];
const EQUIPMENT_EN: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  plate: 'Plate',
  suspension: 'Suspension',
  other: 'Other',
};
const EQUIPMENT_FR: Record<Equipment, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltère',
  machine: 'Machine',
  cable: 'Poulie',
  bodyweight: 'Poids du corps',
  kettlebell: 'Kettlebell',
  band: 'Élastique',
  plate: 'Disque',
  suspension: 'Suspension',
  other: 'Autre',
};

/** Muscle and equipment names follow the app language (the second argument is kept for older calls). */
/**
 * Body areas shown everywhere in the app (exercise lists, filters, statistics): the detailed muscle
 * stays in the data but people see one of six areas, plus full body, cardio and other.
 */
export type BodyArea = 'legs' | 'back' | 'chest' | 'core' | 'shoulders' | 'arms' | 'full_body' | 'cardio' | 'other';
export const AREAS: BodyArea[] = ['legs', 'back', 'chest', 'core', 'shoulders', 'arms', 'full_body', 'cardio', 'other'];
const AREA_OF: Record<Muscle, BodyArea> = {
  chest: 'chest',
  upper_back: 'back',
  lats: 'back',
  lower_back: 'back',
  traps: 'back',
  back: 'back',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  arms: 'arms',
  abs: 'core',
  core: 'core',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  legs: 'legs',
  neck: 'other',
  full_body: 'full_body',
  cardio: 'cardio',
  other: 'other',
};
export const areaOf = (m: Muscle): BodyArea => AREA_OF[m] ?? 'other';
const AREA_FR: Record<BodyArea, string> = {
  legs: 'Jambes',
  back: 'Dos',
  chest: 'Pectoraux',
  core: 'Abdos',
  shoulders: 'Épaules',
  arms: 'Bras',
  full_body: 'Corps entier',
  cardio: 'Cardio',
  other: 'Autre',
};
const AREA_EN: Record<BodyArea, string> = {
  legs: 'Legs',
  back: 'Back',
  chest: 'Chest',
  core: 'Abs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  full_body: 'Full body',
  cardio: 'Cardio',
  other: 'Other',
};
export const areaLabel = (a: BodyArea) => (getLang() === 'fr' ? AREA_FR : AREA_EN)[a];

/** What people see for a muscle: its body area. */
export const muscleLabel = (m: Muscle, _lang?: NameLang) => areaLabel(areaOf(m));
/** The detailed muscle name (kept for exports and data checks). */
export const detailedMuscleLabel = (m: Muscle) => (getLang() === 'fr' ? MUSCLE_FR : MUSCLE_EN)[m] ?? m;
export const equipmentLabel = (e: Equipment, _lang?: NameLang) => (getLang() === 'fr' ? EQUIPMENT_FR : EQUIPMENT_EN)[e] ?? e;

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weight: tk('Weight × reps'),
  bodyweight: tk('Bodyweight reps (optional added weight)'),
  assisted: tk('Assisted reps (weight is the assistance)'),
  duration: tk('Duration'),
  cardio: tk('Distance and time'),
};

/**
 * Dumbbell exercises usually done with ONE dumbbell (the others use two). People log the weight of
 * one dumbbell; volume counts it twice when two are lifted (loadFactor).
 */
const ONE_DUMBBELL = new Set([
  'concentration_curl',
  'row_db',
  'dumbbell_snatch',
  'frog_pumps_dumbbell',
  'goblet_squat',
  'hip_thrust_dumbbell',
  'pullover_dumbbell',
  'reverse_grip_concentration_curl',
  'seated_triceps_press',
  'side_bend_dumbbell',
  'single_arm_triceps_extension_dumbbell',
  'single_leg_hip_thrust_dumbbell',
  'single_leg_romanian_deadlift_dumbbell',
  'single_leg_standing_calf_raise_dumbbell',
  'suitcase_carry_dumbbell',
  'sumo_squat_dumbbell',
  'overhead_ext_db',
  'waiter_curl_dumbbell',
]);

/** Default number of dumbbells (or kettlebells) lifted at once: 2 for two-dumbbell moves, else 1. */
export function defaultLoads(e: Pick<Exercise, 'id' | 'equipment'>): 1 | 2 {
  return e.equipment === 'dumbbell' && !ONE_DUMBBELL.has(e.id) ? 2 : 1;
}
