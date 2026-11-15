/**
 * Progress analytics: weekly training load, sets per muscle, strength trends and how they
 * line up with nutrition. Everything is computed from logged data; insights need a minimum
 * amount of data and are worded as observations, not proof.
 */
import { addDays, dayKey, dayTotals, fitSlope, weightTrend, type NutritionState } from './nutrition';
import type { Exercise, Muscle, PRKind, SetEntry, Workout } from './types';
import { countsForStats, epley, exerciseKind, finished, setVolume, weekStart } from './utils';
import { t } from './i18n';

const DAY = 86400000;

/** Monday 00:00 of the last `count` weeks, oldest first (DST-safe). */
export function weekStarts(count: number, now = Date.now()): number[] {
  const out = [weekStart(now)];
  while (out.length < count) out.unshift(weekStart(out[0] - 3.5 * DAY));
  return out;
}
const weekEnd = (start: number) => weekStart(start + 10.5 * DAY);

export interface TrainingWeek {
  start: number;
  workouts: number;
  /** Distinct days with a workout: three routines in one session count once. */
  days: number;
  sets: number;
  volume: number;
  minutes: number;
}

export function weeklyTraining(workouts: Workout[], starts: number[]): TrainingWeek[] {
  const done = finished(workouts);
  return starts.map((start) => {
    const end = weekEnd(start);
    const inWeek = done.filter((w) => w.startedAt >= start && w.startedAt < end);
    let sets = 0;
    let volume = 0;
    for (const w of inWeek)
      for (const we of w.exercises) {
        const kind = exerciseKind(we.exerciseId);
        for (const s of we.sets.filter(countsForStats)) {
          sets++;
          volume += setVolume(s, kind);
        }
      }
    return {
      start,
      workouts: inWeek.length,
      days: trainingDays(inWeek),
      sets,
      volume,
      minutes: Math.round(inWeek.reduce((t, w) => t + ((w.endedAt ?? w.startedAt) - w.startedAt), 0) / 60000),
    };
  });
}

/** Working sets per primary muscle between two times. */
export function muscleSets(workouts: Workout[], exMap: Map<string, Exercise>, from: number, to: number): Map<Muscle, number> {
  const m = new Map<Muscle, number>();
  for (const w of finished(workouts)) {
    if (w.startedAt < from || w.startedAt >= to) continue;
    for (const we of w.exercises) {
      const muscle = exMap.get(we.exerciseId)?.muscle ?? 'other';
      if (muscle === 'cardio') continue;
      m.set(muscle, (m.get(muscle) ?? 0) + we.sets.filter(countsForStats).length);
    }
  }
  return m;
}

/** Common guideline for muscle growth: about 10–20 hard sets per muscle per week. */
export function volumeStatus(sets: number): 'low' | 'ok' | 'high' {
  return sets < 10 ? 'low' : sets > 20 ? 'high' : 'ok';
}

/* ---------- Strength ---------- */

