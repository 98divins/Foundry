/**
 * Consent to process health data (weight, measurements, food intake), asked separately from the
 * terms, the first time nutrition is used. It can be withdrawn as easily: that erases the nutrition
 * and weight data and keeps training.
 */
import { HEALTH_CONSENT_VERSION } from './legal';
import { defaultNutrition } from './nutrition';
import type { Settings, State } from './types';

/** Terms accepted before the consents were split also covered health data. */
const LEGACY_TERMS = ['2026-11-draft'];

export function hasHealthConsent(settings: Settings): boolean {
  if (settings.healthConsent) return !settings.healthConsent.withdrawn;
  return !!settings.consent && LEGACY_TERMS.includes(settings.consent.version);
}

export function giveHealthConsent(s: State, now = Date.now()): State {
  return { ...s, settings: { ...s.settings, healthConsent: { at: now, version: HEALTH_CONSENT_VERSION } } };
}

/** Withdraw: erase food log, weigh-ins, nutrition profile, targets and check-ins; training stays. */
export function withdrawHealthConsent(s: State, now = Date.now()): State {
  const n = s.nutrition;
  return {
    ...s,
    nutrition: { ...defaultNutrition(), foods: n.foods, favorites: n.favorites, savedMeals: n.savedMeals },
    settings: { ...s.settings, healthConsent: { at: now, version: HEALTH_CONSENT_VERSION, withdrawn: true } },
  };
}
