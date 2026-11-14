import { ExerciseImage } from '../components/ExerciseImage';
import { supersetClass } from '../components/WorkoutEditor';
import { Header, Icon, Stat } from '../components/ui';
import { muscleLabel } from '../exercises';
import { back, go } from '../hooks';
import { exerciseRepRange, routineSummary, supersetSlots } from '../routines';
import { ShareResult, useShareLink } from '../components/Share';
import { exerciseName, useStore } from '../store';
import type { Routine } from '../types';
import { fmtClock, fmtSet } from '../utils';
import { startWorkout } from './WorkoutTab';

export function RoutineSummaryPanel({ routine }: { routine: Pick<Routine, 'exercises'> }) {
  const { state, exMap } = useStore();
  const sum = routineSummary(routine.exercises, exMap);
  const max = Math.max(1, ...sum.muscles.map((m) => m[1]));
  return (
    <section className="panel">
      <h2 className="panel-title">Routine summary</h2>
      <div className="summary-stats">
        <Stat label="Exercises" value={sum.exercises} />
        <Stat label="Sets" value={sum.sets} />
        <Stat label="Est. time" value={`${Math.round(sum.seconds / 60)} min`} />
      </div>
      {sum.muscles.length > 0 && (
        <>
          <div className="muscle-head muted small">
            <span>Muscle</span>
            <span>Sets</span>
          </div>
          <ul className="muscle-bars">
            {sum.muscles.map(([m, n]) => (
              <li key={m}>
                <span className="muscle-name">{muscleLabel(m, state.settings.exerciseLang)}</span>
                <span className="muscle-track">
                  <span className="muscle-fill" style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="muscle-n">{n}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">Time counts about 45 s per set plus each exercise’s rest. Warm-up sets are left out of the muscle count.</p>
    </section>
  );
}

export function RoutineView({ id }: { id: string }) {
  const { state, update, exMap } = useStore();
  const r = state.routines.find((x) => x.id === id);
  const { shared, share, clear } = useShareLink();
  const unit = state.settings.unit;

  if (!r) {
    return (
      <>
        <Header title="Routine" onBack={() => back()} />
        <main className="page">
          <p className="muted">This routine no longer exists.</p>
        </main>
      </>
    );
  }

  const slots = supersetSlots(r.exercises);
  const folder = state.folders.find((f) => f.id === r.folderId);

  return (
    <>
      <Header title={r.name} onBack={() => back()} />
      <main className="page">
        {folder && <p className="muted small">In folder {folder.name}</p>}
        <div className="routine-actions">
          <button
            className="btn btn-primary"
            disabled={!!state.active || !r.exercises.length}
            onClick={() => startWorkout(update, r)}
          >
            <Icon name="play" size={16} /> Start routine
          </button>
          <button className="btn" onClick={() => go('r/' + r.id)}>
            <Icon name="edit" size={16} /> Edit
          </button>
          <button className="btn" onClick={() => share(undefined, [r])}>
            <Icon name="link" size={16} /> Copy link
          </button>
        </div>
        {state.active && <p className="muted small">Finish the workout in progress to start this routine.</p>}
        <ShareResult shared={shared} onClose={clear} />

        <div className="routine-layout">
          <section className="routine-plan">
            {r.exercises.map((we, i) => {
              const ex = exMap.get(we.exerciseId);
              const kind = ex?.kind ?? 'weight';
              const range = exerciseRepRange(we.sets);
              const timed = kind === 'duration' || kind === 'cardio';
              const plan = timed ? we.sets.map((s) => fmtSet(s, kind, unit)).filter((t) => t !== '–')[0] : null;
              return (
                <div key={we.id} className={supersetClass(slots[i])}>
                  {slots[i].first && <span className={'ss-label ss-c' + ((slots[i].group ?? 0) % 4)}>Superset</span>}
                  <button className="plan-row" onClick={() => go('e/' + we.exerciseId)}>
                    <ExerciseImage ex={ex} label={exerciseName(exMap, we.exerciseId)} />
                    <span className="plan-text">
                      <span className="plan-name">{exerciseName(exMap, we.exerciseId)}</span>
                      <span className="plan-meta">
                        {we.sets.length} {we.sets.length > 1 ? 'sets' : 'set'}
                        {range && <> · {range} reps</>}
                        {plan && <> · {plan}</>}
                        {we.restSec > 0 && (
                          <span className="plan-rest">
                            <Icon name="timer" size={14} /> {fmtClock(we.restSec)}
                          </span>
                        )}
                      </span>
                      {we.note && <span className="plan-note">{we.note}</span>}
                    </span>
                  </button>
                </div>
              );
            })}
            {!r.exercises.length && <p className="muted">No exercises yet. Use Edit to add some.</p>}
          </section>
          <RoutineSummaryPanel routine={r} />
        </div>
      </main>
    </>
  );
}
