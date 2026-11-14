import type { State } from './types';
import { download } from './utils';
import { t } from './i18n';

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
  const last = state.settings.lastBackupAt;
  if (!last) return t('never');
  const days = Math.floor((now - last) / DAY);
  return days === 0 ? t('today') : days === 1 ? t('yesterday') : t('{n} days ago', { n: days });
}
