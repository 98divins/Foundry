import { describe, expect, it } from 'vitest';
import { splitState } from '../db';
import { defaultState } from '../store';
import type { State } from '../types';
import { applyRows, changedKeys, maxTime, rowsFor, rowsOf, stateFromRows, tombstoneKey, toRowKey } from './sync2';
import { collections } from './merge';

function sample(): State {
  const base = defaultState();
  return {
    ...base,
    workouts: [{ id: 'w1', name: 'A', startedAt: 10, endedAt: 15, exercises: [] }],
    routines: [
      { id: 'r2', name: 'B', exercises: [], updatedAt: 1 },
      { id: 'r1', name: 'A', exercises: [], updatedAt: 1 },
    ],
    settings: { ...base.settings, unit: 'lb' },
    deleted: { 'w:old': 5 },
    nutrition: { ...base.nutrition, weights: [{ date: '2026-11-01', kg: 80 }], rateKgPerWeek: -0.25 },
  } as State;
}

describe('sync v2', () => {
  it('names rows like local keys; v1 tombstones stay on the device', () => {
    expect(toRowKey('workout|w1')).toEqual({ kind: 'workout', id: 'w1' });
    expect(toRowKey('state:settings')).toEqual({ kind: 'doc', id: 'state:settings' });
    expect(toRowKey('state:deleted')).toBeNull();
  });

  it('a new device rebuilds exactly the same state from the rows', () => {
    const s = sample();
    const rows = rowsOf(splitState(s));
    expect(rows.some((r) => r.id === 'state:deleted')).toBe(false);
    const back = stateFromRows(rows, defaultState());
    expect(back.workouts).toEqual(s.workouts);
    expect(back.routines.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(back.settings).toEqual(s.settings);
    expect(back.nutrition.weights).toEqual(s.nutrition.weights);
    expect(back.nutrition.rateKgPerWeek).toBe(-0.25);
  });

  it('a change sends only the rows it touched, deletions as markers', () => {
    const s = sample();
    const next: State = { ...s, workouts: [], nutrition: { ...s.nutrition, weights: [...s.nutrition.weights, { date: '2026-11-02', kg: 79.5 }] } };
    const keys = changedKeys(splitState(s), splitState(next));
    expect(keys.sort()).toEqual(['weight|2026-11-02', 'workout|w1']);
    const rows = rowsFor(keys, splitState(next));
    expect(rows.find((r) => r.id === 'w1')).toEqual({ kind: 'workout', id: 'w1', data: null, deleted: true });
    expect(rows.find((r) => r.id === '2026-11-02')?.data).toEqual({ date: '2026-11-02', kg: 79.5 });
    expect(JSON.stringify(rows).length).toBeLessThan(10_000);
  });

  it('applies rows from another device, keeps changes still waiting to be sent', () => {
    const s = sample();
    const rows = [
      { kind: 'workout', id: 'w2', data: { id: 'w2', name: 'B', startedAt: 20, endedAt: 25, exercises: [] }, updated_at: '2026-11-17T10:00:00Z' },
      { kind: 'workout', id: 'w1', data: null, deleted: true, updated_at: '2026-11-17T10:00:01Z' },
      { kind: 'doc', id: 'state:settings', data: { ...s.settings, unit: 'kg' }, updated_at: '2026-11-17T10:00:02Z' },
    ];
    const next = applyRows(s, rows, new Set(['state:settings']), defaultState())!;
    expect(next.workouts.map((w) => w.id)).toEqual(['w2']);
    expect(next.settings.unit).toBe('lb'); // local change not sent yet: kept
    expect(applyRows(next, rows.slice(0, 1), new Set(), defaultState())).toBeNull(); // already there
    expect(maxTime(rows, null)).toBe('2026-11-17T10:00:02Z');
  });

  it('uses the same deletion names as v1 for every kind of item', () => {
    const s = { ...sample(), folders: [{ id: 'f1', name: 'F' }], nutrition: { ...sample().nutrition, favorites: ['a'], incompleteDays: ['2026-11-01'], checkIns: [{ date: '2026-11-01' } as never] } } as State;
    const v1 = new Set(Object.values(collections(s)).flat().map((x) => x.key));
    for (const k of splitState(s).items.keys()) expect(v1.has(tombstoneKey(k))).toBe(true);
  });
});
