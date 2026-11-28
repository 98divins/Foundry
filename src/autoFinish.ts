import type { State, Workout } from './types';

/** All sets ticked and nothing new for this long: the workout is over. */
export const IDLE_ALL_DONE_MS = 30 * 60000;
/** Nothing new for this long: the timer was left running. */
export const IDLE_MAX_MS = 4 * 3600000;

/** Last sign of activity: the latest ticked set, or the start. */
export function lastActivity(w: Workout): number {
  let last = w.startedAt;
  for (const we of w.exercises) for (const s of we.sets) if (s.done && s.doneAt && s.doneAt > last) last = s.doneAt;
  return last;
}

/** When a forgotten live workout should be closed (its last activity), or null to leave it running. */
export function autoFinishAt(w: Workout, now: number): number | null {
  const sets = w.exercises.flatMap((we) => we.sets);
  const last = lastActivity(w);
  // Only trust the 30-minute rule when every set carries its tick time.
  const allDone = sets.length > 0 && sets.every((s) => s.done && s.doneAt);
  if (allDone && now - last > IDLE_ALL_DONE_MS) return last;
  if (now - last > IDLE_MAX_MS) return last;
  return null;
}

/**
 * Closes a forgotten live workout at its last activity, keeping ticked sets only.
 * A workout with nothing ticked is dropped. Returns the state unchanged when nothing is due.
 */
export function autoFinish(s: State, now: number): State {
  const w = s.active;
  if (!w) return s;
  const end = autoFinishAt(w, now);
  if (end == null) return s;
  const exercises = w.exercises.map((we) => ({ ...we, sets: we.sets.filter((x) => x.done) })).filter((we) => we.sets.length);
  if (!exercises.length) return { ...s, active: null, rest: null };
  // Pauses taken before the end are left out, as when finishing by hand.
  const endedAt = Math.max(w.startedAt + 60000, end - (w.pausedMs ?? 0));
  const done: Workout = {
    ...w,
    exercises,
    endedAt,
    hideFromFeed: s.settings.postWorkouts === false || undefined,
    pausedAt: null,
    pausedMs: 0,
  };
  return { ...s, active: null, rest: null, workouts: [...s.workouts, done] };
}
