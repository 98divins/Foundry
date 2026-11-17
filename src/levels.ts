/**
 * Levels, XP and badges. Everything is computed from the history, so an existing account starts at
 * the right level and nothing has to be stored or synced. XP rewards showing up, not lifting heavy:
 * a beginner levels up as fast as an advanced lifter with the same consistency.
 */
import { completedChallenges } from './challenges';
import { dietOnTarget } from './goals';
import { gearCount, GEAR_SLOTS } from './gear';
import { tk } from './i18n';
import type { State, Workout } from './types';
import { computePRs, epley, countsForStats, finished, weekStart, workoutSetCount, workoutVolume } from './utils';

const DAY = 86400000;
const nextWeek = (start: number) => weekStart(start + 10.5 * DAY);
const dayOf = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const XP = {
  workout: 100,
  record: 25,
  recordsPerWorkout: 3,
  workoutsPerDay: 2,
  weekGoal: 200,
  /** Per week in a row with a workout, on top of that week (capped at 10 weeks). */
  streakStep: 20,
  streakCap: 10,
  dietDay: 30,
  weighInWeek: 20,
} as const;

/** A workout counts when it is a real session: 20 minutes or 6 done sets. */
export function countsForXp(w: Workout): boolean {
  if (!w.endedAt) return false;
  const minutes = (w.endedAt - w.startedAt - (w.pausedMs ?? 0)) / 60000;
  return minutes >= 20 || workoutSetCount(w) >= 6;
}

/** Total XP needed to reach a level (level 1 = 0). About 2 months of steady training for level 10, 3 years for 50. */
export const xpForLevel = (level: number) => (level <= 1 ? 0 : Math.round(80 * Math.pow(level - 1, 1.83)));
export const MAX_LEVEL = 50;

export interface Rank {
  id: string;
  name: string;
  from: number;
  color: string;
}
/** A new rank every 10 levels, named after what a foundry turns metal into. */
export const RANKS: Rank[] = [
  { id: 'ore', name: tk('Ore'), from: 1, color: '#8a7a6a' },
  { id: 'iron', name: tk('Cast iron'), from: 10, color: '#9aa3ad' },
  { id: 'steel', name: tk('Steel'), from: 20, color: '#6fa8dc' },
  { id: 'tempered', name: tk('Tempered steel'), from: 30, color: '#4fc3a1' },
  { id: 'damascus', name: tk('Damascus'), from: 40, color: '#c792ea' },
  { id: 'titanium', name: tk('Titanium'), from: 50, color: '#f2c94c' },
];
export const rankOf = (level: number) => [...RANKS].reverse().find((r) => level >= r.from)!;

export interface BadgeDef {
  id: string;
  name: string;
  text: string;
  group: 'training' | 'streak' | 'strength' | 'nutrition' | 'gear' | 'challenge';
}
export const BADGES: BadgeDef[] = [
  { id: 'w1', group: 'training', name: tk('First step'), text: tk('Finish your first workout.') },
  { id: 'w10', group: 'training', name: tk('Regular'), text: tk('Finish 10 workouts.') },
  { id: 'w100', group: 'training', name: tk('Centurion'), text: tk('Finish 100 workouts.') },
  { id: 'w500', group: 'training', name: tk('Iron will'), text: tk('Finish 500 workouts.') },
  { id: 't100', group: 'training', name: tk('100 tonnes'), text: tk('Lift 100 tonnes in total.') },
  { id: 't1000', group: 'training', name: tk('1,000 tonnes'), text: tk('Lift 1,000 tonnes in total.') },
  { id: 'pr1', group: 'strength', name: tk('First record'), text: tk('Beat one of your records.') },
  { id: 'pr50', group: 'strength', name: tk('Record breaker'), text: tk('Beat 50 records.') },
  { id: 'bench1', group: 'strength', name: tk('Bodyweight bench'), text: tk('Bench press your body weight (estimated 1RM).') },
  { id: 'squat15', group: 'strength', name: tk('Squat × 1.5'), text: tk('Squat 1.5 times your body weight (estimated 1RM).') },
  { id: 'dead2', group: 'strength', name: tk('Deadlift × 2'), text: tk('Deadlift twice your body weight (estimated 1RM).') },
  { id: 's4', group: 'streak', name: tk('One month strong'), text: tk('Train 4 weeks in a row.') },
  { id: 's12', group: 'streak', name: tk('Quarter'), text: tk('Train 12 weeks in a row.') },
  { id: 's26', group: 'streak', name: tk('Half a year'), text: tk('Train 26 weeks in a row.') },
  { id: 's52', group: 'streak', name: tk('Full year'), text: tk('Train 52 weeks in a row.') },
  { id: 'd7', group: 'nutrition', name: tk('On target'), text: tk('7 days within your nutrition targets.') },
  { id: 'd30', group: 'nutrition', name: tk('Dialled in'), text: tk('30 days within your nutrition targets.') },
  { id: 'c1', group: 'challenge', name: tk('Challenger'), text: tk('Complete a monthly challenge.') },
  { id: 'c10', group: 'challenge', name: tk('Ten challenges'), text: tk('Complete 10 monthly challenges.') },
  { id: 'c3', group: 'challenge', name: tk('Clean sweep'), text: tk('Complete all three challenges of a month.') },
  { id: 'g1', group: 'gear', name: tk('Kitted out'), text: tk('Add your first piece of gear.') },
  { id: 'gfull', group: 'gear', name: tk('Full kit'), text: tk('Fill all 13 gear slots.') },
];

export interface XpPart {
  id: 'workouts' | 'records' | 'weeks' | 'streak' | 'diet' | 'weighIns';
  label: string;
  xp: number;
  count: number;
}

