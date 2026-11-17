/**
 * Feature switches (plan 4.2). Nothing is removed: features still in test are off by default during the
 * beta and each person can turn them on in Settings → Features in test. Turn one on for everyone by
 * changing its `default` once usage data supports it.
 */
import { useStore } from './store';
import type { Settings } from './types';
import { tk } from './i18n';

export type FeatureId = 'gear' | 'levels' | 'challenges' | 'recaps' | 'comments' | 'smartFoodOrder';

export interface Feature {
  id: FeatureId;
  label: string;
  text: string;
  default: boolean;
  /** Shown in "Features in test" (false = stable, switch kept for a quick rollback only). */
  inTest: boolean;
}

export const FEATURES: Feature[] = [
  { id: 'levels', label: tk('Level and badges'), text: tk('XP, ranks, badges and level-up posts.'), default: false, inTest: true },
  { id: 'challenges', label: tk('Challenges'), text: tk('Weekly challenges, alone or with friends.'), default: false, inTest: true },
  { id: 'gear', label: tk('My gear'), text: tk('Show what you train with on your profile.'), default: false, inTest: true },
  { id: 'recaps', label: tk('My recaps'), text: tk('Your week, month or year in a story, with an image to share.'), default: false, inTest: true },
  { id: 'comments', label: tk('Comments in the feed'), text: tk('Write and read comments on friends’ posts.'), default: false, inTest: true },
  { id: 'smartFoodOrder', label: tk('Foods you eat first'), text: tk('Foods you often log at this meal come first in the search.'), default: true, inTest: false },
];

export function featureOn(settings: Pick<Settings, 'features'> | undefined, id: FeatureId): boolean {
  const own = settings?.features?.[id];
  return typeof own === 'boolean' ? own : FEATURES.find((f) => f.id === id)!.default;
}

export function setFeature(settings: Settings, id: FeatureId, on: boolean): Settings {
  return { ...settings, features: { ...settings.features, [id]: on } };
}

export function useFeature(id: FeatureId): boolean {
  return featureOn(useStore().state.settings, id);
}
