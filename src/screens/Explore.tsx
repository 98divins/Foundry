import { ExerciseImage } from '../components/ExerciseImage';
import { Header, Icon } from '../components/ui';
import { back, go } from '../hooks';
import { COMING_SOON, PROGRAMS, routinesFromProgram } from '../programs';
import { exerciseRepRange, routineSummary } from '../routines';
import { exerciseName, useStore } from '../store';
import { fmtClock, uid } from '../utils';
import { t } from '../i18n';

export function ExplorePrograms() {
  const { exMap } = useStore();
  return (
    <>
      <Header title={t('Explore programs')} onBack={() => back()} />
      <main className="page">
        <p className="muted">{t('Ready-made programs to start from. Adding one copies its routines into a folder in My routines, where you can change anything.')}</p>
        <ul className="routine-list">
          {PROGRAMS.map((p) => {
            const sets = p.routines.reduce(
              (t, r) => t + routineSummary(r.exercises.map((we) => ({ ...we, id: '' })), exMap).sets,
              0,
            );
            return (
              <li key={p.id}>
                <button className="program-card" onClick={() => go('explore/' + p.id)}>
                  <span className="program-tags small">
                    <span className="tag">{t(p.level)}</span>
                    <span className="muted">
                      {t('{0} days / week · {1}', { 0: p.daysPerWeek, 1: t(p.goal) })}</span>
                  </span>
                  <span className="program-name">{t(p.name)}</span>
                  <span className="muted small">{t(p.description)}</span>
                  <span className="small">
                    {t('{0} — {1} sets in total', { 0: p.routines.map((r) => t(r.name)).join(' · '), 1: sets })}</span>
                </button>
              </li>
            );
          })}
          {COMING_SOON.map((p) => (
            <li key={p.id}>
              <div className="program-card soon" aria-disabled="true">
                <span className="program-tags small">
                  <span className="tag soon-tag">{t('Coming soon')}</span>
                  <span className="tag">{t(p.level)}</span>
                  <span className="muted">{t('{0} days / week · {1}', { 0: p.daysPerWeek, 1: t(p.goal) })}</span>
                </span>
                <span className="program-name">{t(p.name)}</span>
                <span className="muted small">{t(p.description)}</span>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

export function ProgramDetail({ id }: { id: string }) {
  const { update, exMap } = useStore();
  const p = PROGRAMS.find((x) => x.id === id);
  if (!p) {
    return (
      <>
        <Header title={t('Program')} onBack={() => back('explore')} />
        <main className="page">
          <p className="muted">{t('This program does not exist.')}</p>
        </main>
      </>
    );
  }
  const add = () => {
    const folderId = uid();
    update((s) => ({
      ...s,
      folders: [...s.folders, { id: folderId, name: t(p.name) }],
      routines: [...s.routines, ...routinesFromProgram(p, folderId)],
    }));
    go('', { replace: true });
  };
  return (
    <>
      <Header title={t(p.name)} onBack={() => back('explore')} />
      <main className="page">
        <p className="program-tags small">
          <span className="tag">{t(p.level)}</span>
          <span className="muted">
            {t('{0} days / week · {1}', { 0: p.daysPerWeek, 1: t(p.goal) })}</span>
        </p>
        <p>{t(p.description)}</p>
        <button className="btn btn-primary btn-wide" onClick={add}>
          <Icon name="plus" size={18} />{' '}{t('Add to my routines')}</button>
        {p.routines.map((r) => {
          const sum = routineSummary(r.exercises.map((we) => ({ ...we, id: '' })), exMap);
          return (
            <section key={r.name} className="routine-plan">
              <div className="program-routine-head">
                <h2>{t(r.name)}</h2>
                <span className="muted small">
                  {t('{0} exercises · {1} sets · about {2} min', { 0: sum.exercises, 1: sum.sets, 2: Math.round(sum.seconds / 60) })}</span>
              </div>
              {r.exercises.map((we, i) => {
                const ex = exMap.get(we.exerciseId);
                const range = exerciseRepRange(we.sets);
                return (
                  <div key={i} className="plan-row">
                    <ExerciseImage ex={ex} label={exerciseName(exMap, we.exerciseId)} />
                    <span className="plan-text">
                      <span className="plan-name">{exerciseName(exMap, we.exerciseId)}</span>
                      <span className="plan-meta">
                        {we.sets.length}{' '}{t('sets')}{range && <> {t('· {0} reps', { 0: range })}</>}
                        <span className="plan-rest">
                          <Icon name="timer" size={14} /> {fmtClock(we.restSec)}
                        </span>
                      </span>
                      {we.note && <span className="plan-note">{t(we.note)}</span>}
                    </span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </main>
    </>
  );
}
