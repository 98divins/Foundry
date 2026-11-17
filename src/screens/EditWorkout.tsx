import { useState } from 'react';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Header, Icon, Sheet } from '../components/ui';
import { back, go } from '../hooks';
import { useStore } from '../store';
import type { Routine, Workout } from '../types';
import { liveSetFromRoutine } from '../routines';
import { defaultWorkoutName, previousSets, uid } from '../utils';
import { t, tp } from '../i18n';
import { requirePro } from '../pro';

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
  const [picking, setPicking] = useState(false);

  /**
   * Fill the workout from a routine. Each set starts from what was done last time before this date
   * (or the routine's target reps), so logging a past session is mostly checking the numbers.
   */
  const fromRoutine = (r: Routine) => {
    const exercises = r.exercises.map((we) => {
      const prev = previousSets(state.workouts, we.exerciseId, draft.startedAt);
      return {
        ...we,
        id: uid(),
        sets: we.sets.map((s, i) => {
          const live = liveSetFromRoutine(s);
          const p = prev[i];
          return {
            ...live,
            weight: p?.weight ?? s.weight ?? null,
            reps: p?.reps ?? s.reps ?? null,
            duration: p?.duration ?? live.duration,
            distance: p?.distance ?? live.distance,
          };
        }),
      };
    });
    setDraft({ ...draft, name: r.name, routineId: r.id, exercises: [...draft.exercises, ...exercises] });
    setPicking(false);
    setError('');
  };

  if (id !== 'new' && !existing) {
    return (
      <>
        <Header title={t('Edit workout')} onBack={() => back('history')} />
        <main className="page">
          <p className="muted">{t('This workout no longer exists.')}</p>
        </main>
      </>
    );
  }

  const save = () => {
    const exercises = draft.exercises
      .map((we) => ({ ...we, sets: we.sets.filter((s) => (s.reps ?? 0) > 0).map((s) => ({ ...s, done: true })) }))
      .filter((we) => we.sets.length);
    if (!exercises.length) {
      setError(t('Enter reps for at least one set before saving.'));
      return;
    }
    const w: Workout = {
      ...draft,
      name: draft.name.trim() || t('Workout'),
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
        title={existing ? t('Edit workout') : t('Log past workout')}
        onBack={() => back('history')}
        right={
          <button className="btn btn-primary btn-small" onClick={save}>
            {t('Save')}
          </button>
        }
      />
      <main className="page">
        <label className="field">
          <span>{t('Name')}</span>
          <input id="edit-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>{t('Started')}</span>
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
            <span>{t('Duration (min)')}</span>
            <input id="edit-duration" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(Number(e.target.value.replace(/\D/g, '')) || 0)} />
          </label>
        </div>
        <label className="field">
          <span>{t('Notes')}</span>
          <textarea id="edit-note" rows={2} value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </label>
        {!existing && state.routines.length > 0 && (
          <button className="btn btn-wide" onClick={() => requirePro('fillFromRoutine') && setPicking(true)}>
            <Icon name="folder" size={18} /> {t('Fill from a workout')}
          </button>
        )}
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
        <p className="muted small">{t('Sets without reps are left out when you save.')}</p>
      </main>
      <Sheet open={picking} onClose={() => setPicking(false)} title={t('Fill from a workout')}>
        <p className="sheet-text muted small">{t('Sets are filled with what you did last time on each exercise. Check the numbers, then save.')}</p>
        <div className="menu">
          {state.routines.map((r) => (
            <button key={r.id} className="menu-item" onClick={() => fromRoutine(r)}>
              {r.name}
              <span className="muted small"> · {tp(r.exercises.length, '{n} exercise', '{n} exercises')}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
