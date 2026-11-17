import { describe, expect, it } from 'vitest';
import { giveHealthConsent, hasHealthConsent, withdrawHealthConsent } from './healthConsent';
import { defaultState } from './store';
import type { State } from './types';

describe('health-data consent', () => {
  it('is asked separately from the terms', () => {
    const s = { ...defaultState(), settings: { ...defaultState().settings, consent: { at: 1, version: '2026-11-v2' } } } as State;
    expect(hasHealthConsent(s.settings)).toBe(false);
    expect(hasHealthConsent(giveHealthConsent(s).settings)).toBe(true);
  });
  it('keeps the consent of accounts that accepted the earlier combined text', () => {
    const s = { ...defaultState(), settings: { ...defaultState().settings, consent: { at: 1, version: '2026-11-draft' } } } as State;
    expect(hasHealthConsent(s.settings)).toBe(true);
  });
  it('withdrawing erases nutrition and weight data and keeps training', () => {
    const base = defaultState();
    const s = giveHealthConsent({
      ...base,
      workouts: [{ id: 'w', name: 'W', startedAt: 1, endedAt: 2, exercises: [] }],
      nutrition: {
        ...base.nutrition,
        profile: { sex: 'male', birthYear: 1990, heightCm: 180, activity: 1.5 } as never,
        log: [{ id: 'l', date: '2026-11-01', meal: 'lunch', name: 'x', grams: 100, kcal: 100, protein: 1, carbs: 1, fat: 1, createdAt: 0 }],
        weights: [{ date: '2026-11-01', kg: 80 }],
        checkIns: [{ date: '2026-11-01' } as never],
        savedMeals: [{ id: 'm', name: 'Bowl', items: [], updatedAt: 0 }],
      },
    } as State);
    const w = withdrawHealthConsent(s);
    expect(hasHealthConsent(w.settings)).toBe(false);
    expect(w.nutrition.log).toEqual([]);
    expect(w.nutrition.weights).toEqual([]);
    expect(w.nutrition.profile).toBeNull();
    expect(w.nutrition.checkIns).toEqual([]);
    expect(w.nutrition.savedMeals.length).toBe(1);
    expect(w.workouts.length).toBe(1);
  });
});
