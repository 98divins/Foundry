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
  'chest', 'upper_back', 'lats', 'lower_back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs',
  'quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'neck', 'full_body', 'cardio', 'other',
];

const MUSCLE_EN: Record<Muscle, string> = {
  chest: 'Chest', upper_back: 'Upper back', lats: 'Lats', lower_back: 'Lower back', traps: 'Traps',
  shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', quads: 'Quads',
  hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', adductors: 'Adductors', abductors: 'Abductors',
  neck: 'Neck', full_body: 'Full body', cardio: 'Cardio', other: 'Other', back: 'Back',
};
const MUSCLE_FR: Record<Muscle, string> = {
  chest: 'Pectoraux', upper_back: 'Haut du dos', lats: 'Grand dorsal', lower_back: 'Bas du dos', traps: 'Trapèzes',
  shoulders: 'Épaules', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Avant-bras', abs: 'Abdominaux',
  quads: 'Quadriceps', hamstrings: 'Ischio-jambiers', glutes: 'Fessiers', calves: 'Mollets', adductors: 'Adducteurs',
  abductors: 'Abducteurs', neck: 'Cou', full_body: 'Corps entier', cardio: 'Cardio', other: 'Autre', back: 'Dos',
};

export const EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'plate', 'suspension', 'other',
];
const EQUIPMENT_EN: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable', bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell', band: 'Band', plate: 'Plate', suspension: 'Suspension', other: 'Other',
};
const EQUIPMENT_FR: Record<Equipment, string> = {
  barbell: 'Barre', dumbbell: 'Haltère', machine: 'Machine', cable: 'Poulie', bodyweight: 'Poids du corps',
  kettlebell: 'Kettlebell', band: 'Élastique', plate: 'Disque', suspension: 'Suspension', other: 'Autre',
};

/** Muscle and equipment names follow the app language (the second argument is kept for older calls). */
export const muscleLabel = (m: Muscle, _lang?: NameLang) => (getLang() === 'fr' ? MUSCLE_FR : MUSCLE_EN)[m] ?? m;
export const equipmentLabel = (e: Equipment, _lang?: NameLang) => (getLang() === 'fr' ? EQUIPMENT_FR : EQUIPMENT_EN)[e] ?? e;

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weight: tk('Weight × reps'),
  bodyweight: tk('Bodyweight reps (optional added weight)'),
  assisted: tk('Assisted reps (weight is the assistance)'),
  duration: tk('Duration'),
  cardio: tk('Distance and time'),
};
