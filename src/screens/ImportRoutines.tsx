import { useEffect, useState } from 'react';
import { Header, Icon } from '../components/ui';
import { back, go } from '../hooks';
import { decodeRoutines, routineSummary, type SharedRoutines } from '../routines';
import { exerciseName, useStore } from '../store';
import { uid } from '../utils';

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
      <Header title="Add routines" onBack={() => back()} />
      <main className="page">
        {error && (
          <div className="empty-card">
            <p>{error}</p>
            <button className="btn" onClick={() => go('', { replace: true })}>
              Back to workouts
            </button>
          </div>
        )}
        {!error && !data && <p className="muted">Reading the link…</p>}
        {data && (
          <>
            <p>
              {data.folder ? (
                <>
                  This link holds the folder <strong>{data.folder}</strong> with {data.routines.length} routine
                  {data.routines.length > 1 ? 's' : ''}.
                </>
              ) : (
                <>
                  This link holds {data.routines.length} routine{data.routines.length > 1 ? 's' : ''}.
                </>
              )}{' '}
              They will be added to the routines already on this device.
            </p>
            <ul className="routine-list">
              {data.routines.map((r) => {
                const sum = routineSummary(r.exercises, exMap);
                return (
                  <li key={r.id} className="import-card">
                    <span className="routine-name">{r.name}</span>
                    <span className="muted small">
                      {sum.exercises} exercises · {sum.sets} sets · about {Math.round(sum.seconds / 60)} min
                    </span>
                    <span className="small routine-ex">
                      {r.exercises.map((we) => exerciseName(exMap, we.exerciseId)).join(', ')}
                    </span>
                  </li>
                );
              })}
            </ul>
            {unknown.length > 0 && (
              <p className="field-error">
                {unknown.length} exercise{unknown.length > 1 ? 's are' : ' is'} not in this app’s library and will show as
                “Deleted exercise”. Update the app, or replace {unknown.length > 1 ? 'them' : 'it'} after adding.
              </p>
            )}
            <button className="btn btn-primary btn-wide" onClick={add}>
              <Icon name="plus" size={18} /> Add {data.routines.length > 1 ? `${data.routines.length} routines` : 'routine'}
            </button>
          </>
        )}
      </main>
    </>
  );
}
