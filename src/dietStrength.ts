/**
 * Diet × strength (plan 4.5): the weekly card, phase reviews and rule-based tips. Pure functions,
 * tested on synthetic data in dietStrength.test.ts. Tips are observations with minimum data
 * thresholds, worded carefully: they never claim a cause.
 */
import { e1rmSessions, type DietWeek } from './analytics';
import { addDays, dayKey, parseDay, weightTrend, type ExpenditurePoint, type NutritionState, type Phase, type PhaseKind } from './nutrition';
import type { Workout } from './types';
import { tk } from './i18n';

const DAY = 86400000;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Average expenditure estimate over each week (null without an estimate). */
export function weeklyExpenditure(series: ExpenditurePoint[], starts: number[]): (number | null)[] {
  const at = new Map(series.map((p) => [p.date, p.estimate]));
  return starts.map((start) => {
    const first = dayKey(new Date(start));
    const xs: number[] = [];
    for (let i = 0; i < 7; i++) {
      const v = at.get(addDays(first, i));
      if (v != null) xs.push(v);
    }
    return xs.length ? Math.round(mean(xs)) : null;
  });
}

export interface WeekSummary {
  start: number;
  loggedDays: number;
  /** Average intake minus estimated expenditure, kcal/day (negative = deficit). */
  kcalGap: number | null;
  proteinPerKg: number | null;
  weightChange: number | null;
  /** Change of the strength index from the week before, points. */
  strengthDelta: number | null;
}

export function weekSummaries(diet: DietWeek[], index: (number | null)[], expenditure: (number | null)[]): WeekSummary[] {
  return diet.map((d, i) => ({
    start: d.start,
    loggedDays: d.loggedDays,
    kcalGap: d.avgKcal != null && expenditure[i] != null && d.loggedDays >= 4 ? Math.round(d.avgKcal - expenditure[i]!) : null,
    proteinPerKg: d.loggedDays >= 4 ? d.proteinPerKg : null,
    weightChange: d.weightChange,
    strengthDelta: i > 0 && index[i] != null && index[i - 1] != null ? Math.round((index[i]! - index[i - 1]!) * 10) / 10 : null,
  }));
}

/**
 * The card for the last complete week. Shown from the second week of data: that week must have
 * at least 4 logged days and an earlier week must have some data too.
 */
export function weeklyCard(weeks: WeekSummary[]): WeekSummary | null {
  const done = weeks.slice(0, -1); // the last entry is the week in progress
  const last = done[done.length - 1];
  if (!last || last.loggedDays < 4) return null;
  if (!done.slice(0, -1).some((w) => w.loggedDays > 0)) return null;
  return last;
}

/* ---------- Tips ---------- */

export interface Tip {
  id: 'protein-cut' | 'fast-loss' | 'fast-gain' | 'low-protein';
  title: string;
  text: string;
}

const inDeficit = (w: WeekSummary) => (w.weightChange != null && w.weightChange <= -0.2) || (w.kcalGap != null && w.kcalGap <= -250);

/**
 * Rules on the last complete weeks (the week in progress is left out). Each rule needs every week
 * it looks at to have 4+ logged days and the figures it uses; otherwise it stays silent.
 */
export function dietTips(weeks: WeekSummary[], bodyKg: number | null): Tip[] {
  const done = weeks.slice(0, -1);
  const last = (n: number) => (done.length >= n ? done.slice(-n) : null);
  const full = (ws: WeekSummary[] | null): ws is WeekSummary[] => !!ws && ws.every((w) => w.loggedDays >= 4);
  const out: Tip[] = [];

  const two = last(2);
  if (full(two) && two.every((w) => inDeficit(w) && w.strengthDelta != null && w.strengthDelta < 0 && w.proteinPerKg != null)) {
    if (mean(two.map((w) => w.proteinPerKg!)) < 1.6)
      out.push({
        id: 'protein-cut',
        title: tk('Strength down two weeks in a row'),
        text: tk(
          'You are in a deficit, your strength index went down two weeks running and protein averaged under 1.6 g per kg. Many lifters keep strength better with a bit more protein during a cut.',
        ),
      });
    else if (bodyKg && two.every((w) => w.weightChange != null && w.weightChange <= -0.01 * bodyKg))
      out.push({
        id: 'fast-loss',
        title: tk('Losing fast while strength drops'),
        text: tk(
          'You lost more than 1 % of your weight per week for two weeks while your strength index went down. A slower rate could help you hold on to strength.',
        ),
      });
  }

  const three = last(3);
  if (
    bodyKg &&
    full(three) &&
    three.every((w) => w.weightChange != null && w.weightChange >= 0.005 * bodyKg && w.strengthDelta != null) &&
    three.reduce((s, w) => s + w.strengthDelta!, 0) <= 0.5
  )
    out.push({
      id: 'fast-gain',
      title: tk('Weight up, strength flat'),
      text: tk(
        'For three weeks your weight went up more than 0.5 % a week while your strength index barely moved. If the goal is muscle, a smaller surplus may be enough.',
      ),
    });

  if (full(two) && !out.some((x) => x.id === 'protein-cut') && two.every((w) => w.proteinPerKg != null && w.proteinPerKg < 1.2))
    out.push({
      id: 'low-protein',
      title: tk('Protein on the low side'),
      text: tk('Protein averaged under 1.2 g per kg for two weeks. For strength training, 1.6 to 2.2 g per kg is a common range.'),
    });
  return out;
}

