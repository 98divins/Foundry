/**
 * The small training summary shared with friends, and the leaderboard built from it.
 * Only aggregates leave the device: no workouts, no notes, no nutrition, no body weight.
 */
import { recentPRs, strengthIndexByWeek, trainingDays, weekStarts, weekStreak, periodSummary } from './analytics';
import type { State } from './types';
import { computePRs, countsForStats, epley, finished, weekStart } from './utils';

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
  /** Average training days per week over the last 4 full weeks. */
  avgDays4w: number;
  streak: number;
  prs30: number;
  /** Strength index change over the last 4 weeks, in points (null without enough data). */
  strength4w: number | null;
  totalWorkouts: number;
  lastWorkoutAt: number | null;
  /** kg */
  lifts: Partial<Record<BigLift, number>>;
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
  return {
    v: 1,
    week: start,
    weekDays: week.days,
    weekWorkouts: week.workouts,
    weekSets: week.sets,
    weekVolume: Math.round(week.volume),
    weekMinutes: week.minutes,
    avgDays4w: Math.round((trainingDays(prev4) / 4) * 10) / 10,
    streak: weekStreak(w, now).weeks,
    prs30: recentPRs(w, computePRs(w), 30, now).length,
    strength4w: index.length >= 2 ? Math.round((index[index.length - 1] - index[0]) * 10) / 10 : null,
    totalWorkouts: done.length,
    lastWorkoutAt: done.length ? done[done.length - 1].startedAt : null,
    lifts,
  };
}

export type BoardMetric = 'weekDays' | 'weekSets' | 'weekVolume' | 'streak' | 'prs30' | 'strength4w';
const WEEKLY: BoardMetric[] = ['weekDays', 'weekSets', 'weekVolume'];

/** A friend's value for a metric; weekly numbers from a past week count as zero. */
export function metricValue(s: PublicStats | null | undefined, m: BoardMetric, now = Date.now()): number | null {
  if (!s) return null;
  if (WEEKLY.includes(m) && s.week !== weekStart(now)) return 0;
  if (m === 'streak') {
    // A streak not refreshed this week or last is over.
    return s.week >= weekStart(weekStart(now) - 3.5 * DAY) ? s.streak : 0;
  }
  return s[m];
}

export interface BoardRow<P> {
  person: P;
  value: number | null;
  rank: number;
}

/** Rank people by a metric, highest first; equal values share a rank; no data goes last. */
export function rankBoard<P>(people: { person: P; stats: PublicStats | null }[], m: BoardMetric, now = Date.now()): BoardRow<P>[] {
  const rows = people.map((p) => ({ person: p.person, value: metricValue(p.stats, m, now) }));
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