export interface Progression {
  xp: number;
  level: number;
  rank: Rank;
  /** XP into the current level, and the size of that level. */
  intoLevel: number;
  levelSize: number;
  parts: XpPart[];
  badges: string[];
  bestStreak: number;
}

export function progression(state: State, now = Date.now()): Progression {
  const done = finished(state.workouts);
  // Workouts: at most 2 per day count.
  const perDay = new Map<string, number>();
  let workouts = 0;
  const counted: Workout[] = [];
  for (const w of done) {
    if (!countsForXp(w)) continue;
    const d = dayOf(w.startedAt);
    const k = perDay.get(d) ?? 0;
    if (k >= XP.workoutsPerDay) continue;
    perDay.set(d, k + 1);
    workouts++;
    counted.push(w);
  }
  // Records: at most 3 per workout.
  const prs = computePRs(state.workouts);
  let records = 0;
  let allRecords = 0;
  for (const w of done) {
    let n = 0;
    for (const we of w.exercises) for (const s of we.sets) if (prs.has(s.id)) n++;
    allRecords += n;
    if (counted.includes(w)) records += Math.min(n, XP.recordsPerWorkout);
  }
  // Weeks: goal met (own training-day goal, 3 by default) and weeks in a row.
  const goalDays = state.goals?.trainingDays ?? 3;
  let weeksMet = 0;
  let streakXp = 0;
  let streakWeeks = 0;
  let chain = 0;
  let bestStreak = 0;
  if (done.length) {
    const thisWeek = weekStart(now);
    for (let s = weekStart(done[0].startedAt); s <= thisWeek; s = nextWeek(s)) {
      const e = nextWeek(s);
      const days = new Set(done.filter((w) => w.startedAt >= s && w.startedAt < e).map((w) => dayOf(w.startedAt))).size;
      if (days > 0) {
        chain++;
        bestStreak = Math.max(bestStreak, chain);
        if (chain > 1) {
          streakXp += XP.streakStep * Math.min(chain - 1, XP.streakCap);
          streakWeeks++;
        }
      } else if (s < thisWeek) chain = 0;
      if (days >= goalDays) weeksMet++;
    }
  }
  // Nutrition: days within targets, and one weigh-in per week.
  const n = state.nutrition;
  const today = dayOf(now);
  const loggedDays = [...new Set(n.log.filter((e) => !e.planned && e.date <= today).map((e) => e.date))];
  const dietDays = loggedDays.filter((d) => dietOnTarget(n, d)).length;
  const weighWeeks = new Set(n.weights.map((w) => weekStart(new Date(w.date + 'T12:00').getTime()))).size;

  const parts: XpPart[] = [
    { id: 'workouts', label: tk('Workouts'), count: workouts, xp: workouts * XP.workout },
    { id: 'records', label: tk('Records'), count: records, xp: records * XP.record },
    { id: 'weeks', label: tk('Weeks on goal'), count: weeksMet, xp: weeksMet * XP.weekGoal },
    { id: 'streak', label: tk('Weeks in a row'), count: streakWeeks, xp: streakXp },
    { id: 'diet', label: tk('Days on nutrition target'), count: dietDays, xp: dietDays * XP.dietDay },
    { id: 'weighIns', label: tk('Weekly weigh-ins'), count: weighWeeks, xp: weighWeeks * XP.weighInWeek },
  ];
  const xp = parts.reduce((a, p) => a + p.xp, 0);
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const intoLevel = xp - xpForLevel(level);
  const levelSize = level >= MAX_LEVEL ? 1 : xpForLevel(level + 1) - xpForLevel(level);

  // Badges
  const b: string[] = [];
  const total = done.length;
  const tonnes = done.reduce((a, w) => a + workoutVolume(w), 0) / 1000;
  if (total >= 1) b.push('w1');
  if (total >= 10) b.push('w10');
  if (total >= 100) b.push('w100');
  if (total >= 500) b.push('w500');
  if (tonnes >= 100) b.push('t100');
  if (tonnes >= 1000) b.push('t1000');
  if (allRecords >= 1) b.push('pr1');
  if (allRecords >= 50) b.push('pr50');
  const bw = [...n.weights].sort((x, y) => x.date.localeCompare(y.date)).pop()?.kg;
  if (bw) {
    const best = (id: string) => {
      let m = 0;
      for (const w of done)
        for (const we of w.exercises)
          if (we.exerciseId === id) for (const s of we.sets) if (countsForStats(s) && s.weight && s.reps) m = Math.max(m, epley(s.weight, s.reps));
      return m;
    };
    if (best('bench_bb') >= bw) b.push('bench1');
    if (best('squat_bb') >= bw * 1.5) b.push('squat15');
    if (best('deadlift_bb') >= bw * 2) b.push('dead2');
  }
  for (const [w, id] of [
    [4, 's4'],
    [12, 's12'],
    [26, 's26'],
    [52, 's52'],
  ] as const)
    if (bestStreak >= w) b.push(id);
  if (dietDays >= 7) b.push('d7');
  if (dietDays >= 30) b.push('d30');
  const ch = completedChallenges(state, now);
  if (ch.count >= 1) b.push('c1');
  if (ch.count >= 10) b.push('c10');
  if (ch.perfectMonths >= 1) b.push('c3');
  const g = gearCount(state.profile?.gear);
  if (g >= 1) b.push('g1');
  if (g >= GEAR_SLOTS.length) b.push('gfull');

  return { xp, level, rank: rankOf(level), intoLevel, levelSize, parts, badges: b, bestStreak };
}
