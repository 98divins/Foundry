import { useState } from 'react';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Header } from '../components/ui';
import { back, go } from '../hooks';
import { useStore } from '../store';
import type { Workout } from '../types';
import { defaultWorkoutName, uid } from '../utils';

const pad = (n: number) => String(n).padStart(2, '0');
function toLocalInput(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Edit a finished workout, or log one after the fact ("new"). */
export function EditWorkout({ id }: { id: string }) {
  const { state, update } = useStore();
  const existing = state.workouts.find((w) => w.id === id);
  const [draft, setDraft] = useState<Workout>(() => {
    if (existing) return structuredClone(existing);
    const start = Date.now() - 60 * 60000;
    return { id: uid(), name: defaultWorkoutName(start), startedAt: start, endedAt: Date.now(), exercises: [] };
  });
  const [minutes, setMinutes] = useState(() => Math.round(((draft.endedAt ?? draft.startedAt) - draft.startedAt) / 60000));
  const [error, setError] = useState('');

  if (id !== 'new' && !existing) {
    return (
      <>
        <Header title="Edit workout" onBack={() => back('history')} />
        <main className="page">
          <p className="muted">This workout no longer exists.</p>
        </main>
      </>
    );
  }

  const save = () => {
    const exercises = draft.exercises
      .map((we) => ({ ...we, sets: we.sets.filter((s) => (s.reps ?? 0) > 0).map((s) => ({ ...s, done: true })) }))
      .filter((we) => we.sets.length);
    if (!exercises.length) {
      setError('Enter reps for at least one set before saving.');
      return;
    }
    const w: Workout = {
      ...draft,
      name: draft.name.trim() || 'Workout',
      exercises,
      endedAt: draft.startedAt + Math.max(1, minutes) * 60000,
    };
    update((s) => ({
      ...s,
      workouts: existing ? s.workouts.map((x) => (x.id === w.id ? w : x)) : [...s.workouts, w],
    }));
    if (existing) back('w/' + w.id);
    else go('w/' + w.id, { replace: true });
  };

  return (
    <>
      <Header
        title={existing ? 'Edit workout' : 'Log past workout'}
        onBack={() => back('history')}
        right={
          <button className="btn btn-primary btn-small" onClick={save}>
            Save
          </button>
        }
      />
      <main className="page">
        <label className="field">
          <span>Name</span>
          <input id="edit-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Started</span>
            <input
              id="edit-start"
              type="datetime-local"
              value={toLocalInput(draft.startedAt)}
              onChange={(e) => {
                const t = new Date(e.target.value).getTime();
                if (!Number.isNaN(t)) setDraft({ ...draft, startedAt: t });
              }}
            />
          </label>
          <label className="field field-narrow">
            <span>Duration (min)</span>
            <input
              id="edit-duration"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value.replace(/\D/g, '')) || 0)}
            />
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea
            id="edit-note"
            rows={2}
            value={draft.note ?? ''}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
        {error && <p className="field-error">{error}</p>}
        <WorkoutEditor
          exercises={draft.exercises}
          mode="edit"
          before={draft.startedAt}
          onChange={(exercises) => {
            setError('');
            setDraft({ ...draft, exercises });
          }}
        />
        <p className="muted small">Sets without reps are left out when you save.</p>
      </main>
    </>
  );
}
