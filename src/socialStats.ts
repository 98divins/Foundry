/**
 * The small training summary shared with friends, and the leaderboard built from it.
 * Only aggregates leave the device: no workouts, no notes, no nutrition, no body weight.
 */
import { recentPRs, strengthIndexByWeek, trainingDays, weekStarts, weekStreak, periodSummary } from './analytics';
import { goalRate, weekGoal } from './goals';
import { progression } from './levels';
import { monthChallenges, monthKey } from './challenges';
import type { State } from './types';
import { computePRs, countsForStats, epley, exerciseKind, finished, weekStart } from './utils';

const DAY = 86400000;

/** The four lifts friends compare (estimated 1RM, best of the last 90 days). */
export const BIG_LIFTS = ['squat_bb', 'bench_bb', 'deadlift_bb', 'ohp_bb'] as const;
export type BigLift = (typeof BIG_LIFTS)[number];

export interface PublicStats {
  v: 1;
  /** Start of the week these weekly numbers belong to (ms). Older weeks count as zero. */
  week: number;
  weekDays: number;
  weekWorkouts: number;
  weekSets: number;
  /** kg */
  weekVolume: number;
  weekMinutes: number;
  /** Minutes of cardio this week (cardio exercises: duration of their sets). */
  weekCardio?: number;
  /** km of cardio this week. */
  weekCardioKm?: number;
  /** Average training days per week over the last 4 full weeks. */
  avgDays4w: number;
  streak: number;
  prs30: number;
  /** Strength index change over the last 4 weeks, in points (null without enough data). */
  strength4w: number | null;
  totalWorkouts: number;
  lastWorkoutAt: number | null;
  /** kg, best estimated 1RM over the last 90 days. */
  lifts: Partial<Record<BigLift, number>>;
  /** Records beaten this week. */
  weekPrs?: number;
  /** kg, best estimated 1RM this week. */
  weekLifts?: Partial<Record<BigLift, number>>;
  /** When these numbers were computed (rolling periods are as of then). */
  computedAt?: number;
  /** Totals over rolling periods: last 30, 182 and 365 days. */
  periods?: Partial<Record<RollingPeriod, PeriodStats>>;
  /** This week's goal progress, 0–100 (null without goals). */
  weekGoalPct?: number | null;
  /** Level and badge ids (levels.ts). */
  level?: number;
  badges?: string[];
  /**
   * Training days of the last 365 days, for comparisons over any dates: "day.sets.volume.cardio.records"
   * in base 36 (day = days since 1970 in local time; volume in kg), comma separated.
   */
  days?: string;
  /** This month's challenges: month key and progress by challenge id. */
  challenges?: { month: string; progress: Record<string, number> };
}

export type RollingPeriod = '30' | '182' | '365';
export type BoardPeriod = 'week' | RollingPeriod;
export const BOARD_PERIODS: BoardPeriod[] = ['week', '30', '182', '365'];

export interface PeriodStats {
  days: number;
  sets: number;
  /** kg */
  volume: number;
  prs: number;
  /** Strength index change over the period, in points. */
  strength: number | null;
  /** % of full weeks where the person met their own goals. */
  goals: number | null;
  /** Minutes of cardio. */
  cardio?: number;
  /** km of cardio. */
  cardioKm?: number;
  /** kg, best estimated 1RM over the period. */
  lifts?: Partial<Record<BigLift, number>>;
}

/** Cardio minutes and km between two times: every set of a cardio exercise (duration and distance). */
export function cardioIn(workouts: State['workouts'], from: number, to: number): { cardio: number; cardioKm: number } {
  let sec = 0;
  let km = 0;
  for (const w of finished(workouts)) {
    if (w.startedAt < from || w.startedAt >= to) continue;
    for (const we of w.exercises) {
      if (exerciseKind(we.exerciseId) !== 'cardio') continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        sec += s.duration ?? 0;
        km += s.distance ?? 0;
      }
    }
  }
  return { cardio: Math.round(sec / 60), cardioKm: Math.round(km * 10) / 10 };
}

/** Best estimated 1RM of the big lifts between two times (kg, one decimal). */
export function bestLifts(workouts: State['workouts'], from: number, to: number): Partial<Record<BigLift, number>> {
  const lifts: Partial<Record<BigLift, number>> = {};
  for (const x of finished(workouts)) {
    if (x.startedAt < from || x.startedAt >= to) continue;
    for (const we of x.exercises) {
      if (!(BIG_LIFTS as readonly string[]).includes(we.exerciseId)) continue;
      for (const s of we.sets) {
        if (!countsForStats(s) || !s.weight || !s.reps) continue;
        const e = Math.round(epley(s.weight, s.reps) * 10) / 10;
        const id = we.exerciseId as BigLift;
        if (e > (lifts[id] ?? 0)) lifts[id] = e;
      }
    }
  }
  return lifts;
}

