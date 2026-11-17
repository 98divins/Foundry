import { describe, expect, it } from 'vitest';
import { diffState, joinState, splitState } from './db';
import { defaultState } from './store';
import type { State } from './types';

function sample(): State {
  const base = defaultState();
  return {
    ...base,
    workouts: [
      { id: 'w2', name: 'B', startedAt: 20, endedAt: 30, exercises: [] },
      { id: 'w1', name: 'A', startedAt: 10, endedAt: 15, exercises: [] },
    ],
    routines: [
      { id: 'r2', name: 'Second', exercises: [], updatedAt: 1 },
      { id: 'r1', name: 'First', exercises: [], updatedAt: 1 },
    ],
    folders: [{ id: 'f1', name: 'Folder' }],
    settings: { ...base.settings, unit: 'lb', shareStats: false },
    profile: { name: 'Alex', bio: '' },
    goals: { trainingDays: 3, dietDays: null, setAt: 5 } as never,
    deleted: { 'w:old': 99 },
    nutrition: {
      ...base.nutrition,
      rateKgPerWeek: -0.25,
      foods: [{ id: 'c1', name: 'Sauce', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 }, source: 'custom' }],
      log: [
        { id: 'l2', date: '2026-11-02', meal: 'lunch', name: 'x', grams: 1, kcal: 1, protein: 0, carbs: 0, fat: 0, createdAt: 2 },
        { id: 'l1', date: '2026-11-01', meal: 'lunch', name: 'y', grams: 1, kcal: 1, protein: 0, carbs: 0, fat: 0, createdAt: 1 },
      ],
      weights: [{ date: '2026-11-02', kg: 80 }, { date: '2026-11-01', kg: 81 }],
      favorites: ['b', 'a'],
      incompleteDays: ['2026-11-02'],
    },
  } as State;
}

describe('local storage split (IndexedDB)', () => {
  it('splits and rebuilds the state without losing anything', () => {
    const s = sample();
    const sp = splitState(s);
    const back = joinState(sp.items, sp.docs, defaultState());
    // Lists the app keeps sorted come back sorted; lists in the person's order keep that order.
    expect(back.workouts.map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(back.routines.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(back.nutrition.favorites).toEqual(['b', 'a']);
    expect(back.nutrition.log.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(back.nutrition.weights.map((w) => w.date)).toEqual(['2026-11-01', '2026-11-02']);
    expect(back.settings).toEqual(s.settings);
    expect(back.profile).toEqual(s.profile);
    expect(back.goals).toEqual(s.goals);
    expect(back.deleted).toEqual(s.deleted);
    expect(back.nutrition.rateKgPerWeek).toBe(-0.25);
    expect(back.nutrition.foods).toEqual(s.nutrition.foods);
    expect(back.folders).toEqual(s.folders);
  });

  it('a change writes only what changed', () => {
    const s = sample();
    const before = splitState(s);
    // Tick a set: one workout changes, everything else keeps its reference.
    const next: State = { ...s, workouts: s.workouts.map((w) => (w.id === 'w1' ? { ...w, name: 'A2' } : w)) };
    const d = diffState(before, splitState(next));
    expect(d.put.map(([k]) => k)).toEqual(['workout|w1']);
    expect(d.del).toEqual([]);
    expect(d.docs).toEqual([]);
  });

  it('records deletions, reordering and settings changes', () => {
    const s = sample();
    const before = splitState(s);
    const next: State = {
      ...s,
      routines: [s.routines[1], s.routines[0]],
      nutrition: { ...s.nutrition, log: s.nutrition.log.filter((l) => l.id !== 'l1') },
      settings: { ...s.settings, unit: 'kg' },
    };
    const d = diffState(before, splitState(next));
    expect(d.put).toEqual([]);
    expect(d.del).toEqual(['log|l1']);
    expect(d.docs.map(([k]) => k).sort()).toEqual(['order:routine', 'state:settings']);
  });

  it('an unchanged state writes nothing', () => {
    const s = sample();
    const d = diffState(splitState(s), splitState({ ...s }));
    expect(d.put.length + d.del.length + d.docs.length).toBe(0);
  });
});

describe('monthly chunks', () => {
  it('puts dated items in their month, the rest in one chunk per kind', async () => {
    const { chunkOf } = await import('./db');
    expect(chunkOf('workout|w1', { startedAt: Date.UTC(2026, 10, 17) })).toBe('workout@2026-11');
    expect(chunkOf('log|l1', { date: '2026-02-03' })).toBe('log@2026-02');
    expect(chunkOf('weight|2026-03-01', { date: '2026-03-01' })).toBe('weight@2026-03');
    expect(chunkOf('routine|r1', { id: 'r1' })).toBe('routine@all');
    expect(chunkOf('favorite|abc', 'abc')).toBe('favorite@all');
  });
});

describe('diff by changed lists', () => {
  it('finds the same changes as the full comparison, touching only changed lists', async () => {
    const { diffStates } = await import('./db');
    const s = sample();
    const next: State = {
      ...s,
      workouts: s.workouts.map((w) => (w.id === 'w1' ? { ...w, name: 'A2' } : w)),
      routines: [s.routines[1], s.routines[0]],
      nutrition: { ...s.nutrition, log: s.nutrition.log.filter((l) => l.id !== 'l1') },
      settings: { ...s.settings, unit: 'kg' },
    };
    const d = diffStates(s, next);
    expect(d.put.map(([k]) => k)).toEqual(['workout|w1']);
    expect(d.del).toEqual(['log|l1']);
    expect(d.docs.map(([k]) => k).sort()).toEqual(['order:routine', 'state:settings']);
    const none = diffStates(s, { ...s });
    expect(none.put.length + none.del.length + none.docs.length).toBe(0);
  });
});