const loaded = (s: SetEntry) => countsForStats(s) && (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0;

/** Best estimated 1RM per finished workout, for exercises lifted with a load. */
function e1rmSessions(workouts: Workout[]): Map<string, { date: number; e1rm: number }[]> {
  const out = new Map<string, { date: number; e1rm: number }[]>();
  for (const w of finished(workouts)) {
    const best = new Map<string, number>();
    for (const we of w.exercises) {
      const kind = exerciseKind(we.exerciseId);
      if (kind !== 'weight' && kind !== 'bodyweight') continue;
      for (const s of we.sets.filter(loaded)) {
        const v = epley(s.weight!, s.reps!);
        if (v > (best.get(we.exerciseId) ?? 0)) best.set(we.exerciseId, v);
      }
    }
    for (const [id, e1rm] of best) out.set(id, [...(out.get(id) ?? []), { date: w.startedAt, e1rm }]);
  }
  return out;
}

export interface LiftTrend {
  exerciseId: string;
  sessions: number;
  points: { date: number; e1rm: number }[];
  current: number;
  /** Change of the recent best over the comparison window, in % (null if too little history). */
  changePct: number | null;
  /** Days the change is measured over. */
  overDays: number;
}

/**
 * Most-trained lifts with their estimated-1RM trend. "Current" is the best of the last two
 * sessions (one off day does not hide progress); it is compared with the best of the first two
 * sessions inside the window.
 */
export function liftTrends(workouts: Workout[], { minSessions = 3, windowDays = 56, limit = 6, now = Date.now() } = {}): LiftTrend[] {
  const out: LiftTrend[] = [];
  for (const [exerciseId, pts] of e1rmSessions(workouts)) {
    if (pts.length < minSessions) continue;
    const recent = Math.max(...pts.slice(-2).map((p) => p.e1rm));
    const inWindow = pts.filter((p) => p.date >= now - windowDays * DAY);
    const base = inWindow.length >= 3 ? inWindow.slice(0, 2) : pts.slice(0, 2);
    const baseVal = Math.max(...base.map((p) => p.e1rm));
    const overDays = Math.round((pts[pts.length - 1].date - base[0].date) / DAY);
    out.push({
      exerciseId,
      sessions: pts.length,
      points: pts,
      current: recent,
      changePct: overDays >= 7 && baseVal > 0 ? Math.round(((recent - baseVal) / baseVal) * 1000) / 10 : null,
      overDays,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions || b.current - a.current).slice(0, limit);
}

/**
 * Strength index per week: for each lift trained that week, its best estimated 1RM as a % of
 * that lift's first logged session; averaged. 100 = where you started.
 */
export function strengthIndexByWeek(workouts: Workout[], starts: number[]): (number | null)[] {
  const sessions = e1rmSessions(workouts);
  const firsts = new Map([...sessions].map(([id, pts]) => [id, pts[0].e1rm]));
  return starts.map((start) => {
    const end = weekEnd(start);
    const ratios: number[] = [];
    for (const [id, pts] of sessions) {
      const inWeek = pts.filter((p) => p.date >= start && p.date < end);
      if (!inWeek.length) continue;
      ratios.push(Math.max(...inWeek.map((p) => p.e1rm)) / firsts.get(id)!);
    }
    return ratios.length ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 1000) / 10 : null;
  });
}

export interface RecentPR {
  workoutId: string;
  date: number;
  exerciseId: string;
  set: SetEntry;
  kinds: PRKind[];
}

export function recentPRs(workouts: Workout[], prs: Map<string, PRKind[]>, days = 30, now = Date.now()): RecentPR[] {
  const out: RecentPR[] = [];
  for (const w of finished(workouts)) {
    if (w.startedAt < now - days * DAY) continue;
    for (const we of w.exercises)
      for (const s of we.sets) {
        const kinds = prs.get(s.id);
        if (kinds) out.push({ workoutId: w.id, date: w.startedAt, exerciseId: we.exerciseId, set: s, kinds });
      }
  }
  return out.sort((a, b) => b.date - a.date);
}

/* ---------- Diet × training ---------- */

export interface DietWeek {
  start: number;
  loggedDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  /** Average protein per kg of trend weight. */
  proteinPerKg: number | null;
  /** Weight change over the week, kg: slope of the week's weigh-ins × 7 (no smoothing lag). */
  weightChange: number | null;
}

export function weeklyDiet(n: NutritionState, starts: number[]): DietWeek[] {
  const incomplete = new Set(n.incompleteDays);
  const trend = weightTrend(n.weights);
  const at = new Map(trend.map((t) => [t.date, t.trend]));
  return starts.map((start) => {
    const first = dayKey(new Date(start));
    let kcal = 0;
    let protein = 0;
    let days = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(first, i);
      if (incomplete.has(d)) continue;
      const t = dayTotals(n.log, d);
      if (t.kcal > 0) {
        kcal += t.kcal;
        protein += t.protein;
        days++;
      }
    }
    const xs: number[] = [];
    const ys: number[] = [];
    for (const w of n.weights) {
      const i = Math.round((new Date(w.date + 'T12:00').getTime() - start) / DAY);
      if (i >= 0 && i < 7) {
        xs.push(i);
        ys.push(w.kg);
      }
    }
    const slope = xs.length >= 3 && Math.max(...xs) - Math.min(...xs) >= 3 ? fitSlope(xs, ys) : null;
    const midWeight = at.get(addDays(first, 3)) ?? at.get(addDays(first, 6)) ?? at.get(first) ?? null;
    const avgProtein = days ? protein / days : null;
    return {
      start,
      loggedDays: days,
      avgKcal: days ? Math.round(kcal / days) : null,
      avgProtein: avgProtein != null ? Math.round(avgProtein) : null,
      proteinPerKg: avgProtein != null && midWeight ? Math.round((avgProtein / midWeight) * 10) / 10 : null,
      weightChange: slope != null ? Math.round(slope * 7 * 100) / 100 : null,
    };
  });
}

export interface Insight {
  title: string;
  detail: string;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Plain-language observations linking diet and strength. Each needs at least 2 weeks on both
 * sides of the comparison and 5 weeks in total with both diet and training data.
 */
export function crossInsights(index: (number | null)[], diet: DietWeek[], proteinGoalPerKg: number): Insight[] {
  // Week-to-week change of the strength index, paired with that week's diet.
  const rows: { delta: number; d: DietWeek }[] = [];
  for (let i = 1; i < index.length; i++) {
    const a = index[i - 1];
    const b = index[i];
    if (a == null || b == null || diet[i].loggedDays < 4) continue;
    rows.push({ delta: b - a, d: diet[i] });
  }
  const out: Insight[] = [];
  if (rows.length < 5) return out;
  const fmt = (v: number) => t('{v} pts', { v: `${v > 0 ? '+' : ''}${v.toFixed(1)}` });

  const withP = rows.filter((r) => r.d.proteinPerKg != null);
  const hi = withP.filter((r) => r.d.proteinPerKg! >= proteinGoalPerKg * 0.9);
  const lo = withP.filter((r) => r.d.proteinPerKg! < proteinGoalPerKg * 0.9);
  if (hi.length >= 2 && lo.length >= 2) {
    const [h, l] = [mean(hi.map((r) => r.delta)), mean(lo.map((r) => r.delta))];
    out.push({
      title: h > l ? t('Your strength moves more in high-protein weeks') : t('Protein does not explain your strength changes yet'),
      detail: t('Weeks near your protein goal ({a}): strength index {b} per week. Weeks below it ({c}): {d}.', { a: hi.length, b: fmt(h), c: lo.length, d: fmt(l) }),
    });
  }

  const withW = rows.filter((r) => r.d.weightChange != null);
  const cut = withW.filter((r) => r.d.weightChange! <= -0.2);
  const notCut = withW.filter((r) => r.d.weightChange! > -0.2);
  if (cut.length >= 2 && notCut.length >= 2) {
    const [c, m] = [mean(cut.map((r) => r.delta)), mean(notCut.map((r) => r.delta))];
    out.push({
      title: c < m - 0.5 ? t('Strength slows in your faster-loss weeks') : t('You keep your strength while losing weight'),
      detail: t('Weeks losing 0.2 kg or more ({a}): {b} per week. Other weeks ({c}): {d}.', { a: cut.length, b: fmt(c), c: notCut.length, d: fmt(m) }),
    });
  }
  return out;
}

/* ---------- Training days, streak, statistics pages ---------- */

const dayOf = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Number of distinct calendar days with a finished workout. */
export function trainingDays(workouts: Workout[]): number {
  return new Set(finished(workouts).map((w) => dayOf(w.startedAt))).size;
}

/** Day keys (local) with at least one finished workout, for calendars. */
export function trainedDaySet(workouts: Workout[]): Set<string> {
  return new Set(finished(workouts).map((w) => dayOf(w.startedAt)));
}
export const dayKeyOf = dayOf;

/**
 * Weeks in a row with at least one workout, ending with this week.
 * This week counts once it has a workout; until then the streak from last week still stands
 * (it is not lost before the week is over), and `thisWeekDone` says whether it is secured.
 */
export function weekStreak(workouts: Workout[], now = Date.now()): { weeks: number; thisWeekDone: boolean } {
  const days = finished(workouts).map((w) => w.startedAt);
  const has = (start: number) => days.some((t) => t >= start && t < weekEnd(start));
  let start = weekStart(now);
  const thisWeekDone = has(start);
  if (!thisWeekDone) start = weekStart(start - 3.5 * DAY);
  let weeks = 0;
  while (has(start)) {
    weeks++;
    start = weekStart(start - 3.5 * DAY);
  }
  return { weeks, thisWeekDone };
}

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs';
export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'core', 'shoulders', 'arms', 'legs'];
const GROUP_OF: Partial<Record<Muscle, MuscleGroup>> = {
  chest: 'chest',
  upper_back: 'back', lats: 'back', lower_back: 'back', traps: 'back', back: 'back',
  shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  abs: 'core',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
};

/** Working sets per muscle group between two times (full-body moves and cardio left out). */
export function groupSets(workouts: Workout[], exMap: Map<string, Exercise>, from: number, to: number): Record<MuscleGroup, number> {
  const out = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as Record<MuscleGroup, number>;
  for (const [m, n] of muscleSets(workouts, exMap, from, to)) {
    const g = GROUP_OF[m];
    if (g) out[g] += n;
  }
  return out;
}

export interface PeriodSummary {
  workouts: number;
  days: number;
  minutes: number;
  volume: number;
  sets: number;
}

/** Totals for workouts started in [from, to). */
export function periodSummary(workouts: Workout[], from: number, to: number): PeriodSummary {
  const inP = finished(workouts).filter((w) => w.startedAt >= from && w.startedAt < to);
  let sets = 0;
  let volume = 0;
  for (const w of inP)
    for (const we of w.exercises) {
      const kind = exerciseKind(we.exerciseId);
      for (const s of we.sets.filter(countsForStats)) {
        sets++;
        volume += setVolume(s, kind);
      }
    }
  return {
    workouts: inP.length,
    days: trainingDays(inP),
    minutes: Math.round(inP.reduce((t, w) => t + ((w.endedAt ?? w.startedAt) - w.startedAt), 0) / 60000),
    volume,
    sets,
  };
}

/** Exercises done most often in [from, to): number of workouts and working sets. */
export function topExercises(workouts: Workout[], from: number, to: number, limit = 10) {
  const m = new Map<string, { workouts: number; sets: number }>();
  for (const w of finished(workouts)) {
    if (w.startedAt < from || w.startedAt >= to) continue;
    const seen = new Set<string>();
    for (const we of w.exercises) {
      const sets = we.sets.filter(countsForStats).length;
      if (!sets) continue;
      const e = m.get(we.exerciseId) ?? { workouts: 0, sets: 0 };
      if (!seen.has(we.exerciseId)) e.workouts++;
      seen.add(we.exerciseId);
      e.sets += sets;
      m.set(we.exerciseId, e);
    }
  }
  return [...m.entries()]
    .map(([exerciseId, v]) => ({ exerciseId, ...v }))
    .sort((a, b) => b.workouts - a.workouts || b.sets - a.sets)
    .slice(0, limit);
}

/** First instant of the month containing `ts`, and of the month `offset` months away. */
export function monthStart(ts: number, offset = 0): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).getTime();
}
