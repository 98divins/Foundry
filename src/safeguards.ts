/**
 * Health safeguards on weight-loss goals: none for people under 18 or with a body mass index below
 * 18.5, and never faster than 1% of body weight per week. Applied where goals are chosen and again
 * where targets are computed, so an old or synced plan cannot get around them.
 */
import type { Profile } from './nutrition';

export const MIN_BMI = 18.5;
export const MAX_LOSS_SHARE = 0.01;

export const bmi = (kg: number, heightCm: number) => (heightCm > 0 ? kg / (heightCm / 100) ** 2 : null);

export type LossBlock = 'minor' | 'lowBmi';

/** Why a weight-loss goal is not offered (null when it is). */
export function lossBlocked(profile: Profile | null | undefined, kg: number | null, year = new Date().getFullYear()): LossBlock | null {
  if (profile && year - profile.birthYear < 18) return 'minor';
  const b = profile && kg ? bmi(kg, profile.heightCm) : null;
  if (b != null && b < MIN_BMI) return 'lowBmi';
  return null;
}

/** The weekly rate actually used: no loss when blocked, and loss capped at 1% of body weight. */
export function safeRate(rate: number, profile: Profile | null | undefined, kg: number | null, year = new Date().getFullYear()): number {
  if (rate >= 0) return rate;
  if (lossBlocked(profile, kg, year)) return 0;
  if (kg) return Math.max(rate, -MAX_LOSS_SHARE * kg);
  return rate;
}
