import { useEffect, useState } from 'react';
import { Header, Icon } from '../components/ui';
import { back, go } from '../hooks';
import { decodeRoutines, routineSummary, type SharedRoutines } from '../routines';
import { exerciseName, useStore } from '../store';
import { uid } from '../utils';
import { t, tp } from '../i18n';

/** Opened from a share link (#/import/<code>): preview, then add to this device. */
export function ImportRoutines({ code }: { code: string }) {
  const { update, exMap } = useStore();
  const [data, setData] = useState<SharedRoutines | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    decodeRoutines(code)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [code]);

  const unknown = data
    ? [...new Set(data.routines.flatMap((r) => r.exercises.map((we) => we.exerciseId)).filter((id) => !exMap.has(id)))]
    : [];

  const add = () => {
    if (!data) return;
    const folderId = data.folder ? uid() : undefined;
    update((s) => ({
      ...s,
      folders: folderId ? [...s.folders, { id: folderId, name: data.folder! }] : s.folders,
      routines: [...s.routines, ...data.routines.map((r) => ({ ...r, folderId }))],
    }));
    go('', { replace: true });
  };

  return (
    <>
      <Header title={t('Add workouts')} onBack={() => back()} />
      <main className="page">
        {error && (
          <div className="empty-card">
            <p>{error}</p>
            <button className="btn" onClick={() => go('', { replace: true })}>{t('Back to workouts')}</button>
          </div>
        )}
        {!error && !data && <p className="muted">{t('Reading the link…')}</p>}
        {data && (
          <>
            <p>
              {data.folder ? (
                <>{tp(data.routines.length, 'This link holds the folder “{folder}” with {n} workout.', 'This link holds the folder “{folder}” with {n} workouts.', { folder: data.folder })}</>
              ) : (
                <>{tp(data.routines.length, 'This link holds {n} workout.', 'This link holds {n} workouts.')}</>
              )}{' '}{t('They will be added to the workouts already on this device.')}</p>
            <ul className="routine-list">
              {data.routines.map((r) => {
                const sum = routineSummary(r.exercises, exMap);
                return (
                  <li key={r.id} className="import-card">
                    <span className="routine-name">{r.name}</span>
                    <span className="muted small">
                      {t('{0} exercises · {1} sets · about {2} min', { 0: sum.exercises, 1: sum.sets, 2: Math.round(sum.seconds / 60) })}</span>
                    <span className="small routine-ex">
                      {r.exercises.map((we) => exerciseName(exMap, we.exerciseId)).join(', ')}
                    </span>
                  </li>
                );
              })}
            </ul>
            {unknown.length > 0 && (
              <p className="field-error">
                {tp(unknown.length, '{n} exercise is not in this app’s library and will show as “Deleted exercise”. Update the app, or replace it after adding.', '{n} exercises are not in this app’s library and will show as “Deleted exercise”. Update the app, or replace them after adding.')}</p>
            )}
            <button className="btn btn-primary btn-wide" onClick={add}>
              <Icon name="plus" size={18} />{' '}{t('Add')}{' '}{data.routines.length > 1 ? tp(data.routines.length, '{n} workout', '{n} workouts') : t('workout')}
            </button>
          </>
        )}
      </main>
    </>
  );
}
