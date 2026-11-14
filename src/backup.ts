import type { State } from './types';
import { download } from './utils';

const DAY = 86400000;

/** Saves the whole state as a JSON file and records when, for the backup reminder. */
export function saveBackup(state: State, update: (fn: (s: State) => State) => void) {
  const now = Date.now();
  const stamp = new Date(now).toISOString().slice(0, 10);
  download(`foundry-backup-${stamp}.json`, JSON.stringify({ ...state, settings: { ...state.settings, lastBackupAt: now } }), 'application/json');
  update((s) => ({ ...s, settings: { ...s.settings, lastBackupAt: now } }));
}

/** A reminder is due when there was never a backup, or the last one is over a week old. */
export const backupDue = (state: State, now = Date.now()) =>
  !state.settings.lastBackupAt || now - state.settings.lastBackupAt > 7 * DAY;

export function fmtBackupAge(state: State, now = Date.now()): string {
  const t = state.settings.lastBackupAt;
  if (!t) return 'never';
  const days = Math.floor((now - t) / DAY);
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}
