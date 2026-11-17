import { ShareCardSheet } from '../components/ShareCard';
import { useMemo, useState } from 'react';
import { Confirm, Header, Icon, Sheet, Stat } from '../components/ui';
import { back, go } from '../hooks';
import { exerciseName, useStore } from '../store';
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
import { t, tk, tp } from '../i18n';

const PR_LABEL: Record<PRKind, string> = {
  weight: tk('Heaviest'),
  '1rm': tk('Best 1RM'),
  volume: tk('Best set volume'),
  reps: tk('Most reps'),
  duration: tk('Longest'),
  distance: tk('Farthest'),
};

const SET_HEADER: Record<ExerciseKind, string> = {
  weight: tk('Weight × reps'),
  bodyweight: tk('Reps (added weight)'),
  assisted: tk('Reps (assistance)'),
  duration: tk('Time'),
  cardio: tk('Distance · time'),
};

export function WorkoutDetail({ id, justFinished }: { id: string; justFinished?: boolean }) {
  const { state, update, exMap } = useStore();
  const w = state.workouts.find((x) => x.id === id);
  const prs = useMemo(() => computePRs(state.workouts), [state.workouts]);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');
  const [sharing, setSharing] = useState(false);
  const unit = state.settings.unit;

  if (!w) {
    return (
      <>
        <Header title={t('Workout')} onBack={() => back('history')} />
        <main className="page">
          <p className="muted">{t('This workout was deleted.')}</p>
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
    setToast(t('Saved “{name}” as a workout.', { name: w.name }));
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <>
      <Header
        title={w.name}
        onBack={() => back('history')}
        right={
          <button className="icon-btn" aria-label={t('Workout options')} onClick={() => setMenu(true)}>
            <Icon name="dots" />
          </button>
        }
      />
      <main className="page">
        <p className="muted small">
          {fmtDate(w.startedAt)} · {fmtTime(w.startedAt)}
        </p>
        <div className="stats-row">
          <Stat label={t('Duration')} value={fmtDuration(w.endedAt! - w.startedAt)} />
          <Stat label={t('Volume')} value={fmtVolume(workoutVolume(w), unit)} />
          <Stat label={t('Sets')} value={workoutSetCount(w)} />
          <Stat label={t('Records')} value={prSets.length} />
        </div>
        {justFinished ? (
          <section className="panel done-banner">
            <strong>{prSets.length ? tp(prSets.length, 'Workout done, with {n} record!', 'Workout done, with {n} records!') : t('Workout done. Nice work!')}</strong>
            <button className="btn btn-primary btn-wide" onClick={() => setSharing(true)}>
              <Icon name="share" size={18} /> {t('Share my workout')}
            </button>
          </section>
        ) : (
          <button className="btn btn-wide" onClick={() => setSharing(true)}>
            <Icon name="share" size={18} /> {t('Share as an image')}
          </button>
        )}
        <ShareCardSheet workout={w} open={sharing} onClose={() => setSharing(false)} />
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
                    <th>{t('Set')}</th>
                    <th>{t(SET_HEADER[kind])}</th>
                    {show1rm && <th className="num-col">{t('Est. 1RM')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {we.sets.map((s, i) => {
                    const kinds = prs.get(s.id);
                    const label =
                      s.type === 'warmup'
                        ? t('W')
                        : s.type === 'drop'
                          ? t('D')
                          : String(we.sets.slice(0, i + 1).filter((x) => x.type === 'normal' || x.type === 'failure').length) +
                            (s.type === 'failure' ? t('F') : '');
                    return (
                      <tr key={s.id}>
                        <td className={'set-type-cell t-' + s.type}>{label}</td>
                        <td>
                          {fmtSet(s, kind, unit)}
                          {kinds && (
                            <span className="pr-pill" title={kinds.map((k) => t(PR_LABEL[k])).join(', ')}>
                              <Icon name="trophy" size={12} /> {kinds.map((k) => t(PR_LABEL[k])).join(' · ')}
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
            <Icon name="edit" size={18} />{' '}{t('Edit workout')}</button>
          <button className="menu-item" onClick={saveAsRoutine}>
            <Icon name="copy" size={18} />{' '}{t('Save as workout')}</button>
          <button className="menu-item danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}>
            <Icon name="trash" size={18} />{' '}{t('Delete workout')}</button>
        </div>
      </Sheet>
      <Confirm
        open={confirmDelete}
        title={t('Delete workout?')}
        message={t('This workout and its records will be removed from your history.')}
        confirmLabel={t('Delete')}
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
