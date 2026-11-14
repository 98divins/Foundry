import { useMemo } from 'react';
import { Header, Icon } from '../components/ui';
import { go } from '../hooks';
import { exerciseName, useStore } from '../store';
import { computePRs, fmtDate, fmtDuration, fmtVolume, workoutVolume } from '../utils';

export function History() {
  const { state, exMap } = useStore();
  const prs = useMemo(() => computePRs(state.workouts), [state.workouts]);
  const list = useMemo(
    () => state.workouts.filter((w) => w.endedAt).sort((a, b) => b.startedAt - a.startedAt),
    [state.workouts],
  );

  const groups: { month: string; items: typeof list }[] = [];
  for (const w of list) {
    const month = new Date(w.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const g = groups[groups.length - 1];
    if (g?.month === month) g.items.push(w);
    else groups.push({ month, items: [w] });
  }

  return (
    <>
      <Header
        title="History"
        right={
          <button className="btn btn-small" onClick={() => go('edit/new')}>
            <Icon name="plus" size={16} /> Log past
          </button>
        }
      />
      <main className="page">
        {!list.length && (
          <div className="empty-card">
            <Icon name="history" size={28} />
            <p>Finished workouts appear here. Start one from the Workout tab, log a past session, or import your history from the Profile tab.</p>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.month} className="month">
            <h2 className="month-title">
              {g.month} <span className="muted">· {g.items.length}</span>
            </h2>
            <ul className="history-list">
              {g.items.map((w) => {
                const prCount = w.exercises.flatMap((we) => we.sets).filter((s) => prs.has(s.id)).length;
                return (
                  <li key={w.id}>
                    <button className="history-card" onClick={() => go('w/' + w.id)}>
                      <div className="history-top">
                        <span className="history-name">{w.name}</span>
                        <span className="muted small">{fmtDate(w.startedAt)}</span>
                      </div>
                      <div className="history-meta small">
                        <span>{fmtDuration(w.endedAt! - w.startedAt)}</span>
                        <span>{fmtVolume(workoutVolume(w), state.settings.unit)}</span>
                        {prCount > 0 && (
                          <span className="pr-pill">
                            <Icon name="trophy" size={13} /> {prCount} PR{prCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <ul className="history-ex small muted">
                        {w.exercises.slice(0, 4).map((we) => (
                          <li key={we.id}>
                            {we.sets.length} × {exerciseName(exMap, we.exerciseId)}
                          </li>
                        ))}
                        {w.exercises.length > 4 && <li>+{w.exercises.length - 4} more</li>}
                      </ul>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
