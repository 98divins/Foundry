import { safeRate } from './safeguards';
import { tk } from './i18n';
/**
 * Nutrition engine: food log totals, weight trend, an adaptive estimate of energy
 * expenditure, and calorie/macro targets refreshed at a weekly check-in.
 *
 * Method (all standard, documented here so the numbers can be checked):
 * - Starting expenditure: Mifflin-St Jeor resting rate × an activity factor.
 * - Trend weight: exponential moving average of daily weigh-ins (10 % per weigh-in),
 *   which smooths out water swings.
 * - Expenditure: energy balance over the last 3 weeks. Average intake on fully logged days,
 *   minus the energy stored or lost per day: the slope of a straight line fitted through the
 *   weigh-ins (kg/day, no lag unlike the smoothed trend) × 7 700 kcal/kg.
 *   Each day the estimate moves 10 % toward that figure, so one odd week cannot swing it.
 * - Targets: expenditure plus the energy for the chosen weekly rate of weight change,
 *   protein from body weight, fat as a share of calories, carbs fill the rest.
 */

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
/** 'snacks' is the after-lunch slot (it was the only snack slot before, so old entries land there). */
export type Meal = 'breakfast' | 'snack_breakfast' | 'lunch' | 'snacks' | 'dinner' | 'snack_dinner';

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  /** Values per 100 g (or 100 ml). */
  per100: Macros & { fiber?: number | null };
  /** A named portion, e.g. 1 pot = 125 g. */
  serving?: { label: string; grams: number } | null;
  /** custom: created by this user; community: created by another member (shared database). */
  source: 'custom' | 'generic' | 'off' | 'community';
  barcode?: string;
}

export interface FoodEntry {
  id: string;
  /** Local day, YYYY-MM-DD. */
  date: string;
  meal: Meal;
  foodId?: string;
  name: string;
  brand?: string;
  /** Null for a quick add (calories and macros typed directly). */
  grams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: number;
  /** Planned ahead: shown on its day but not counted until confirmed as eaten. */
  planned?: boolean;
  /** Set when the entry was logged as part of a saved meal. */
  group?: { id: string; savedMealId: string; name: string; servings: number };
}

/** A meal saved to log in one go. Logging copies its items, so past days keep what was eaten. */
export interface SavedMeal {
  id: string;
  name: string;
  items: MealItem[];
  updatedAt: number;
  /** Shared with other members (shown in Meals → Explore → Community). */
  shared?: boolean;
}

/** One ingredient of a saved meal, for one serving of the meal. */
export type MealItem = Omit<FoodEntry, 'id' | 'date' | 'meal' | 'createdAt' | 'group'>;

export interface WeighIn {
  date: string;
  kg: number;
}

export interface Profile {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  activity: Activity;
}

export interface CheckIn {
  date: string;
  expenditure: number;
  trendKg: number | null;
  targets: Macros;
}

export interface NutritionState {
  profile: Profile | null;
  /** kg per week; negative to lose. */
  rateKgPerWeek: number;
  proteinPerKg: number;
  /** Chosen macro plan (macroPlans.ts), or 'custom'. Absent on older data: inferred from the values. */
  macroPlan?: string;
  /** Share of calories from fat, 0.2–0.4. */
  fatShare: number;
  /** 0 = Sunday … 6 = Saturday. */
  checkInDay: number;
  foods: Food[];
  log: FoodEntry[];
  weights: WeighIn[];
  /** Days the user marked as not fully logged: left out of the expenditure estimate. */
  incompleteDays: string[];
  checkIns: CheckIn[];
  /** Food ids starred by the user. */
  favorites: string[];
  savedMeals: SavedMeal[];
}

export const defaultNutrition = (): NutritionState => ({
  profile: null,
  rateKgPerWeek: 0,
  proteinPerKg: 2,
  fatShare: 0.28,
  checkInDay: 1,
  foods: [],
  log: [],
  weights: [],
  incompleteDays: [],
  checkIns: [],
  favorites: [],
  savedMeals: [],
});

