/**
 * Automatic merge of two copies of the user's data (this device and the account), so the app never
 * asks "which version do you keep?". Lists are merged item by item; deletions travel as tombstones
 * (`state.deleted`), recorded by the store whenever an item disappears, so a deleted workout does
 * not come back from the other copy. For the same item changed on both sides, the more recent copy
 * wins (its own updatedAt when it has one, otherwise the side changed last).
 */
import type { State } from '../types';

/** Tombstones older than this are dropped: every device will have synced long before. */
const KEEP_TOMBSTONES_MS = 180 * 86400000;

type Keyed = { key: string; value: unknown; updatedAt?: number };

/** Every list the merge knows, with how to name its items. Shared with the store's tombstone recorder. */
export function collections(s: State): Record<string, Keyed[]> {
  const n = s.nutrition;
  const byId = <T extends { id: string; updatedAt?: number }>(prefix: string, xs: T[] | undefined) =>
    (xs ?? []).map((x) => ({ key: `${prefix}:${x.id}`, value: x as unknown, updatedAt: x.updatedAt }));
  return {
    workouts: byId('w', s.workouts),
    routines: byId('r', s.routines),
    folders: byId('f', s.folders),
    customExercises: byId('x', s.customExercises),
    foods: byId('food', n?.foods),
    log: byId('log', n?.log),
    savedMeals: byId('meal', n?.savedMeals),
    weights: (n?.weights ?? []).map((w) => ({ key: `kg:${w.date}`, value: w as unknown })),
    checkIns: (n?.checkIns ?? []).map((c) => ({ key: `ci:${c.date}`, value: c as unknown })),
    favorites: (n?.favorites ?? []).map((id) => ({ key: `fav:${id}`, value: id as unknown })),
    incompleteDays: (n?.incompleteDays ?? []).map((d) => ({ key: `inc:${d}`, value: d as unknown })),
  };
}

/**
 * Tombstones: key → time. Positive = deleted at that time; negative = added back at that time
 * (an item can come back, e.g. a food starred again). The entry with the larger absolute time wins.
 */
export type Tombstones = Record<string, number>;

/** Records what disappeared (or came back) between two states. */
export function recordDeletions(prev: State, next: State, now = Date.now()): Tombstones | undefined {
  const before = collections(prev);
  const after = collections(next);
  let deleted: Tombstones | undefined = next.deleted;
  for (const name of Object.keys(before)) {
    const was = new Set(before[name].map((x) => x.key));
    const is = new Set(after[name].map((x) => x.key));
    for (const k of was) if (!is.has(k)) (deleted = { ...(deleted ?? {}) })[k] = now;
    for (const k of is) if (!was.has(k) && (deleted?.[k] ?? 0) > 0) (deleted = { ...(deleted ?? {}) })[k] = -now;
  }
  return deleted;
}

function mergeTombstones(a: Tombstones = {}, b: Tombstones = {}, now: number): Tombstones {
  const out: Tombstones = {};
  for (const [k, v] of [...Object.entries(a), ...Object.entries(b)]) {
    if (out[k] === undefined || Math.abs(v) > Math.abs(out[k])) out[k] = v;
  }
  for (const [k, v] of Object.entries(out)) if (now - Math.abs(v) > KEEP_TOMBSTONES_MS) delete out[k];
  return out;
}

function mergeList<T>(local: Keyed[], remote: Keyed[], dead: Tombstones, localNewer: boolean): T[] {
  const out = new Map<string, Keyed>();
  for (const x of local) out.set(x.key, x);
  for (const r of remote) {
    const l = out.get(r.key);
    if (!l) out.set(r.key, r);
    else if (l.updatedAt != null && r.updatedAt != null && l.updatedAt !== r.updatedAt) out.set(r.key, r.updatedAt > l.updatedAt ? r : l);
    else if (!localNewer) out.set(r.key, r);
  }
  return [...out.values()].filter((x) => !((dead[x.key] ?? 0) > 0)).map((x) => x.value as T);
}

/**
 * One state holding everything from both copies.
 * `localNewer`: this device changed things after the account copy was written (decides settings,
 * profile, plan and same-item edits without their own timestamp).
 */
export function mergeStates(local: State, remote: State, localNewer: boolean, now = Date.now()): State {
  const dead = mergeTombstones(local.deleted, remote.deleted, now);
  const L = collections(local);
  const R = collections(remote);
  const m = <T>(name: string) => mergeList<T>(L[name], R[name], dead, localNewer);
  const newer = localNewer ? local : remote;
  const workouts = m<State['workouts'][number]>('workouts').sort((a, b) => a.startedAt - b.startedAt);
  // A workout in progress that the other copy already finished is not resumed.
  const active = newer.active && !workouts.some((w) => w.id === newer.active!.id) ? newer.active : null;
  return {
    ...newer,
    workouts,
    routines: m('routines'),
    folders: m('folders'),
    customExercises: m('customExercises'),
    active,
    rest: active ? newer.rest : null,
    settings: { ...remote.settings, ...local.settings, ...newer.settings },
    profile: newer.profile ?? local.profile ?? remote.profile,
    nutrition: {
      ...newer.nutrition,
      foods: m('foods'),
      log: m('log'),
      savedMeals: m('savedMeals'),
      weights: m<State['nutrition']['weights'][number]>('weights').sort((a, b) => a.date.localeCompare(b.date)),
      checkIns: m<State['nutrition']['checkIns'][number]>('checkIns').sort((a, b) => a.date.localeCompare(b.date)),
      favorites: m('favorites'),
      incompleteDays: m('incompleteDays'),
    },
    deleted: dead,
  };
}
