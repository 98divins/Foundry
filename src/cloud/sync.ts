import type { State } from '../types';

/** What this device knows about its last sync, kept beside the app data. */
export interface SyncMeta {
  userId: string | null;
  /** updated_at of the cloud copy this device last read or wrote. */
  remoteUpdatedAt: string | null;
  /** Local changes not yet uploaded. */
  dirty: boolean;
  lastSyncAt: number | null;
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

export type LoginAction = 'upload' | 'download' | 'ask' | 'none';

/**
 * What to do right after signing in.
 * - No cloud copy yet: upload this device's data.
 * - This device has nothing, or it was last synced with this account and has no unsent change: take the cloud copy.
 * - Same account, local changes, cloud unchanged since: upload them.
 * - Otherwise both sides may hold something the other lacks: ask.
 */
export function loginAction(
  meta: SyncMeta,
  userId: string,
  local: State,
  remote: { updatedAt: string } | null,
): LoginAction {
  if (!remote) return hasData(local) ? 'upload' : 'none';
  if (!hasData(local)) return 'download';
  if (meta.userId === userId) {
    const remoteChanged = remote.updatedAt !== meta.remoteUpdatedAt;
    if (!meta.dirty) return remoteChanged ? 'download' : 'none';
    return remoteChanged ? 'ask' : 'upload';
  }
  return 'ask';
}

/** When the app comes back to the foreground or the network returns. */
export function refreshAction(meta: SyncMeta, remoteUpdatedAt: string | null): 'upload' | 'download' | 'ask' | 'none' {
  const remoteChanged = !!remoteUpdatedAt && remoteUpdatedAt !== meta.remoteUpdatedAt;
  if (meta.dirty) return remoteChanged ? 'ask' : 'upload';
  return remoteChanged ? 'download' : 'none';
}
