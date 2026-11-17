import { useRef, useState } from 'react';
import { back } from '../hooks';
import { Confirm, Header, Icon } from '../components/ui';
import { exportWorkoutCsv, importWorkoutCsv } from '../csv';
import { defaultState, parseBackup, useStore } from '../store';
import { download } from '../utils';
import { fmtBackupAge, saveBackup } from '../backup';
import { exportSocialData } from '../cloud/social';
import { useCloud } from '../cloud/cloud';
import { downloadWorkbook } from '../export';
import { t, tp } from '../i18n';
import { requirePro } from '../pro';

/** Settings → Export & import data. */
export function DataPage() {
  const cloud = useCloud();
  const { state, update, exercises, exMap } = useStore();
  const { workouts } = state;
  const done = workouts.filter((w) => w.endedAt);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const say = (text: string, error = false) => setMsg({ text, error });
  const stamp = new Date().toISOString().slice(0, 10);

  const onCsv = async (file: File) => {
    try {
      const res = importWorkoutCsv(await file.text(), exercises, workouts, state.settings.unit);
      update((s) => ({
        ...s,
        workouts: [...s.workouts, ...res.workouts],
        customExercises: [...s.customExercises, ...res.newExercises],
      }));
      say(
        tp(res.workouts.length, 'Imported {n} workout', 'Imported {n} workouts') +
          (res.newExercises.length ? tp(res.newExercises.length, ', created {n} custom exercise', ', created {n} custom exercises') : '') +
          (res.skippedDuplicates ? t(', skipped {n} already in your history', { n: res.skippedDuplicates }) : '') +
          '.',
      );
    } catch (e) {
      say(e instanceof Error ? e.message : t('Could not read this file.'), true);
    }
  };

  return (
    <>
      <Header title={t('Export & import data')} onBack={() => back('settings')} />
      <main className="page">
        <section className="panel">
          <h2 className="panel-title">{t('Your data')}</h2>
          <p className="muted small">
            {t('Your data is saved to your account. A backup file is an extra copy you keep yourself (Files, iCloud Drive, Google Drive). Last backup:')}{' '}
            <strong>{fmtBackupAge(state)}</strong>.
          </p>
          <div className="btn-grid">
            <button className="btn" onClick={() => saveBackup(state, update)}>
              {t('Export backup')}
            </button>
            <button className="btn" onClick={() => jsonInput.current?.click()}>
              {t('Restore backup')}
            </button>
            <button className="btn" onClick={() => csvInput.current?.click()}>
              {t('Import from Hevy or Strong (CSV)')}
            </button>
            <button
              className="btn"
              disabled={!done.length}
              onClick={() => download(`foundry-workouts-${stamp}.csv`, exportWorkoutCsv(workouts, exMap), 'text/csv')}
            >
              {t('Export CSV')}
            </button>
          </div>
          <button className="btn btn-primary btn-wide" onClick={() => requirePro('excel') && downloadWorkbook(state, exMap)}>
            <Icon name="download" size={18} /> {t('Export to Excel (report and all data)')}
          </button>
          <p className="muted small">
            {t(
              'One workbook: weekly report, workouts, every set, weigh-ins, daily nutrition, food log and check-ins. Opens in Excel, Numbers or Google Sheets.',
            )}
          </p>
          {cloud.user && (
            <button
              className="btn btn-wide"
              onClick={async () => {
                try {
                  const data = await exportSocialData(cloud.user!.id);
                  download(`foundry-social-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
                } catch (e) {
                  alert((e as Error).message);
                }
              }}
            >
              <Icon name="download" size={18} /> {t('Export my social data (profile, posts, comments, shared meals)')}
            </button>
          )}
          <p className="muted small">
            {t(
              'To bring your history over from Hevy: in Hevy, open Settings → Export & Import Data → Export workouts, then import that CSV file here. Exercises with unknown names become custom exercises.',
            )}{' '}
            {t(
              'From Strong: in Strong, open Settings → Export Strong Data, then import that CSV file here. Weights in files without a unit are read in your unit ({unit}).',
              { unit: state.settings.unit },
            )}
          </p>
          {msg && <p className={msg.error ? 'field-error' : 'ok-line'}>{msg.text}</p>}
          <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmReset(true)}>
            {t('Erase all data')}
          </button>
          <input
            ref={csvInput}
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCsv(f);
              e.target.value = '';
            }}
          />
          <input
            ref={jsonInput}
            id="json-file"
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setPendingRestore(await f.text());
            }}
          />
        </section>
      </main>

      <Confirm
        open={pendingRestore != null}
        title={t('Restore backup?')}
        message={t('Your current workouts, history and settings will be replaced by the backup.')}
        confirmLabel={t('Restore')}
        danger
        onConfirm={() => {
          try {
            const next = parseBackup(pendingRestore!);
            update(() => next);
            say(tp(next.workouts.filter((w) => w.endedAt).length, 'Restored {n} workout.', 'Restored {n} workouts.'));
          } catch (e) {
            say(e instanceof Error ? e.message : t('Could not read this backup.'), true);
          }
        }}
        onClose={() => setPendingRestore(null)}
      />
      <Confirm
        open={confirmReset}
        title={t('Erase all data?')}
        message={t(
          'All your workouts (saved and done), foods, weigh-ins and settings are deleted, on this phone and in your account. Export a backup first if you may need them.',
        )}
        confirmLabel={t('Erase everything')}
        danger
        onConfirm={() => {
          update(() => defaultState());
          say(t('All data erased.'));
        }}
        onClose={() => setConfirmReset(false)}
      />
    </>
  );
}