export const KCAL_PER_KG = 7700;
const TREND_ALPHA = 0.1;
const WINDOW_DAYS = 21;
const MIN_LOGGED_DAYS = 7;
const MIN_WEIGH_INS = 4;
const ADAPT_RATE = 0.1;

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/* ---------- Dates (local days as YYYY-MM-DD) ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key: string, n: number) => {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);

/* ---------- Food maths ---------- */

export function scaleFood(food: Food, grams: number): Macros {
  const k = grams / 100;
  return {
    kcal: Math.round(food.per100.kcal * k),
    protein: round1(food.per100.protein * k),
    carbs: round1(food.per100.carbs * k),
    fat: round1(food.per100.fat * k),
  };
}

export const round1 = (v: number) => Math.round(v * 10) / 10;

/** Calories implied by macros (Atwater 4/4/9); used to fill a missing kcal. */
export const kcalFromMacros = (p: number, c: number, f: number) => Math.round(4 * p + 4 * c + 9 * f);

export function dayTotals(log: FoodEntry[], date: string): Macros {
  const t: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of log) {
    if (e.date !== date || e.planned) continue;
    t.kcal += e.kcal;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
  }
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

/* ---------- Expenditure & weight ---------- */

export function age(profile: Profile, today = dayKey()) {
  return parseDay(today).getFullYear() - profile.birthYear;
}

/** Resting rate (Mifflin-St Jeor) × activity factor. */
export function initialExpenditure(profile: Profile, kg: number, today = dayKey()): number {
  const rest = 10 * kg + 6.25 * profile.heightCm - 5 * age(profile, today) + (profile.sex === 'male' ? 5 : -161);
  return Math.round(rest * ACTIVITY_FACTOR[profile.activity]);
}

export interface TrendPoint {
  date: string;
  scale: number | null;
  trend: number;
}

/** One point per day from the first weigh-in to `until`; days without a weigh-in keep the trend. */
export function weightTrend(weights: WeighIn[], until = dayKey()): TrendPoint[] {
  if (!weights.length) return [];
  const byDay = new Map<string, number>();
  for (const w of [...weights].sort((a, b) => a.date.localeCompare(b.date))) byDay.set(w.date, w.kg);
  const first = [...byDay.keys()][0];
  const out: TrendPoint[] = [];
  let trend = byDay.get(first)!;
  for (let d = first; d <= until; d = addDays(d, 1)) {
    const kg = byDay.get(d) ?? null;
    if (kg != null) trend += TREND_ALPHA * (kg - trend);
    out.push({ date: d, scale: kg, trend });
    if (out.length > 3660) break;
  }
  return out;
}

export interface ExpenditurePoint {
  date: string;
  /** Smoothed estimate in effect on this day. */
  estimate: number;
  /** Energy balance figure for the 3 weeks before, when there was enough data. */
  raw: number | null;
}

/**
 * Daily expenditure estimates. A day contributes intake only if something was logged and the
 * user did not mark it incomplete. Returns [] until there is a profile and a weigh-in.
 */
