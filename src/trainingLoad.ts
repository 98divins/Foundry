/**
 * Training load (stats): working sets, tonnage and time per week, and the acute:chronic ratio
 * (last 7 days against the weekly average of the last 28). The ratio is a rough guide, not a
 * prediction: it only flags sudden jumps compared with what the person usually does.
 */
import type { Workout } from './types';
import { countsForStats, finished, workoutElapsed, workoutVolume, weekStart } from './utils';

const DAY = 86400000;
const weekEnd = (start: number) => weekStart(start + 10.5 * DAY);

const setsOf = (w: Workout) => w.exercises.reduce((t, we) => t + we.sets.filter(countsForStats).length, 0);
const minutesOf = (w: Workout) => Math.round(workoutElapsed(w, w.endedAt ?? w.startedAt) / 60000);
/** Session effort: average RPE of rated sets × minutes (only when sets were rated). */
function sessionRpe(w: Workout): number | null {
  const r = w.exercises.flatMap((we) => we.sets.filter((s) => countsForStats(s) && s.rpe)).map((s) => s.rpe!);
  return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * minutesOf(w)) : null;
}

export interface LoadWeek {
  start: number;
  sets: number;
  tonnage: number;
  minutes: number;
  /** Sum of session RPE × minutes, when sets were rated. */
  effort: number | null;
}

export function weeklyLoad(workouts: Workout[], starts: number[]): LoadWeek[] {
  const done = finished(workouts);
  return starts.map((start) => {
    const end = weekEnd(start);
    const ws = done.filter((w) => w.startedAt >= start && w.startedAt < end);
    const efforts = ws.map(sessionRpe).filter((x): x is number => x != null);
    return {
      start,
      sets: ws.reduce((t, w) => t + setsOf(w), 0),
      tonnage: Math.round(ws.reduce((t, w) => t + workoutVolume(w), 0)),
      minutes: ws.reduce((t, w) => t + minutesOf(w), 0),
      effort: efforts.length ? efforts.reduce((a, b) => a + b, 0) : null,
    };
  });
}

export type LoadZone = 'low' | 'steady' | 'jump';

export interface LoadRatio {
  acute: number;
  /** Average sets per week over the last 28 days. */
  chronic: number;
  ratio: number;
  zone: LoadZone;
}

/**
 * Working sets in the last 7 days against the weekly average of the last 28 days. Needs training
 * on at least 3 of the 4 weeks before (otherwise there is no "usual" to compare with).
 */
export function loadRatio(workouts: Workout[], now = Date.now()): LoadRatio | null {
  const done = finished(workouts).filter((w) => w.startedAt > now - 28 * DAY && w.startedAt <= now);
  const weeksTrained = new Set(done.map((w) => Math.floor((now - w.startedAt) / (7 * DAY)))).size;
  if (weeksTrained < 3) return null;
  const chronicTotal = done.reduce((t, w) => t + setsOf(w), 0);
  const chronic = chronicTotal / 4;
  if (!chronic) return null;
  const acute = done.filter((w) => w.startedAt > now - 7 * DAY).reduce((t, w) => t + setsOf(w), 0);
  const ratio = Math.round((acute / chronic) * 100) / 100;
  return { acute, chronic: Math.round(chronic * 10) / 10, ratio, zone: ratio > 1.3 ? 'jump' : ratio < 0.8 ? 'low' : 'steady' };
}
