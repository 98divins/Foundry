import { ExerciseImage } from '../components/ExerciseImage';
import { Header, Icon } from '../components/ui';
import { back, go } from '../hooks';
import { PROGRAMS, routinesFromProgram } from '../programs';
import { exerciseRepRange, routineSummary } from '../routines';
import { exerciseName, useStore } from '../store';
import { fmtClock, uid } from '../utils';

export function ExplorePrograms() {
  const { exMap } = useStore();
  return (
    <>
      <Header title="Explore programs" onBack={() => back()} />
      <main className="page">
        <p className="muted">
          Ready-made programs to start from. Adding one copies its routines into a folder in My routines, where you can
          change anything.
        </p>
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
                    <span className="tag">{p.level}</span>
                    <span className="muted">
                      {p.daysPerWeek} days / week · {p.goal}
                    </span>
                  </span>
                  <span className="program-name">{p.name}</span>
                  <span className="muted small">{p.description}</span>
                  <span className="small">
                    {p.routines.map((r) => r.name).join(' · ')} — {sets} sets in total
                  </span>
                </button>
              </li>
            );
          })}
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
        <Header title="Program" onBack={() => back('explore')} />
        <main className="page">
          <p className="muted">This program does not exist.</p>
        </main>
      </>
    );
  }
  const add = () => {
    const folderId = uid();
    update((s) => ({
      ...s,
      folders: [...s.folders, { id: folderId, name: p.name }],
      routines: [...s.routines, ...routinesFromProgram(p, folderId)],
    }));
    go('', { replace: true });
  };
  return (
    <>
      <Header title={p.name} onBack={() => back('explore')} />
      <main className="page">
        <p className="program-tags small">
          <span className="tag">{p.level}</span>
          <span className="muted">
            {p.daysPerWeek} days / week · {p.goal}
          </span>
        </p>
        <p>{p.description}</p>
        <button className="btn btn-primary btn-wide" onClick={add}>
          <Icon name="plus" size={18} /> Add to my routines
        </button>
        {p.routines.map((r) => {
          const sum = routineSummary(r.exercises.map((we) => ({ ...we, id: '' })), exMap);
          return (
            <section key={r.name} className="routine-plan">
              <div className="program-routine-head">
                <h2>{r.name}</h2>
                <span className="muted small">
                  {sum.exercises} exercises · {sum.sets} sets · about {Math.round(sum.seconds / 60)} min
                </span>
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
                        {we.sets.length} sets{range && <> · {range} reps</>}
                        <span className="plan-rest">
                          <Icon name="timer" size={14} /> {fmtClock(we.restSec)}
                        </span>
                      </span>
                      {we.note && <span className="plan-note">{we.note}</span>}
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
