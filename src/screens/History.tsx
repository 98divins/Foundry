import { useMemo, useState } from 'react';
import { Header, Icon } from '../components/ui';
import { back, go } from '../hooks';
import { exerciseName, useStore } from '../store';
import { computePRs, fmtDate, fmtDuration, fmtVolume, workoutVolume } from '../utils';
import { locale, t, tp } from '../i18n';

export function History() {
  const { state, exMap } = useStore();
  const prs = useMemo(() => computePRs(state.workouts), [state.workouts]);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      state.workouts
        .filter((w) => w.endedAt)
        .filter((w) => !q || w.name.toLowerCase().includes(q) || w.exercises.some((we) => exerciseName(exMap, we.exerciseId).toLowerCase().includes(q)))
        .sort((a, b) => b.startedAt - a.startedAt),
    [state.workouts, exMap, q],
  );

  const groups: { month: string; items: typeof list }[] = [];
  for (const w of list) {
    const month = new Date(w.startedAt).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
    const g = groups[groups.length - 1];
    if (g?.month === month) g.items.push(w);
    else groups.push({ month, items: [w] });
  }

  return (
    <>
      <Header
        title={t('History')}
        onBack={() => back('')}
        right={
          <button className="btn btn-small" onClick={() => go('edit/new')}>
            <Icon name="plus" size={16} />{' '}{t('Log past')}</button>
        }
      />
      <main className="page">
        {state.workouts.some((w) => w.endedAt) && (
          <div className="search">
            <Icon name="search" size={18} />
            <input id="history-search" type="search" placeholder={t('Search a workout or an exercise')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}
        {!list.length && q && <p className="muted">{t('No workout matches.')}</p>}
        {!list.length && !q && (
          <div className="empty-card">
            <Icon name="history" size={28} />
            <p>{t('Finished workouts appear here. Start one from the Workout tab, log a past session, or import your Hevy history in Settings → Export & import data.')}</p>
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
                            <Icon name="trophy" size={13} /> {tp(prCount, '{n} PR', '{n} PRs')}
                          </span>
                        )}
                      </div>
                      <ul className="history-ex small muted">
                        {w.exercises.slice(0, 4).map((we) => (
                          <li key={we.id}>
                            {we.sets.length} × {exerciseName(exMap, we.exerciseId)}
                          </li>
                        ))}
                        {w.exercises.length > 4 && <li>{t('+{0} more', { 0: w.exercises.length - 4 })}</li>}
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
