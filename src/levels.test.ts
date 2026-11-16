import { describe, expect, it } from 'vitest';
import { defaultState } from './store';
import type { State, Workout } from './types';
import { progression, rankOf, xpForLevel } from './levels';
import { weekStart } from './utils';

const H = 3600000;
const D = 24 * H;
let n = 0;
const set = (weight: number, reps: number) => ({ id: 's' + n++, type: 'normal' as const, weight, reps, done: true });
const w = (startedAt: number, minutes = 60, weight = 80): Workout => ({
  id: 'w' + n++,
  name: 'W',
  startedAt,
  endedAt: startedAt + minutes * 60000,
  exercises: [{ id: 'e' + n++, exerciseId: 'bench_bb', restSec: 90, sets: [set(weight, 5), set(weight, 5)] }],
});

describe('levels', () => {
  const now = weekStart(Date.now()) + 3 * D + 12 * H;
  it('starts at level 1 with no history', () => {
    const p = progression(defaultState(), now);
    expect(p).toMatchObject({ xp: 0, level: 1, badges: [] });
    expect(p.rank.id).toBe('ore');
  });

  it('counts real workouts, at most 2 a day, and weeks in a row', () => {
    const start = weekStart(now) - 3 * 7 * D + 10 * H;
    const ws: Workout[] = [];
    for (let k = 0; k < 4; k++) for (const d of [0, 2, 4]) ws.push(w(start + k * 7 * D + d * D));
    ws.push(w(start + 5 * H), w(start + 6 * H)); // 3rd and 4th workout that day: ignored
    ws.push(w(start + D, 5)); // 5 minutes, 2 sets: not a workout for XP
    const p = progression({ ...defaultState(), workouts: ws } as State, now);
    const part = (id: string) => p.parts.find((x) => x.id === id)!;
    expect(part('workouts').count).toBe(13);
    expect(part('weeks').count).toBe(4);
    expect(p.bestStreak).toBe(4);
    expect(p.badges).toContain('w10');
    expect(p.badges).toContain('s4');
    expect(p.level).toBeGreaterThan(5);
  });

  it('rewards consistency, not load', () => {
    const t = weekStart(now) + 10 * H;
    const light = progression({ ...defaultState(), workouts: [w(t, 60, 20)] } as State, now);
    const heavy = progression({ ...defaultState(), workouts: [w(t, 60, 200)] } as State, now);
    expect(light.xp).toBe(heavy.xp);
  });

  it('has a curve that slows down and a rank every 10 levels', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(11) - xpForLevel(10)).toBeGreaterThan(xpForLevel(3) - xpForLevel(2));
    expect(rankOf(9).id).toBe('ore');
    expect(rankOf(10).id).toBe('iron');
    expect(rankOf(50).id).toBe('titanium');
  });
});