/* ---------- Phases ---------- */

export const PHASE_LABEL: Record<PhaseKind, string> = { cut: tk('Cut'), maintain: tk('Maintenance'), bulk: tk('Bulk') };

/** Starts a phase today (or on `start`), ending the one running the day before. */
export function startPhase(phases: Phase[] | undefined, kind: PhaseKind, start: string, id: string): Phase[] {
  // Phases starting on or after the new start are replaced; one still running then is ended the day before.
  const before = (phases ?? []).filter((p) => p.start < start).map((p) => (p.end == null || p.end >= start ? { ...p, end: addDays(start, -1) } : p));
  return [...before, { id, kind, start }];
}

/** Ends the running phase on `end` (inclusive). */
export const endPhase = (phases: Phase[] | undefined, end: string): Phase[] =>
  (phases ?? []).map((p) => (p.end == null ? { ...p, end: end < p.start ? p.start : end } : p));

export interface PhaseReview {
  phase: Phase;
  days: number;
  /** Trend weight change over the phase, kg. */
  weightChange: number | null;
  /** Average change of the lifts trained at both ends of the phase, % of the starting e1RM. */
  strengthChange: number | null;
  lifts: number;
  avgKcal: number | null;
  proteinPerKg: number | null;
}

/**
 * Compares the start and the end of a phase: trend weight on the first and last day, and the best
 * estimated 1RM of each lift in its first and last two weeks (lifts trained in both only).
 */
export function phaseReview(phase: Phase, workouts: Workout[], n: NutritionState, today = dayKey()): PhaseReview {
  const end = phase.end ?? today;
  const days = Math.max(1, Math.round((parseDay(end).getTime() - parseDay(phase.start).getTime()) / DAY) + 1);
  const trend = new Map(weightTrend(n.weights, end).map((p) => [p.date, p.trend]));
  const w0 = trend.get(phase.start);
  const w1 = trend.get(end);
  const from = parseDay(phase.start).getTime();
  const to = parseDay(end).getTime() + DAY;
  const changes: number[] = [];
  if (days >= 21) {
    for (const pts of e1rmSessions(workouts).values()) {
      const a = pts.filter((p) => p.date >= from && p.date < from + 14 * DAY).map((p) => p.e1rm);
      const b = pts.filter((p) => p.date >= to - 14 * DAY && p.date < to).map((p) => p.e1rm);
      if (a.length && b.length) changes.push(Math.max(...b) / Math.max(...a) - 1);
    }
  }
  let kcal = 0;
  let protein = 0;
  let logged = 0;
  const incomplete = new Set(n.incompleteDays);
  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const e of n.log) {
    if (e.planned || e.date < phase.start || e.date > end || incomplete.has(e.date)) continue;
    const d = byDay.get(e.date) ?? { kcal: 0, protein: 0 };
    d.kcal += e.kcal;
    d.protein += e.protein;
    byDay.set(e.date, d);
  }
  for (const d of byDay.values()) {
    kcal += d.kcal;
    protein += d.protein;
    logged++;
  }
  const midKg = w0 != null && w1 != null ? (w0 + w1) / 2 : (w1 ?? w0 ?? null);
  return {
    phase,
    days,
    weightChange: w0 != null && w1 != null ? Math.round((w1 - w0) * 10) / 10 : null,
    strengthChange: changes.length ? Math.round(mean(changes) * 1000) / 10 : null,
    lifts: changes.length,
    avgKcal: logged >= 7 ? Math.round(kcal / logged) : null,
    proteinPerKg: logged >= 7 && midKg ? Math.round((protein / logged / midKg) * 10) / 10 : null,
  };
}
