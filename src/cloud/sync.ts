import type { State } from '../types';

/** What this device knows about its last sync, kept beside the app data. */
export interface SyncMeta {
  userId: string | null;
  /** updated_at of the cloud copy this device last read or wrote. */
  remoteUpdatedAt: string | null;
  /** Local changes not yet uploaded. */
  dirty: boolean;
  lastSyncAt: number | null;
  /** When this device last changed something (decides which side is newer in a merge). */
  lastChangeAt?: number | null;
  /** Sync v2 (docs/SYNC_V2.md): this account syncs item by item. */
  v2?: boolean;
  /** v2: latest server time already received. */
  cursor?: string | null;
  /** v2: keys changed here and not yet sent (kept across restarts and offline periods). */
  outbox?: string[];
}

const KEY = 'foundry:sync';
export const emptyMeta = (): SyncMeta => ({ userId: null, remoteUpdatedAt: null, dirty: false, lastSyncAt: null });

export function loadMeta(): SyncMeta {
  try {
    return { ...emptyMeta(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return emptyMeta();
  }
}
export function saveMeta(m: SyncMeta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* sync still works for this session */
  }
}

/** Anything worth keeping: a user who only opened the app has nothing to protect. */
export function hasData(s: State): boolean {
  return (
    s.workouts.length > 0 ||
    s.routines.length > 0 ||
    s.customExercises.length > 0 ||
    s.nutrition.log.length > 0 ||
    s.nutrition.weights.length > 0 ||
    s.nutrition.savedMeals.length > 0 ||
    !!s.active
  );
}

export function summary(s: State) {
  return {
    workouts: s.workouts.filter((w) => w.endedAt).length,
    routines: s.routines.length,
    foods: s.nutrition.log.length,
    weighIns: s.nutrition.weights.length,
  };
}

/** Same instant? The app writes "…Z", Postgres answers "…+00:00": compare times, not strings. */
export function sameTime(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  const x = Date.parse(a);
  const y = Date.parse(b);
  return Number.isNaN(x) || Number.isNaN(y) ? a === b : x === y;
}

export type SyncAction = 'upload' | 'download' | 'merge' | 'none';

/**
 * What to do right after signing in (the account already has a copy).
 * - This device has nothing, or holds data that is not this account's (another account, or data
 *   from before accounts existed): take the account copy. Data never moves from one account to another.
 * - Same account, nothing unsent: take the account copy if it changed.
 * - Same account, unsent changes and the account unchanged: send them.
 * - Same account, changes on both sides: merge both, never ask.
 */
export function loginAction(meta: SyncMeta, userId: string, local: State, remote: { updatedAt: string }): SyncAction {
  if (!hasData(local) || meta.userId !== userId) return 'download';
  const remoteChanged = !sameTime(remote.updatedAt, meta.remoteUpdatedAt);
  if (!meta.dirty) return remoteChanged ? 'download' : 'none';
  return remoteChanged ? 'merge' : 'upload';
}

/**
 * A new account (no copy in the cloud yet) signing in on a device that holds another account's data:
 * start empty instead of handing that data to the new account.
 */
export function belongsToOtherAccount(meta: SyncMeta, userId: string): boolean {
  return meta.userId != null && meta.userId !== userId;
}

/** After changes, when the app comes back to the foreground, or when the network returns. */
export function refreshAction(meta: SyncMeta, remoteUpdatedAt: string): SyncAction {
  const remoteChanged = !sameTime(remoteUpdatedAt, meta.remoteUpdatedAt);
  if (meta.dirty) return remoteChanged ? 'merge' : 'upload';
  return remoteChanged ? 'download' : 'none';
}
