/**
 * Weekly goals set by the user: how many days to train, and how many days to eat within target.
 * A diet day is "on target" when it is fully logged, calories are within ±10 % of the target and
 * protein reaches 90 % of it (targets: the check-in in effect that day).
 */
import { trainingDays } from './analytics';
import { addDays, dayKey, dayTotals, type NutritionState } from './nutrition';
import type { State } from './types';
import { finished, weekStart } from './utils';

const DAY = 86400000;

export interface Goals {
  /** Training days per week (1–7). */
  trainingDays: number;
  /** Days within the nutrition targets per week (null = no diet goal). */
  dietDays: number | null;
  /** When the goals were set: weeks before do not count. */
  setAt: number;
}

export function targetsOn(n: NutritionState, day: string) {
  let t = null;
  for (const c of n.checkIns) if (c.date <= day) t = c.targets;
  return t;
}

/** Where a day stands against the diet goal: calories within ±10 % of the target, protein at least 90 %. */
export interface DayTargetStatus {
  kcalMin: number;
  kcalMax: number;
  kcal: 'below' | 'in' | 'over';
  /** kcal still to eat to enter the range (below), or room left before leaving it (in). */
  kcalToGo: number;
  proteinMin: number;
  /** g of protein still missing to reach 90 % (0 when reached). */
  proteinToGo: number;
  met: boolean;
}

export function dayTargetStatus(eaten: { kcal: number; protein: number }, target: { kcal: number; protein: number }): DayTargetStatus {
  const kcalMin = Math.round(target.kcal * 0.9);
  const kcalMax = Math.round(target.kcal * 1.1);
  const proteinMin = Math.round(target.protein * 0.9);
  const kcal = eaten.kcal < kcalMin ? 'below' : eaten.kcal > kcalMax ? 'over' : 'in';
  const kcalToGo = kcal === 'below' ? kcalMin - Math.round(eaten.kcal) : kcal === 'in' ? kcalMax - Math.round(eaten.kcal) : Math.round(eaten.kcal) - kcalMax;
  const proteinToGo = Math.max(0, Math.ceil(proteinMin - eaten.protein));
  return { kcalMin, kcalMax, kcal, kcalToGo, proteinMin, proteinToGo, met: kcal === 'in' && proteinToGo === 0 };
}

export function dietOnTarget(n: NutritionState, day: string): boolean {
  if (n.incompleteDays.includes(day)) return false;
  const target = targetsOn(n, day);
  if (!target) return false;
  const eaten = dayTotals(n.log, day);
  if (eaten.kcal <= 0) return false;
  return dayTargetStatus(eaten, target).met;
}

export interface WeekGoal {
  start: number;
  training: { done: number; goal: number; met: boolean };
  diet: { done: number; goal: number; met: boolean } | null;
  /** Both goals met (or the only one there is). */
  met: boolean;
  /** 0–1: how far along the week's goals are (averaged, each capped at 100 %). */
  progress: number;
}

export function weekGoal(state: State, goals: Goals, start: number, now = Date.now()): WeekGoal {
  const end = weekStart(start + 10.5 * DAY);
  const inWeek = finished(state.workouts).filter((w) => w.startedAt >= start && w.startedAt < end);
  const tDone = trainingDays(inWeek);
  const training = { done: tDone, goal: goals.trainingDays, met: tDone >= goals.trainingDays };
  let diet: WeekGoal['diet'] = null;
  if (goals.dietDays) {
    let d = 0;
    const first = dayKey(new Date(start));
    const today = dayKey(new Date(now));
    for (let i = 0; i < 7; i++) {
      const day = addDays(first, i);
      if (day > today) break;
      if (dietOnTarget(state.nutrition, day)) d++;
    }
    diet = { done: d, goal: goals.dietDays, met: d >= goals.dietDays };
  }
  const parts = [Math.min(1, training.done / training.goal), ...(diet ? [Math.min(1, diet.done / diet.goal)] : [])];
  return { start, training, diet, met: training.met && (!diet || diet.met), progress: parts.reduce((a, b) => a + b, 0) / parts.length };
}

/** Full weeks between `from` and the start of this week, since the goals were set. */
export function goalWeeks(state: State, goals: Goals, from: number, now = Date.now()): WeekGoal[] {
  const out: WeekGoal[] = [];
  const thisWeek = weekStart(now);
  // First week that starts on or after the later of `from` and the day the goals were set.
  const begin = Math.max(from, weekStart(goals.setAt));
  let s = weekStart(begin);
  if (s < begin) s = weekStart(s + 10.5 * DAY);
  for (; s < thisWeek; s = weekStart(s + 10.5 * DAY)) out.push(weekGoal(state, goals, s, now));
  return out;
}

/** Share of full weeks where the goals were met, or null before the first full week. */
export function goalRate(state: State, goals: Goals | undefined, from: number, now = Date.now()): number | null {
  if (!goals) return null;
  const weeks = goalWeeks(state, goals, from, now);
  return weeks.length ? Math.round((weeks.filter((w) => w.met).length / weeks.length) * 100) : null;
}
