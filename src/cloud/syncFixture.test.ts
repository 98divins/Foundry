/**
 * Keeps supabase/tests/sync_fixture.json in step with the app: rows produced by the v2 split of a
 * sample state, and the v1 state they must fold back into. The RLS bench checks that
 * admin.fold_items() gives exactly that state. Regenerate with: FIX=1 npx vitest run syncFixture
 */
import { describe, expect, it } from 'vitest';
import { splitState } from '../db';
import { defaultState } from '../store';
import type { State } from '../types';
import { rowsOf, stateFromRows } from './sync2';
import fixture from '../../supabase/tests/sync_fixture.json';

function sample(): State {
  const base = defaultState();
  const set = (id: string) => ({ id, type: 'normal' as const, weight: 60, reps: 8, done: true });
  return {
    ...base,
    workouts: [
      { id: 'w2', name: 'Pull', startedAt: 2000, endedAt: 3000, exercises: [{ id: 'e2', exerciseId: 'row_bb', restSec: 90, sets: [set('s3')] }] },
      { id: 'w1', name: 'Push', startedAt: 1000, endedAt: 1500, exercises: [{ id: 'e1', exerciseId: 'bench_bb', restSec: 90, sets: [set('s1'), set('s2')] }] },
    ],
    routines: [
      { id: 'r2', name: 'Pull', exercises: [], updatedAt: 1, folderId: 'f1' },
      { id: 'r1', name: 'Push', exercises: [], updatedAt: 1 },
    ],
    folders: [{ id: 'f1', name: 'PPL' }],
    customExercises: [{ id: 'c_1', name: 'Presse maison', muscle: 'quads', equipment: 'machine', kind: 'weight', custom: true }] as never,
    settings: { ...base.settings, unit: 'kg', shareStats: true },
    profile: { name: 'Alex', bio: 'hi' },
    goals: { trainingDays: 4, dietDays: 5, setAt: 9 } as never,
    nutrition: {
      ...base.nutrition,
      rateKgPerWeek: -0.25,
      foods: [
        { id: 'c-2', name: 'B', per100: { kcal: 2, protein: 0, carbs: 0, fat: 0 }, source: 'custom' },
        { id: 'c-1', name: 'A', per100: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, source: 'custom' },
      ],
      savedMeals: [{ id: 'm1', name: 'Bowl', items: [], updatedAt: 3 }],
      log: [
        { id: 'l2', date: '2026-11-02', meal: 'lunch', name: 'x', grams: 100, kcal: 100, protein: 1, carbs: 1, fat: 1, createdAt: 20 },
        { id: 'l1', date: '2026-11-01', meal: 'lunch', name: 'y', grams: 50, kcal: 50, protein: 1, carbs: 1, fat: 1, createdAt: 10 },
      ],
      weights: [
        { date: '2026-11-02', kg: 80 },
        { date: '2026-11-01', kg: 80.4 },
      ],
      checkIns: [{ date: '2026-11-01', targets: { kcal: 2400, protein: 160, carbs: 280, fat: 70 } } as never],
      favorites: ['c-2', 'c-1'],
      incompleteDays: ['2026-11-02', '2026-11-01'],
    },
  } as State;
}

describe('rollback fixture', () => {
  it('matches what the app produces today', async () => {
    const rows = rowsOf(splitState(sample()));
    const expected = JSON.parse(JSON.stringify(stateFromRows(rows, defaultState())));
    if (import.meta.env.FIX || (globalThis as { process?: { env: Record<string, string> } }).process?.env.FIX) {
      const fs = await import(/* @vite-ignore */ 'node:' + 'fs');
      fs.writeFileSync('supabase/tests/sync_fixture.json', JSON.stringify({ rows, expected }, null, 1) + '\n');
      return;
    }
    expect(JSON.parse(JSON.stringify({ rows, expected }))).toEqual(fixture);
  });
});
