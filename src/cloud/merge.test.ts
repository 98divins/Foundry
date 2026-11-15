import { describe, expect, it } from 'vitest';
import { defaultState } from '../store';
import type { State, Workout } from '../types';
import { mergeStates, recordDeletions } from './merge';

const w = (id: string, startedAt: number, name = 'W'): Workout => ({ id, name, startedAt, endedAt: startedAt + 1, exercises: [] });
const base = (): State => ({ ...defaultState(), workouts: [w('a', 1), w('b', 2)] });

describe('automatic merge', () => {
  it('keeps workouts added on each device', () => {
    const phone = { ...base(), workouts: [...base().workouts, w('p', 3)] };
    const ipad = { ...base(), workouts: [...base().workouts, w('i', 4)] };
    expect(mergeStates(phone, ipad, true).workouts.map((x) => x.id)).toEqual(['a', 'b', 'p', 'i']);
  });

  it('a deletion on one device wins over the untouched copy on the other', () => {
    const before = base();
    const after = { ...before, workouts: before.workouts.filter((x) => x.id !== 'a') };
    const phone = { ...after, deleted: recordDeletions(before, after, 1000) };
    const cloud = base();
    const merged = mergeStates(phone, cloud, true, 2000);
    expect(merged.workouts.map((x) => x.id)).toEqual(['b']);
    // and stays deleted when the other device merges in turn
    expect(mergeStates(cloud, merged, false, 3000).workouts.map((x) => x.id)).toEqual(['b']);
  });

  it('the newer side wins for the same item and for settings', () => {
    const phone = { ...base(), workouts: [w('a', 1, 'Renamed'), w('b', 2)], settings: { ...base().settings, unit: 'lb' as const } };
    const cloud = base();
    const m = mergeStates(phone, cloud, true);
    expect(m.workouts[0].name).toBe('Renamed');
    expect(m.settings.unit).toBe('lb');
    expect(mergeStates(phone, cloud, false).workouts[0].name).toBe('W');
  });

  it('uses each routine’s own updatedAt when both sides edited it', () => {
    const r = { id: 'r', name: 'Push', exercises: [], updatedAt: 5 };
    const phone = { ...base(), routines: [{ ...r, name: 'Push A', updatedAt: 9 }] };
    const cloud = { ...base(), routines: [{ ...r, name: 'Push B', updatedAt: 7 }] };
    expect(mergeStates(phone, cloud, false).routines[0].name).toBe('Push A');
  });

  it('merges food logs and weigh-ins from both devices', () => {
    const entry = (id: string) => ({ id, date: '2026-11-15', meal: 'lunch' as const, name: id, grams: 100, kcal: 100, protein: 1, carbs: 1, fat: 1, createdAt: 1 });
    const phone = { ...base(), nutrition: { ...base().nutrition, log: [entry('x')], weights: [{ date: '2026-11-14', kg: 80 }] } };
    const cloud = { ...base(), nutrition: { ...base().nutrition, log: [entry('y')], weights: [{ date: '2026-11-15', kg: 79.8 }] } };
    const m = mergeStates(phone, cloud, true);
    expect(m.nutrition.log.map((e) => e.id).sort()).toEqual(['x', 'y']);
    expect(m.nutrition.weights.map((x) => x.date)).toEqual(['2026-11-14', '2026-11-15']);
  });

  it('an item added back after a deletion stays', () => {
    const s0 = { ...base(), nutrition: { ...base().nutrition, favorites: ['f1'] } };
    const s1 = { ...s0, nutrition: { ...s0.nutrition, favorites: [] } };
    const d1 = { ...s1, deleted: recordDeletions(s0, s1, 1000) };
    const s2 = { ...d1, nutrition: { ...d1.nutrition, favorites: ['f1'] } };
    const d2 = { ...s2, deleted: recordDeletions(d1, s2, 2000) };
    expect(mergeStates(d2, d1, true, 3000).nutrition.favorites).toEqual(['f1']);
  });

  it('does not resume a workout the other device already finished', () => {
    const live = { ...w('z', 9), endedAt: null };
    const phone = { ...base(), active: live };
    const cloud = { ...base(), workouts: [...base().workouts, w('z', 9)] };
    expect(mergeStates(phone, cloud, true).active).toBeNull();
  });
});