export function buildPublicStats(state: State, now = Date.now()): PublicStats {
  const w = state.workouts;
  const start = weekStart(now);
  const week = periodSummary(w, start, now + DAY);
  const starts = weekStarts(5, now);
  const prev4 = finished(w).filter((x) => x.startedAt >= starts[0] && x.startedAt < starts[4]);
  const index = strengthIndexByWeek(w, starts).filter((v): v is number => v != null);
  const lifts: Partial<Record<BigLift, number>> = {};
  for (const x of finished(w)) {
    if (x.startedAt < now - 90 * DAY) continue;
    for (const we of x.exercises) {
      if (!(BIG_LIFTS as readonly string[]).includes(we.exerciseId)) continue;
      for (const s of we.sets) {
        if (!countsForStats(s) || !s.weight || !s.reps) continue;
        const e = Math.round(epley(s.weight, s.reps) * 10) / 10;
        const id = we.exerciseId as BigLift;
        if (e > (lifts[id] ?? 0)) lifts[id] = e;
      }
    }
  }
  const done = finished(w);
  const prs = computePRs(w);
  const periods: Partial<Record<RollingPeriod, PeriodStats>> = {};
  for (const p of ['30', '182', '365'] as RollingPeriod[]) {
    const days = Number(p);
    const from = now - days * DAY;
    const sum = periodSummary(w, from, now + DAY);
    const idx = strengthIndexByWeek(w, weekStarts(Math.ceil(days / 7) + 1, now)).filter((v): v is number => v != null);
    periods[p] = {
      days: sum.days,
      sets: sum.sets,
      volume: Math.round(sum.volume),
      prs: recentPRs(w, prs, days, now).length,
      strength: idx.length >= 2 ? Math.round((idx[idx.length - 1] - idx[0]) * 10) / 10 : null,
      goals: goalRate(state, state.goals, from, now),
      ...cardioIn(w, from, now + DAY),
      lifts: bestLifts(w, from, now + DAY),
    };
  }
  return {
    v: 1,
    week: start,
    weekDays: week.days,
    weekWorkouts: week.workouts,
    weekSets: week.sets,
    weekVolume: Math.round(week.volume),
    weekMinutes: week.minutes,
    weekCardio: cardioIn(w, start, now + DAY).cardio,
    weekCardioKm: cardioIn(w, start, now + DAY).cardioKm,
    avgDays4w: Math.round((trainingDays(prev4) / 4) * 10) / 10,
    streak: weekStreak(w, now).weeks,
    prs30: recentPRs(w, computePRs(w), 30, now).length,
    weekPrs: (() => {
      let n = 0;
      for (const x of finished(w)) if (x.startedAt >= start) for (const we of x.exercises) for (const s of we.sets) if (prs.has(s.id)) n++;
      return n;
    })(),
    weekLifts: bestLifts(w, start, now + DAY),
    strength4w: index.length >= 2 ? Math.round((index[index.length - 1] - index[0]) * 10) / 10 : null,
    totalWorkouts: done.length,
    lastWorkoutAt: done.length ? done[done.length - 1].startedAt : null,
    lifts,
    computedAt: now,
    periods,
    ...(() => {
      const p = progression(state, now);
      const m = monthKey(now);
      return { level: p.level, badges: p.badges, challenges: { month: m, progress: Object.fromEntries(monthChallenges(state, m).map((c) => [c.def.id, c.value])) } };
    })(),
    days: encodeDays(state, now),
    weekGoalPct: state.goals ? Math.round(weekGoal(state, state.goals, start, now).progress * 100) : null,
  };
}

const dayNum = (t: number) => {
  const d = new Date(t);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
};

/** Compact per-day summary of the last 365 days (see PublicStats.days). */
export function encodeDays(state: State, now = Date.now()): string {
  const prs = computePRs(state.workouts);
  const by = new Map<number, [number, number, number, number]>();
  for (const w of finished(state.workouts)) {
    if (w.startedAt < now - 365 * DAY) continue;
    const k = dayNum(w.startedAt);
    const v = by.get(k) ?? [0, 0, 0, 0];
    let sec = 0;
    for (const we of w.exercises) {
      const cardio = exerciseKind(we.exerciseId) === 'cardio';
      for (const s of we.sets) {
        if (!s.done) continue;
        if (cardio) sec += s.duration ?? 0;
        if (prs.has(s.id)) v[3]++;
      }
    }
    v[0] += w.exercises.reduce((n, we) => n + we.sets.filter((s) => s.done && s.type !== 'warmup').length, 0);
    v[1] += Math.round(w.exercises.reduce((n, we) => n + we.sets.reduce((m, s) => m + (s.done && s.weight && s.reps ? s.weight * s.reps : 0), 0), 0));
    v[2] += Math.round(sec / 60);
    by.set(k, v);
  }
  const out = [...by.entries()].sort((a, b) => b[0] - a[0]).map(([k, v]) => [k, ...v].map((x) => x.toString(36)).join('.'));
  // Stay well inside the server's size limit: drop the oldest days if needed.
  let s = '';
  for (const e of out) {
    if (s.length + e.length + 1 > 4500) break;
    s = s ? s + ',' + e : e;
  }
  return s;
}

export interface RangeTotals {
  days: number;
  sets: number;
  volume: number;
  cardio: number;
  records: number;
}

