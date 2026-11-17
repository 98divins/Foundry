import { describe, expect, it } from 'vitest';
import { computeTargets } from './nutrition';
import { lossBlocked, safeRate } from './safeguards';

const adult = { sex: 'female' as const, birthYear: 1995, heightCm: 165, activity: 'moderate' as const };

describe('weight-loss safeguards', () => {
  it('offers no weight loss to people under 18', () => {
    expect(lossBlocked({ ...adult, birthYear: 2010 }, 60, 2026)).toBe('minor');
    expect(safeRate(-0.5, { ...adult, birthYear: 2010 }, 60, 2026)).toBe(0);
  });
  it('offers no weight loss below a BMI of 18.5', () => {
    expect(lossBlocked(adult, 49, 2026)).toBe('lowBmi'); // 49 kg at 1.65 m = 18.0
    expect(lossBlocked(adult, 60, 2026)).toBeNull();
  });
  it('caps the loss at 1% of body weight per week', () => {
    expect(safeRate(-1, adult, 55, 2026)).toBeCloseTo(-0.55);
    expect(safeRate(-0.25, adult, 55, 2026)).toBe(-0.25);
    expect(safeRate(0.5, adult, 55, 2026)).toBe(0.5);
  });
  it('targets apply the safeguards even if a plan asks for more', () => {
    const asked = computeTargets(2200, 49, { rateKgPerWeek: -1, proteinPerKg: 2, fatShare: 0.28, profile: adult });
    const maintain = computeTargets(2200, 49, { rateKgPerWeek: 0, proteinPerKg: 2, fatShare: 0.28, profile: adult });
    expect(asked.kcal).toBe(maintain.kcal);
  });
});
