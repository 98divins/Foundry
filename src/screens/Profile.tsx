import { useRef, useState } from 'react';
import { back } from '../hooks';
import { Confirm, Header } from '../components/ui';
import { exportWorkoutCsv, importWorkoutCsv } from '../csv';
import { defaultState, parseBackup, useStore } from '../store';
import { download } from '../utils';
import { fmtBackupAge, saveBackup } from '../backup';

/** Settings → Export & import data. */
export function DataPage() {
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
      const res = importWorkoutCsv(await file.text(), exercises, workouts);
      update((s) => ({
        ...s,
        workouts: [...s.workouts, ...res.workouts],
        customExercises: [...s.customExercises, ...res.newExercises],
      }));
      say(
        `Imported ${res.workouts.length} workout(s)` +
          (res.newExercises.length ? `, created ${res.newExercises.length} custom exercise(s)` : '') +
          (res.skippedDuplicates ? `, skipped ${res.skippedDuplicates} already in your history` : '') +
          '.',
      );
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not read this file.', true);
    }
  };

  return (
    <>
      <Header title="Export & import data" onBack={() => back('settings')} />
      <main className="page">
        <section className="panel">
          <h2 className="panel-title">Your data</h2>
          <p className="muted small">
            Your data is saved to your account. A backup file is an extra copy you keep yourself (Files, iCloud Drive,
            Google Drive). Last backup: <strong>{fmtBackupAge(state)}</strong>.
          </p>
          <div className="btn-grid">
            <button
              className="btn"
              onClick={() => saveBackup(state, update)}
            >
              Export backup
            </button>
            <button className="btn" onClick={() => jsonInput.current?.click()}>
              Restore backup
            </button>
            <button className="btn" onClick={() => csvInput.current?.click()}>
              Import CSV (Hevy export)
            </button>
            <button
              className="btn"
              disabled={!done.length}
              onClick={() => download(`foundry-workouts-${stamp}.csv`, exportWorkoutCsv(workouts, exMap), 'text/csv')}
            >
              Export CSV
            </button>
          </div>
          <p className="muted small">
            To bring your history over from Hevy: in Hevy, open Settings → Export &amp; Import Data → Export workouts, then
            import that CSV file here. Exercises with unknown names become custom exercises.
          </p>
          {msg && <p className={msg.error ? 'field-error' : 'ok-line'}>{msg.text}</p>}
          <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmReset(true)}>
            Erase all data
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
        title="Restore backup?"
        message="Your current workouts, routines and settings will be replaced by the backup."
        confirmLabel="Restore"
        danger
        onConfirm={() => {
          try {
            const next = parseBackup(pendingRestore!);
            update(() => next);
            say(`Restored ${next.workouts.filter((w) => w.endedAt).length} workout(s).`);
          } catch (e) {
            say(e instanceof Error ? e.message : 'Could not read this backup.', true);
          }
        }}
        onClose={() => setPendingRestore(null)}
      />
      <Confirm
        open={confirmReset}
        title="Erase all data?"
        message="All workouts, routines, foods, weigh-ins and settings are deleted, on this phone and in your account. Export a backup first if you may need them."
        confirmLabel="Erase everything"
        danger
        onConfirm={() => {
          update(() => defaultState());
          say('All data erased.');
        }}
        onClose={() => setConfirmReset(false)}
      />
    </>
  );
}
