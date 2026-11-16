/** Reviews of a week, a month or a year: everything is computed from the history of that period. */
import { cardioIn } from './socialStats';
import { progression } from './levels';
import type { State } from './types';
import { computePRs, epley, countsForStats, finished, workoutSetCount, workoutVolume } from './utils';

export type RecapKind = 'week' | 'month' | 'year';

export interface YearReview {
  year: number;
  from: number;
  to: number;
  workouts: number;
  days: number;
  hours: number;
  /** kg */
  volume: number;
  sets: number;
  records: number;
  bestStreak: number;
  cardioMin: number;
  cardioKm: number;
  favourite: { exerciseId: string; sets: number } | null;
  /** Best estimated 1RM at the start and end of the year, for the most trained lifts. */
  lifts: { exerciseId: string; from: number; to: number }[];
  /** 0 = Monday … 6 = Sunday */
  favouriteWeekday: number | null;
  busiestMonth: { month: number; workouts: number } | null;
  levelFrom: number;
  levelTo: number;
  newBadges: string[];
  weightFrom: number | null;
  weightTo: number | null;
  loggedDays: number;
}

export function yearsWithData(state: State): number[] {
  return [...new Set(finished(state.workouts).map((w) => new Date(w.startedAt).getFullYear()))].sort((a, b) => b - a);
}

const keyOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Start and end (exclusive) of the week / month / year containing `t`, shifted by `offset` periods. */
export function periodRange(kind: RecapKind, t: number, offset = 0): [number, number] {
  const d = new Date(t);
  if (kind === 'year') return [new Date(d.getFullYear() + offset, 0, 1).getTime(), new Date(d.getFullYear() + offset + 1, 0, 1).getTime()];
  if (kind === 'month') return [new Date(d.getFullYear(), d.getMonth() + offset, 1).getTime(), new Date(d.getFullYear(), d.getMonth() + offset + 1, 1).getTime()];
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 7 * offset);
  return [m.getTime(), new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7).getTime()];
}

export function yearReview(state: State, year: number): YearReview {
  return periodReview(state, new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime());
}

export function periodReview(state: State, a: number, b: number): YearReview {
  const year = new Date(a).getFullYear();
  const ka = keyOf(a);
  const kb = keyOf(b);
  const inRange = (k: string) => k >= ka && k < kb;
  const all = finished(state.workouts);
  const ws = all.filter((w) => w.startedAt >= a && w.startedAt < b);
  const dayKey = (t: number) => new Date(t).toDateString();
  const prs = computePRs(state.workouts);

  const setsBy = new Map<string, number>();
  let records = 0;
  for (const w of ws)
    for (const e of w.exercises) {
      const n = e.sets.filter((s) => s.done).length;
      setsBy.set(e.exerciseId, (setsBy.get(e.exerciseId) ?? 0) + n);
      for (const s of e.sets) if (prs.has(s.id)) records++;
    }
  const fav = [...setsBy.entries()].sort((x, y) => y[1] - x[1])[0];

  // Lifts: the 3 weight exercises with the most sessions; best e1RM in the first and last 2 months trained.
  const best = (id: string, from: number, to: number) => {
    let m = 0;
    for (const w of all) if (w.startedAt >= from && w.startedAt < to) for (const e of w.exercises) if (e.exerciseId === id) for (const s of e.sets) if (countsForStats(s) && s.weight && s.reps) m = Math.max(m, epley(s.weight, s.reps));
    return Math.round(m * 10) / 10;
  };
  const sessions = new Map<string, number>();
  for (const w of ws) for (const e of w.exercises) if (e.sets.some((s) => s.weight && s.reps && s.done)) sessions.set(e.exerciseId, (sessions.get(e.exerciseId) ?? 0) + 1);
  // Best before the period → best during it (for a year: first two months → last two months).
  const long = b - a > 200 * 86400000;
  const firstT = ws[0]?.startedAt ?? a;
  const lastT = ws[ws.length - 1]?.startedAt ?? b;
  const minSessions = long ? 4 : b - a > 20 * 86400000 ? 2 : 1;
  const lifts = [...sessions.entries()]
    .filter(([, n]) => n >= minSessions)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([id]) => ({
      exerciseId: id,
      from: long ? best(id, firstT, firstT + 60 * 86400000) : best(id, 0, a),
      to: long ? best(id, lastT - 60 * 86400000, b) : best(id, a, b),
    }))
    .filter((l) => l.from > 0 && l.to > 0);

  const wd = [0, 0, 0, 0, 0, 0, 0];
  const mo = new Array(12).fill(0);
  for (const w of ws) {
    const d = new Date(w.startedAt);
    wd[(d.getDay() + 6) % 7]++;
    mo[d.getMonth()]++;
  }
  const topWd = ws.length ? wd.indexOf(Math.max(...wd)) : null;
  const topMo = ws.length ? mo.indexOf(Math.max(...mo)) : -1;

  // Longest run of weeks with a workout, within the year.
  let bestStreak = 0;
  let chain = 0;
  const monday = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  const weeks = new Set(ws.map((w) => monday(w.startedAt)));
  for (let t = monday(a); t < b; t = monday(t + 10 * 86400000)) {
    chain = weeks.has(t) ? chain + 1 : 0;
    bestStreak = Math.max(bestStreak, chain);
  }

  const before = { ...state, workouts: state.workouts.filter((w) => w.startedAt < a), nutrition: { ...state.nutrition, log: state.nutrition.log.filter((e) => e.date < ka), weights: state.nutrition.weights.filter((x) => x.date < ka) } };
  const atEnd = { ...state, workouts: state.workouts.filter((w) => w.startedAt < b), nutrition: { ...state.nutrition, log: state.nutrition.log.filter((e) => e.date < kb), weights: state.nutrition.weights.filter((x) => x.date < kb) } };
  const p0 = progression(before as State, a);
  const p1 = progression(atEnd as State, Math.min(b - 1, Date.now()));
  const wts = state.nutrition.weights.filter((x) => inRange(x.date)).sort((x, y) => x.date.localeCompare(y.date));
  const cardio = cardioIn(state.workouts, a, b);

  return {
    year,
    from: a,
    to: b,
    workouts: ws.length,
    days: new Set(ws.map((w) => dayKey(w.startedAt))).size,
    hours: Math.round(ws.reduce((s, w) => s + (w.endedAt! - w.startedAt - (w.pausedMs ?? 0)), 0) / 360000) / 10,
    volume: Math.round(ws.reduce((s, w) => s + workoutVolume(w), 0)),
    sets: ws.reduce((s, w) => s + workoutSetCount(w), 0),
    records,
    bestStreak,
    cardioMin: cardio.cardio,
    cardioKm: cardio.cardioKm,
    favourite: fav ? { exerciseId: fav[0], sets: fav[1] } : null,
    lifts,
    favouriteWeekday: topWd,
    busiestMonth: topMo >= 0 ? { month: topMo, workouts: mo[topMo] } : null,
    levelFrom: p0.level,
    levelTo: p1.level,
    newBadges: p1.badges.filter((x) => !p0.badges.includes(x)),
    weightFrom: wts[0]?.kg ?? null,
    weightTo: wts[wts.length - 1]?.kg ?? null,
    loggedDays: new Set(state.nutrition.log.filter((e) => !e.planned && inRange(e.date)).map((e) => e.date)).size,
  };
}
