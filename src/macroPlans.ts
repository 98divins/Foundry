/**
 * Ready-made macro plans. Protein is set per kg of body weight (what matters for muscle, whatever the
 * calories), fat as a share of calories, and carbs fill the rest. The resulting % split is shown to the
 * user for their own calories, so it reads like the familiar "40 / 30 / 30" while staying safe at any size.
 */
import { tk } from './i18n';

export interface MacroPlan {
  id: string;
  name: string;
  description: string;
  proteinPerKg: number;
  fatShare: number;
}

export const MACRO_PLANS: MacroPlan[] = [
  { id: 'balanced', name: tk('Balanced'), description: tk('For everyday health and steady training.'), proteinPerKg: 1.8, fatShare: 0.3 },
  { id: 'athlete', name: tk('Athlete'), description: tk('More carbs to fuel hard, frequent sessions.'), proteinPerKg: 1.8, fatShare: 0.25 },
  { id: 'muscle_gain', name: tk('Muscle gain'), description: tk('Plenty of protein and carbs to build muscle in a surplus.'), proteinPerKg: 2, fatShare: 0.25 },
  { id: 'fat_loss', name: tk('Fat loss'), description: tk('High protein to keep your muscle while you lose fat.'), proteinPerKg: 2.3, fatShare: 0.28 },
  { id: 'after_loss', name: tk('After weight loss'), description: tk('Holds your new weight and keeps the muscle you built.'), proteinPerKg: 2, fatShare: 0.3 },
  { id: 'lower_carb', name: tk('Lower carb'), description: tk('Fewer carbs, more fat, same protein.'), proteinPerKg: 2, fatShare: 0.4 },
];

export const CUSTOM_PLAN = 'custom';

/** The plan matching saved values, for users who set them before plans existed. */
export function planFor(proteinPerKg: number, fatShare: number, saved?: string): string {
  if (saved) return saved;
  return MACRO_PLANS.find((p) => p.proteinPerKg === proteinPerKg && p.fatShare === fatShare)?.id ?? CUSTOM_PLAN;
}
