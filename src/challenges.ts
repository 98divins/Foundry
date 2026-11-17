/**
 * Monthly challenges: three each month, the same for everyone, picked from a pool in rotation.
 * Progress is computed from the history (nothing stored); friends see each other's progress through
 * the shared stats. Goals are about consistency or effort, never about the weight lifted.
 */
import { cardioIn } from './socialStats';
import { dietOnTarget } from './goals';
import { tk } from './i18n';
import { countsForXp } from './levels';
import type { State } from './types';
import { computePRs, finished, workoutSetCount } from './utils';

export interface ChallengeDef {
  id: string;
  name: string;
  /** "{target} workouts" style text. */
  goal: string;
  target: number;
  unit?: string;
  measure: (state: State, from: number, to: number) => number;
}

const dayOf = (ts: number) => new Date(ts).toDateString();

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'workouts12',
    name: tk('Twelve sessions'),
    goal: tk('Finish {target} workouts this month.'),
    target: 12,
    measure: (s, a, b) => finished(s.workouts).filter((w) => w.startedAt >= a && w.startedAt < b && countsForXp(w)).length,
  },
  {
    id: 'days16',
    name: tk('Sixteen days'),
    goal: tk('Train on {target} different days this month.'),
    target: 16,
    measure: (s, a, b) =>
      new Set(
        finished(s.workouts)
          .filter((w) => w.startedAt >= a && w.startedAt < b)
          .map((w) => dayOf(w.startedAt)),
      ).size,
  },
  {
    id: 'sets250',
    name: tk('250 sets'),
    goal: tk('Do {target} sets this month.'),
    target: 250,
    measure: (s, a, b) =>
      finished(s.workouts)
        .filter((w) => w.startedAt >= a && w.startedAt < b)
        .reduce((n, w) => n + workoutSetCount(w), 0),
  },
  {
    id: 'cardio300',
    name: tk('Cardio 300'),
    goal: tk('Do {target} minutes of cardio this month.'),
    target: 300,
    unit: 'min',
    measure: (s, a, b) => cardioIn(s.workouts, a, b).cardio,
  },
  {
    id: 'records5',
    name: tk('Five records'),
    goal: tk('Beat {target} of your records this month.'),
    target: 5,
    measure: (s, a, b) => {
      const prs = computePRs(s.workouts);
      let n = 0;
      for (const w of finished(s.workouts))
        if (w.startedAt >= a && w.startedAt < b) for (const e of w.exercises) for (const x of e.sets) if (prs.has(x.id)) n++;
      return n;
    },
  },
  {
    id: 'diet15',
    name: tk('On target'),
    goal: tk('Stay within your nutrition targets {target} days this month.'),
    target: 15,
    measure: (s, a, b) => {
      let n = 0;
      for (let t = a; t < b && t <= Date.now(); t += 86400000) {
        const d = new Date(t);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dietOnTarget(s.nutrition, key)) n++;
      }
      return n;
    },
  },
  {
    id: 'weigh8',
    name: tk('Weigh-in habit'),
    goal: tk('Log your weight on {target} days this month.'),
    target: 8,
    measure: (s, a, b) =>
      new Set(
        s.nutrition.weights
          .filter((w) => {
            const t = new Date(w.date + 'T12:00').getTime();
            return t >= a && t < b;
          })
          .map((w) => w.date),
      ).size,
  },
];

export const monthKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export function monthBounds(key: string): [number, number] {
  const [y, m] = key.split('-').map(Number);
  return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()];
}

/** The three challenges of a month: a rotation through the pool, the first one always about training. */
export function challengesOf(key: string): ChallengeDef[] {
  const [y, m] = key.split('-').map(Number);
  const i = y * 12 + m;
  const training = CHALLENGES.filter((c) => ['workouts12', 'days16', 'sets250'].includes(c.id));
  const others = CHALLENGES.filter((c) => !training.includes(c));
  const a = training[i % training.length];
  const b = others[i % others.length];
  const c = others[(i + 2) % others.length];
  return [a, b, c];
}

export interface ChallengeProgress {
  def: ChallengeDef;
  value: number;
  done: boolean;
}

export function monthChallenges(state: State, key = monthKey()): ChallengeProgress[] {
  const [a, b] = monthBounds(key);
  return challengesOf(key).map((def) => {
    const value = def.measure(state, a, b);
    return { def, value, done: value >= def.target };
  });
}

/** Challenges completed in every month since the first workout (for badges). */
export function completedChallenges(state: State, now = Date.now()): { count: number; perfectMonths: number } {
  const first = finished(state.workouts)[0]?.startedAt;
  if (!first) return { count: 0, perfectMonths: 0 };
  let n = 0;
  let perfect = 0;
  const d = new Date(first);
  for (let k = monthKey(new Date(d.getFullYear(), d.getMonth(), 1).getTime()); ;) {
    const done = monthChallenges(state, k).filter((c) => c.done).length;
    n += done;
    if (done === 3) perfect++;
    const [, end] = monthBounds(k);
    if (end > now) break;
    k = monthKey(end);
  }
  return { count: n, perfectMonths: perfect };
}