/** Totals between two dates (inclusive, ms) from an encoded summary; null when it is not shared. */
export function rangeTotals(days: string | undefined, from: number, to: number): RangeTotals | null {
  if (days == null) return null;
  const a = dayNum(from);
  const b = dayNum(to);
  const r: RangeTotals = { days: 0, sets: 0, volume: 0, cardio: 0, records: 0 };
  if (!days) return r;
  for (const e of days.split(',')) {
    const [k, sets, vol, cardio, rec] = e.split('.').map((x) => parseInt(x, 36));
    if (k < a || k > b) continue;
    r.days++;
    r.sets += sets;
    r.volume += vol;
    r.cardio += cardio;
    r.records += rec;
  }
  return r;
}

export type BoardMetric = 'days' | 'sets' | 'volume' | 'cardio' | 'streak' | 'prs' | 'strength' | 'goals';

/**
 * A person's value for a metric over a period. This week's numbers from an older week count as zero;
 * rolling periods are taken as published (missing on older app versions: no value).
 */
export function metricValue(s: PublicStats | null | undefined, m: BoardMetric, period: BoardPeriod = 'week', now = Date.now()): number | null {
  if (!s) return null;
  if (m === 'streak') return s.week >= weekStart(weekStart(now) - 3.5 * DAY) ? s.streak : 0;
  if (period === 'week') {
    const current = s.week === weekStart(now);
    switch (m) {
      case 'days':
        return current ? s.weekDays : 0;
      case 'sets':
        return current ? s.weekSets : 0;
      case 'volume':
        return current ? s.weekVolume : 0;
      case 'prs':
        // This week's records; older app versions only shared the last 30 days.
        return s.weekPrs == null ? null : current ? s.weekPrs : 0;
      case 'strength':
        return s.strength4w;
      case 'goals':
        return s.weekGoalPct == null ? null : current ? s.weekGoalPct : 0;
      case 'cardio':
        return s.weekCardio == null ? null : current ? s.weekCardio : 0;
    }
  }
  const p = s.periods?.[period];
  return p ? (p[m] ?? null) : null;
}

export interface BoardRow<P> {
  person: P;
  value: number | null;
  rank: number;
}

/** Rank people by a metric, highest first; equal values share a rank; no data goes last. */
export function rankBoard<P>(people: { person: P; stats: PublicStats | null }[], m: BoardMetric, period: BoardPeriod = 'week', now = Date.now()): BoardRow<P>[] {
  return rankBy(people, (st) => metricValue(st, m, period, now));
}

/** Ranks people by any value, highest first; equal values share a rank, missing values come last. */
export function rankBy<P>(people: { person: P; stats: PublicStats | null }[], value: (s: PublicStats | null) => number | null): BoardRow<P>[] {
  const rows = people.map((p) => ({ person: p.person, value: value(p.stats) }));
  rows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  let rank = 0;
  let last: number | null | undefined;
  return rows.map((r, i) => {
    if (r.value !== last) {
      rank = i + 1;
      last = r.value;
    }
    return { ...r, rank };
  });
}

/** Metrics that can be totalled over any dates (from the shared per-day summary). */
export const RANGE_METRICS: BoardMetric[] = ['days', 'sets', 'volume', 'cardio', 'prs'];

/** A metric over chosen dates (inclusive); null when not shared or not available over dates. */
export function rangeMetric(s: PublicStats | null | undefined, m: BoardMetric, from: number, to: number): number | null {
  const r = rangeTotals(s?.days, from, to);
  if (!r) return null;
  return m === 'days' ? r.days : m === 'sets' ? r.sets : m === 'volume' ? r.volume : m === 'cardio' ? r.cardio : m === 'prs' ? r.records : null;
}

/** The shortest standard period that reaches back to `from` (for figures only kept per period). */
export function coveringPeriod(from: number, now = Date.now()): BoardPeriod {
  const days = (now - from) / 86400000;
  return days < 7 ? 'week' : days <= 30 ? '30' : days <= 182 ? '182' : '365';
}

/**
 * Face-to-face score: one point per compared figure won (higher is better); ties and figures one
 * side does not share count for nobody.
 */
export function compareScore(pairs: [number | null | undefined, number | null | undefined][]): [number, number] {
  let a = 0;
  let b = 0;
  for (const [x, y] of pairs) {
    if (x == null || y == null || x === y) continue;
    if (x > y) a++;
    else b++;
  }
  return [a, b];
}

/** Average training days per week over a period (null when not shared). */
export function daysPerWeek(s: PublicStats | null | undefined, period: BoardPeriod, now = Date.now()): number | null {
  const d = metricValue(s, 'days', period, now);
  if (d == null) return null;
  if (period === 'week') return d;
  return Math.round((d / (Number(period) / 7)) * 10) / 10;
}

/** Best estimated 1RM per big lift over a period (null when not shared, e.g. older app versions). */
export function liftsFor(s: PublicStats | null | undefined, period: BoardPeriod, now = Date.now()): Partial<Record<BigLift, number>> | null {
  if (!s) return null;
  if (period === 'week') return s.weekLifts ? (s.week === weekStart(now) ? s.weekLifts : {}) : null;
  return s.periods?.[period]?.lifts ?? null;
}
