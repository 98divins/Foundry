import { describe, expect, it } from 'vitest';
import { feedChanges } from './feedPosts';
import type { Workout } from './types';

const H = 3600000;
const w = (id: string, at: number, extra: Partial<Workout> = {}): Workout => ({
  id,
  name: id,
  startedAt: at,
  endedAt: at + H,
  exercises: [
    {
      id: 'e' + id,
      exerciseId: 'bench_bb',
      restSec: 90,
      sets: Array.from({ length: 6 }, (_, k) => ({ id: id + k, type: 'normal' as const, weight: 50, reps: 5, done: true })),
    },
  ],
  ...extra,
});

describe('activity feed posts', () => {
  const now = Date.now();
  it('posts finished workouts once, unless the person chose to keep them out', () => {
    const r = feedChanges([w('a', now - H), w('b', now - H, { hideFromFeed: true }), w('c', now - 2 * H)], ['c'], now - 7 * 24 * H);
    expect(r.post.map((x) => x.id)).toEqual(['a']);
    expect(r.remove).toEqual([]);
  });
  it('takes a post down when the workout is hidden afterwards or deleted', () => {
    const r = feedChanges([w('a', now - H, { hideFromFeed: true })], ['a', 'gone'], now - 7 * 24 * H);
    expect(r.remove.sort()).toEqual(['a', 'gone']);
    expect(r.post).toEqual([]);
  });
});
