import { describe, expect, it } from 'vitest';
import { FEATURES, featureOn, setFeature } from './features';
import { defaultState } from './store';

describe('feature switches', () => {
  it('features in test are off by default during the beta, stable ones on', () => {
    const s = defaultState().settings;
    for (const id of ['gear', 'levels', 'challenges', 'recaps', 'comments'] as const) expect(featureOn(s, id)).toBe(false);
    expect(featureOn(s, 'smartFoodOrder')).toBe(true);
    expect(FEATURES.filter((f) => f.inTest).every((f) => !f.default)).toBe(true);
  });

  it('a person can turn one on or off without touching the others', () => {
    const s = setFeature(defaultState().settings, 'levels', true);
    expect(featureOn(s, 'levels')).toBe(true);
    expect(featureOn(s, 'gear')).toBe(false);
    expect(featureOn(setFeature(s, 'smartFoodOrder', false), 'smartFoodOrder')).toBe(false);
  });

  it('handles settings saved before switches existed', () => {
    expect(featureOn(undefined, 'levels')).toBe(false);
    expect(featureOn({}, 'smartFoodOrder')).toBe(true);
  });
});