export function expenditureSeries(n: NutritionState, until = dayKey()): ExpenditurePoint[] {
  if (!n.profile || !n.weights.length) return [];
  const byDay = new Map<string, number>();
  for (const w of [...n.weights].sort((x, y) => x.date.localeCompare(y.date))) byDay.set(w.date, w.kg);
  const weighDays = [...byDay.keys()];
  const firstWeigh = weighDays[0];
  const seed = initialExpenditure(n.profile, byDay.get(firstWeigh)!, until);
  const incomplete = new Set(n.incompleteDays);
  const intake = new Map<string, number>();
  // Planned foods that were never confirmed were not eaten: they must not count as intake.
  for (const e of n.log) if (!e.planned && !incomplete.has(e.date)) intake.set(e.date, (intake.get(e.date) ?? 0) + e.kcal);

  const firstLog = n.log.length ? n.log.reduce((m, e) => (e.date < m ? e.date : m), n.log[0].date) : until;
  const start = firstLog < firstWeigh ? firstLog : firstWeigh;
  const out: ExpenditurePoint[] = [];
  let estimate = seed;
  for (let d = start; d <= until; d = addDays(d, 1)) {
    // Window: the 3 weeks before this day (today is still being logged).
    const end = addDays(d, -1);
    const from = addDays(d, -WINDOW_DAYS);
    let raw: number | null = null;
    let sum = 0;
    let days = 0;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = from; x <= end; x = addDays(x, 1)) {
      const kcal = intake.get(x);
      if (kcal != null && kcal > 0) {
        sum += kcal;
        days++;
      }
      const kg = byDay.get(x);
      if (kg != null) {
        xs.push(daysBetween(from, x));
        ys.push(kg);
      }
    }
    const slope = xs.length >= MIN_WEIGH_INS && xs[xs.length - 1] - xs[0] >= MIN_LOGGED_DAYS ? fitSlope(xs, ys) : null;
    if (days >= MIN_LOGGED_DAYS && slope != null) {
      raw = Math.round(sum / days - slope * KCAL_PER_KG);
      // Guard against impossible values from a bad week of logging.
      const bounded = Math.min(seed * 1.6, Math.max(seed * 0.6, raw));
      estimate += ADAPT_RATE * (bounded - estimate);
    }
    out.push({ date: d, estimate: Math.round(estimate), raw });
    if (out.length > 3660) break;
  }
  return out;
}

/** Least-squares slope of y over x. */
export function fitSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : 0;
}

export function currentExpenditure(n: NutritionState, today = dayKey()): number | null {
  const s = expenditureSeries(n, today);
  return s.length ? s[s.length - 1].estimate : null;
}

export function latestTrend(n: NutritionState, today = dayKey()): number | null {
  const t = weightTrend(n.weights, today);
  return t.length ? t[t.length - 1].trend : null;
}

/* ---------- Targets ---------- */

export function computeTargets(
  expenditure: number,
  trendKg: number,
  n: Pick<NutritionState, 'rateKgPerWeek' | 'proteinPerKg' | 'fatShare' | 'profile'>,
): Macros {
  const floor = n.profile?.sex === 'female' ? 1200 : 1500;
  const rate = safeRate(n.rateKgPerWeek, n.profile, trendKg);
  const kcal = Math.max(floor, Math.round((expenditure + (rate * KCAL_PER_KG) / 7) / 10) * 10);
  const protein = Math.round(n.proteinPerKg * trendKg);
  const fat = Math.round(Math.max((n.fatShare * kcal) / 9, 0.5 * trendKg));
  const carbs = Math.max(0, Math.round((kcal - 4 * protein - 9 * fat) / 4));
  return { kcal, protein, carbs, fat };
}

/** Targets currently in effect: the latest check-in, if any. */
export const currentTargets = (n: NutritionState): Macros | null => n.checkIns[n.checkIns.length - 1]?.targets ?? null;

/** A check-in is due on the chosen weekday, or when the last one is a week old or more. */
export function checkInDue(n: NutritionState, today = dayKey()): boolean {
  if (!n.profile || !n.weights.length) return false;
  const last = n.checkIns[n.checkIns.length - 1];
  if (!last) return true;
  if (last.date === today) return false;
  return parseDay(today).getDay() === n.checkInDay || daysBetween(last.date, today) >= 7;
}

export function makeCheckIn(n: NutritionState, today = dayKey()): CheckIn | null {
  const exp = currentExpenditure(n, today);
  const trendKg = latestTrend(n, today);
  if (exp == null || trendKg == null) return null;
  return { date: today, expenditure: exp, trendKg: round1(trendKg), targets: computeTargets(exp, trendKg, n) };
}

