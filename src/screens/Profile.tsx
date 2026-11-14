import { useMemo, useRef, useState } from 'react';
import { BarChart } from '../components/Charts';
import { Confirm, Header, Segmented, Stat } from '../components/ui';
import { exportWorkoutCsv, importWorkoutCsv } from '../csv';
import { muscleLabel } from '../exercises';
import { defaultState, parseBackup, useStore } from '../store';
import type { Muscle, NameLang, Unit } from '../types';
import { countsForStats, download, fmtClock, fmtVolume, weekStart, workoutVolume } from '../utils';

const WEEK = 7 * 24 * 3600 * 1000;

export function Profile() {
  const { state, update, exercises, exMap } = useStore();
  const { workouts, settings } = state;
  const done = useMemo(() => workouts.filter((w) => w.endedAt), [workouts]);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const weeks = useMemo(() => {
    const thisWeek = weekStart(Date.now());
    return Array.from({ length: 12 }, (_, i) => {
      const start = thisWeek - (11 - i) * WEEK;
      // Rebase through weekStart to stay correct across DST changes.
      const s = weekStart(start + WEEK / 2);
      const e = weekStart(s + WEEK + WEEK / 2);
      return {
        label: new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' }),
        value: done.filter((w) => w.startedAt >= s && w.startedAt < e).length,
      };
    });
  }, [done]);

  const muscles = useMemo(() => {
    const since = Date.now() - 30 * 24 * 3600 * 1000;
    const m = new Map<Muscle, number>();
    for (const w of done) {
      if (w.startedAt < since) continue;
      for (const we of w.exercises) {
        const muscle = exMap.get(we.exerciseId)?.muscle ?? 'other';
        m.set(muscle, (m.get(muscle) ?? 0) + we.sets.filter(countsForStats).length);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [done, exMap]);
  const maxMuscle = Math.max(1, ...muscles.map((m) => m[1]));

  const totalTime = done.reduce((t, w) => t + (w.endedAt! - w.startedAt), 0);
  const totalVolume = done.reduce((t, w) => t + workoutVolume(w), 0);
  const streak = (() => {
    let n = 0;
    let s = weekStart(Date.now());
    // The current week counts only once it has a workout; it never breaks the streak.
    if (!done.some((w) => w.startedAt >= s)) s = weekStart(s - WEEK / 2);
    while (done.some((w) => w.startedAt >= s && w.startedAt < weekStart(s + WEEK + WEEK / 2))) {
      n++;
      s = weekStart(s - WEEK / 2);
    }
    return n;
  })();

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
      <Header title="Profile" />
      <main className="page">
        <div className="stats-row">
          <Stat label="Workouts" value={done.length} />
          <Stat label="Week streak" value={streak} />
          <Stat label="Time" value={totalTime >= 3600000 ? `${Math.round(totalTime / 3600000)} h` : `${Math.round(totalTime / 60000)} min`} />
          <Stat label="Volume" value={fmtVolume(totalVolume, settings.unit)} />
        </div>

        <section className="panel">
          <h2 className="panel-title">Workouts per week</h2>
          <BarChart bars={weeks} />
        </section>

        <section className="panel">
          <h2 className="panel-title">Working sets by muscle, last 30 days</h2>
          {!muscles.length && <p className="muted small">No workouts in the last 30 days.</p>}
          <ul className="muscle-bars">
            {muscles.map(([m, n]) => (
              <li key={m}>
                <span className="muscle-name">{muscleLabel(m, settings.exerciseLang)}</span>
                <span className="muscle-track">
                  <span className="muscle-fill" style={{ width: `${(n / maxMuscle) * 100}%` }} />
                </span>
                <span className="muscle-n">{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2 className="panel-title">Settings</h2>
          <div className="setting">
            <span>Weight unit</span>
            <Segmented<Unit>
              label="Weight unit"
              value={settings.unit}
              onChange={(unit) => update((s) => ({ ...s, settings: { ...s.settings, unit } }))}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          </div>
          <label className="setting">
            <span>Default rest for new exercises</span>
            <select
              id="default-rest"
              value={settings.defaultRest}
              onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, defaultRest: Number(e.target.value) } }))}
            >
              {[0, 30, 60, 90, 120, 150, 180, 240].map((r) => (
                <option key={r} value={r}>
                  {r ? fmtClock(r) : 'Off'}
                </option>
              ))}
            </select>
          </label>
          <div className="setting">
            <span>Exercise names</span>
            <Segmented<NameLang>
              label="Exercise names"
              value={settings.exerciseLang}
              onChange={(exerciseLang) => update((s) => ({ ...s, settings: { ...s.settings, exerciseLang } }))}
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
          <label className="setting">
            <span>Beep when rest is over</span>
            <input
              id="sound"
              type="checkbox"
              className="switch"
              checked={settings.sound}
              onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, sound: e.target.checked } }))}
            />
          </label>
        </section>

        <section className="panel">
          <h2 className="panel-title">Your data</h2>
          <p className="muted small">
            Everything is stored on this device only. Export a backup regularly, and before you clear your browser data.
          </p>
          <div className="btn-grid">
            <button
              className="btn"
              onClick={() => download(`foundry-backup-${stamp}.json`, JSON.stringify(state), 'application/json')}
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
        <p className="muted small center">Foundry · your training log, kept on your device</p>
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
        message="All workouts, routines, custom exercises and settings on this device will be deleted. Export a backup first if you may need them."
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
