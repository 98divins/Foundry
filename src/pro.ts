/**
 * Free / Pro split ("Foundry Pro"). About 70 % of each part of the app is free; Pro adds volume,
 * history, analyses and comfort. Logging a workout or a meal, and exporting one's data, are never paid.
 *
 * There is no subscription yet: during the beta every Pro feature is open. To see the app as a free
 * user would, turn on "Preview the free version" in Settings → Subscription (stored on this device only).
 */
import { tk } from './i18n';

export const PRO_FREE_DURING_BETA = true;
const PREVIEW_KEY = 'foundry:preview-free';

/** Free limits: users above them keep what they have, they just cannot add more without Pro. */
export const FREE_LIMITS = { routines: 4, folders: 1, customExercises: 5, savedMeals: 4 } as const;
/** How far back charts go for free users (days). */
export const FREE_HISTORY_DAYS = 90;

export function previewingFree(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}
export function setPreviewFree(on: boolean) {
  try {
    if (on) localStorage.setItem(PREVIEW_KEY, '1');
    else localStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPro(): boolean {
  if (previewingFree()) return false;
  return PRO_FREE_DURING_BETA;
}

export type ProFeature =
  | 'routines'
  | 'folders'
  | 'customExercises'
  | 'savedMeals'
  | 'mergeRoutines'
  | 'fillFromRoutine'
  | 'adaptiveCoach'
  | 'customMacros'
  | 'shareMeals'
  | 'planAhead'
  | 'dietGoal'
  | 'advancedStats'
  | 'dietTraining'
  | 'fullHistory'
  | 'compare'
  | 'longLeaderboard'
  | 'customTheme'
  | 'excel';

/** What the upgrade sheet says for each locked feature. */
export const PRO_COPY: Record<ProFeature, string> = {
  routines: tk('Free accounts keep up to 4 workouts. Go Pro for as many as you like.'),
  folders: tk('Free accounts have 1 folder. Go Pro to organise workouts in as many folders as you like.'),
  customExercises: tk('Free accounts can create up to 5 custom exercises. Go Pro for unlimited ones.'),
  savedMeals: tk('Free accounts keep up to 4 saved meals. Go Pro for as many as you like.'),
  mergeRoutines: tk('Merging workouts is part of Foundry Pro.'),
  fillFromRoutine: tk('Filling a past workout from one of your saved workouts is part of Foundry Pro.'),
  adaptiveCoach: tk('Your weekly check-in adjusts your targets to how your body really responds. It is the heart of Foundry Pro.'),
  customMacros: tk('Setting protein and fat yourself is part of Foundry Pro.'),
  shareMeals: tk('Sharing your meals with the community is part of Foundry Pro.'),
  planAhead: tk('Free accounts plan the current week. Go Pro to plan next week and the whole month.'),
  dietGoal: tk('The diet goal (days within your targets) is part of Foundry Pro.'),
  advancedStats: tk('Muscle balance and the monthly report are part of Foundry Pro.'),
  dietTraining: tk('Seeing how your diet moves your strength is part of Foundry Pro.'),
  fullHistory: tk('Free charts show the last 3 months. Go Pro to see your whole history.'),
  compare: tk('Head-to-head comparisons with friends are part of Foundry Pro.'),
  longLeaderboard: tk('Free leaderboards cover this week and the last month. Go Pro for 6 months and a year.'),
  customTheme: tk('Custom colours and pure black are part of Foundry Pro.'),
  excel: tk('The Excel export with the full report is part of Foundry Pro. CSV and backup stay free.'),
};

/** True when the feature can be used; otherwise opens the upgrade sheet and returns false. */
export function requirePro(feature: ProFeature): boolean {
  if (hasPro()) return true;
  dispatchEvent(new CustomEvent('foundry:pro', { detail: feature }));
  return false;
}

/** True when one more item fits (free limit or Pro); otherwise opens the upgrade sheet. */
export function canAdd(feature: keyof typeof FREE_LIMITS, current: number): boolean {
  if (current < FREE_LIMITS[feature]) return true;
  return requirePro(feature);
}

export type PlanId = 'free' | 'beta' | 'monthly' | 'yearly';
/** Plans shown in Settings → Subscription (prices from docs/BUSINESS_MODEL.md). */
export const PLANS: { id: Exclude<PlanId, 'beta'>; name: string; text: string; price: string; badge?: string }[] = [
  { id: 'free', name: tk('Free'), text: tk('Workouts, nutrition, friends: the essentials, forever.'), price: '0 €' },
  { id: 'monthly', name: tk('Pro monthly'), text: tk('Everything in Foundry Pro, cancel any time. 7-day free trial.'), price: tk('5.99 € / month') },
  { id: 'yearly', name: tk('Pro yearly'), text: tk('About 3.33 € a month. 7-day free trial.'), price: tk('39.99 € / year'), badge: tk('-44 %') },
];
