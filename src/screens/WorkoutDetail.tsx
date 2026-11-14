import { useMemo, useState } from 'react';
import { Confirm, Header, Icon, Sheet, Stat } from '../components/ui';
import { back, go } from '../hooks';
import { exerciseName, useStore } from '../store';
import { backupDue, fmtBackupAge, saveBackup } from '../backup';
import type { ExerciseKind, PRKind } from '../types';
import { ExerciseImage } from '../components/ExerciseImage';
import {
  computePRs,
  epley,
  fmtDate,
  fmtDuration,
  fmtTime,
  fmtVolume,
  fmtEstimate,
  fmtSet,
  uid,
  workoutSetCount,
  workoutVolume,
} from '../utils';

const PR_LABEL: Record<PRKind, string> = {
  weight: 'Heaviest',
  '1rm': 'Best 1RM',
  volume: 'Best set volume',
  reps: 'Most reps',
  duration: 'Longest',
  distance: 'Farthest',
};

const SET_HEADER: Record<ExerciseKind, string> = {
  weight: 'Weight × reps',
  bodyweight: 'Reps (added weight)',
  assisted: 'Reps (assistance)',
  duration: 'Time',
  cardio: 'Distance · time',
};

export function WorkoutDetail({ id }: { id: string }) {
  const { state, update, exMap } = useStore();
  const w = state.workouts.find((x) => x.id === id);
  const prs = useMemo(() => computePRs(state.workouts), [state.workouts]);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');
  const unit = state.settings.unit;
  // Offer a backup right after a workout is finished.
  const justFinished = !!w?.endedAt && Date.now() - w.endedAt < 15 * 60000;

  if (!w) {
    return (
      <>
        <Header title="Workout" onBack={() => back('history')} />
        <main className="page">
          <p className="muted">This workout was deleted.</p>
        </main>
      </>
    );
  }

  const prSets = w.exercises.flatMap((we) => we.sets).filter((s) => prs.has(s.id));

  const saveAsRoutine = () => {
    update((s) => ({
      ...s,
      routines: [
        ...s.routines,
        {
          id: uid(),
          name: w.name,
          updatedAt: Date.now(),
          exercises: w.exercises.map((we) => ({
            ...we,
            id: uid(),
            sets: we.sets.map((st) => ({ ...st, id: uid(), done: false, target: null })),
          })),
        },
      ],
    }));
    setMenu(false);
    setToast(`Saved “${w.name}” as a routine.`);
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <>
      <Header
        title={w.name}
        onBack={() => back('history')}
        right={
          <button className="icon-btn" aria-label="Workout options" onClick={() => setMenu(true)}>
            <Icon name="dots" />
          </button>
        }
      />
      <main className="page">
        <p className="muted small">
          {fmtDate(w.startedAt)} · {fmtTime(w.startedAt)}
        </p>
        <div className="stats-row">
          <Stat label="Duration" value={fmtDuration(w.endedAt! - w.startedAt)} />
          <Stat label="Volume" value={fmtVolume(workoutVolume(w), unit)} />
          <Stat label="Sets" value={workoutSetCount(w)} />
          <Stat label="Records" value={prSets.length} />
        </div>
        {justFinished && backupDue(state) && (
          <div className="backup-banner" role="status">
            <span>
              <strong>Save a backup?</strong> Your workouts are stored only on this phone. Last backup: {fmtBackupAge(state)}.
            </span>
            <button className="btn btn-small btn-primary" onClick={() => saveBackup(state, update)}>
              Save backup
            </button>
          </div>
        )}
        {w.note && <p className="note-block">{w.note}</p>}

        {w.exercises.map((we) => {
          const ex = exMap.get(we.exerciseId);
          const kind = ex?.kind ?? 'weight';
          const show1rm = kind === 'weight';
          return (
            <section key={we.id} className="ex-card">
              <div className="ex-head">
                <button className="ex-title" onClick={() => go('e/' + we.exerciseId)}>
                  <ExerciseImage ex={ex} label={exerciseName(exMap, we.exerciseId)} />
                  <span>{exerciseName(exMap, we.exerciseId)}</span>
                </button>
              </div>
              {we.note && <p className="muted small">{we.note}</p>}
              <table className="set-table">
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>{SET_HEADER[kind]}</th>
                    {show1rm && <th className="num-col">Est. 1RM</th>}
                  </tr>
                </thead>
                <tbody>
                  {we.sets.map((s, i) => {
                    const kinds = prs.get(s.id);
                    const label =
                      s.type === 'warmup'
                        ? 'W'
                        : s.type === 'drop'
                          ? 'D'
                          : String(we.sets.slice(0, i + 1).filter((x) => x.type === 'normal' || x.type === 'failure').length) +
                            (s.type === 'failure' ? 'F' : '');
                    return (
                      <tr key={s.id}>
                        <td className={'set-type-cell t-' + s.type}>{label}</td>
                        <td>
                          {fmtSet(s, kind, unit)}
                          {kinds && (
                            <span className="pr-pill" title={kinds.map((k) => PR_LABEL[k]).join(', ')}>
                              <Icon name="trophy" size={12} /> {kinds.map((k) => PR_LABEL[k]).join(' · ')}
                            </span>
                          )}
                        </td>
                        {show1rm && (
                          <td className="num-col muted">
                            {s.weight && s.reps ? fmtEstimate(epley(s.weight, s.reps), unit) : '–'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
        {toast && <div className="toast">{toast}</div>}
      </main>

      <Sheet open={menu} onClose={() => setMenu(false)} title={w.name}>
        <div className="menu">
          <button className="menu-item" onClick={() => { setMenu(false); go('edit/' + w.id); }}>
            <Icon name="edit" size={18} /> Edit workout
          </button>
          <button className="menu-item" onClick={saveAsRoutine}>
            <Icon name="copy" size={18} /> Save as routine
          </button>
          <button className="menu-item danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}>
            <Icon name="trash" size={18} /> Delete workout
          </button>
        </div>
      </Sheet>
      <Confirm
        open={confirmDelete}
        title="Delete workout?"
        message="This workout and its records will be removed from your history."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          update((s) => ({ ...s, workouts: s.workouts.filter((x) => x.id !== id) }));
          go('history', { replace: true });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
