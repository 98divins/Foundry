import { describe, expect, it } from 'vitest';
import { defaultLoads, LIBRARY } from './exercises';
import { computePRs, epley, exerciseVolume, registerKinds, registerLoads } from './utils';
import type { WorkoutExercise } from './types';

const byId = new Map(LIBRARY.map((e) => [e.id, e]));
registerKinds((id) => byId.get(id)?.kind ?? 'weight');

describe('one or two dumbbells', () => {
  it('two-dumbbell moves count twice by default; one-dumbbell moves and barbells once', () => {
    expect(defaultLoads(byId.get('seated_incline_curl_dumbbell') ?? LIBRARY.find((e) => e.name === 'Seated Incline Curl (Dumbbell)')!)).toBe(2);
    expect(defaultLoads(byId.get('goblet_squat')!)).toBe(1);
    expect(defaultLoads(byId.get('row_db')!)).toBe(1);
    expect(defaultLoads(byId.get('bench_bb')!)).toBe(1);
  });

  it('volume counts every dumbbell; the person can change it per exercise; records stay per dumbbell', () => {
    const curl = LIBRARY.find((e) => e.name === 'Seated Incline Curl (Dumbbell)')!;
    const we: WorkoutExercise = { id: 'x', exerciseId: curl.id, restSec: 60, sets: [{ id: 's', type: 'normal', weight: 12, reps: 12, done: true }] };
    const overrides: Record<string, 1 | 2> = {};
    registerLoads((id) => overrides[id] ?? defaultLoads(byId.get(id)!));
    expect(exerciseVolume(we)).toBe(288); // 12 kg × 2 × 12
    overrides[curl.id] = 1;
    expect(exerciseVolume(we)).toBe(144);
    const w = { id: 'w', name: 'W', startedAt: 1, endedAt: 2, exercises: [we] };
    expect(computePRs([w]).size).toBeGreaterThanOrEqual(0);
    expect(epley(12, 12)).toBeLessThan(24); // 1RM is estimated from one dumbbell
  });
});
