/** Which workouts to post to the friends' feed, and which posts to take down. */
import { countsForXp } from './levels';
import type { Workout } from './types';
import { finished } from './utils';

export function feedChanges(workouts: Workout[], posted: string[], since: number): { post: Workout[]; remove: string[] } {
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const post = finished(workouts).filter((w) => w.startedAt >= since && countsForXp(w) && !w.hideFromFeed && !posted.includes(w.id));
  // Deleted since, or hidden by the person: take the post down.
  const remove = posted.filter((id) => !byId.has(id) || byId.get(id)!.hideFromFeed);
  return { post, remove };
}