/** Average daily intake and weekly trend change over the last `days` days, for the insights screen. */
export function recentStats(n: NutritionState, days = 14, today = dayKey()) {
  const incomplete = new Set(n.incompleteDays);
  let sum = 0;
  let logged = 0;
  for (let i = 1; i <= days; i++) {
    const d = addDays(today, -i);
    if (incomplete.has(d)) continue;
    const kcal = dayTotals(n.log, d).kcal;
    if (kcal > 0) {
      sum += kcal;
      logged++;
    }
  }
  const trend = weightTrend(n.weights, today);
  const at = new Map(trend.map((t) => [t.date, t.trend]));
  const from = addDays(today, -days);
  const a = at.get(from) ?? trend[0]?.trend;
  const b = trend[trend.length - 1]?.trend;
  const span = trend.length ? Math.max(1, daysBetween(at.has(from) ? from : trend[0].date, today)) : 0;
  return {
    avgIntake: logged ? Math.round(sum / logged) : null,
    loggedDays: logged,
    weeklyChange: a != null && b != null && span >= 7 ? Math.round(((b - a) / span) * 7 * 100) / 100 : null,
  };
}

export const MACRO_LABEL = { kcal: tk('Calories'), protein: tk('Protein'), carbs: tk('Carbs'), fat: tk('Fat') } as const;

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: tk('Breakfast'),
  snack_breakfast: tk('Snacks after breakfast'),
  lunch: tk('Lunch'),
  snacks: tk('Snacks after lunch'),
  dinner: tk('Dinner'),
  snack_dinner: tk('Snacks after dinner'),
};
export const MEALS: Meal[] = ['breakfast', 'snack_breakfast', 'lunch', 'snacks', 'dinner', 'snack_dinner'];

/* ---------- Saved meals ---------- */

export function mealTotals(items: MealItem[], servings = 1): Macros {
  const t = items.reduce(
    (a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    kcal: Math.round(t.kcal * servings),
    protein: round1(t.protein * servings),
    carbs: round1(t.carbs * servings),
    fat: round1(t.fat * servings),
  };
}

const scaleItem = (i: MealItem, k: number): MealItem => ({
  ...i,
  grams: i.grams != null ? round1(i.grams * k) : null,
  kcal: Math.round(i.kcal * k),
  protein: round1(i.protein * k),
  carbs: round1(i.carbs * k),
  fat: round1(i.fat * k),
});

/** Entries for one logging of a saved meal: a copy of its items × servings, grouped together. */
export function entriesFromMeal(
  sm: SavedMeal,
  servings: number,
  date: string,
  meal: Meal,
  makeId: () => string,
  now = Date.now(),
): FoodEntry[] {
  const group = { id: makeId(), savedMealId: sm.id, name: sm.name, servings };
  return sm.items.map((i, k) => ({ ...scaleItem(i, servings), id: makeId(), date, meal, createdAt: now + k, group }));
}

/** Items for a new saved meal from logged entries (e.g. "save this lunch as a meal"). */
export function itemsFromEntries(entries: FoodEntry[]): MealItem[] {
  return entries.map(({ foodId, name, brand, grams, kcal, protein, carbs, fat }) => ({
    ...(foodId ? { foodId } : {}),
    ...(brand ? { brand } : {}),
    name,
    grams,
    kcal,
    protein,
    carbs,
    fat,
  }));
}

/**
 * Optional retroactive update: every past logging of this meal gets the new items (at the
 * servings it was logged with), keeping its day, slot and position. Returns the new log and the
 * number of loggings changed.
 */
export function applyMealToLog(log: FoodEntry[], sm: SavedMeal, makeId: () => string): { log: FoodEntry[]; groups: number } {
  const groups = new Map<string, FoodEntry[]>();
  for (const e of log) if (e.group?.savedMealId === sm.id) groups.set(e.group.id, [...(groups.get(e.group.id) ?? []), e]);
  if (!groups.size) return { log, groups: 0 };
  const out: FoodEntry[] = [];
  const done = new Set<string>();
  for (const e of log) {
    const g = e.group?.savedMealId === sm.id ? e.group : undefined;
    if (!g) {
      out.push(e);
      continue;
    }
    if (done.has(g.id)) continue;
    done.add(g.id);
    const first = groups.get(g.id)![0];
    out.push(
      ...sm.items.map((i, k) => ({
        ...scaleItem(i, g.servings),
        id: makeId(),
        date: first.date,
        meal: first.meal,
        createdAt: first.createdAt + k,
        group: { ...g, name: sm.name },
      })),
    );
  }
  return { log: out, groups: groups.size };
}
