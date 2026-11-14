import { go, useNow } from '../hooks';
import { exerciseName, useStore } from '../store';
import type { Routine, State, Workout } from '../types';
import { defaultWorkoutName, fmtClock, fmtDate, fmtDuration, fmtVolume, uid, weekStart, workoutVolume } from '../utils';
import { Header, Icon } from '../components/ui';

export function startWorkout(update: (fn: (s: State) => State) => void, routine?: Routine) {
  update((s) => {
    if (s.active) return s;
    const now = Date.now();
    const w: Workout = {
      id: uid(),
      name: routine?.name ?? defaultWorkoutName(now),
      startedAt: now,
      endedAt: null,
      routineId: routine?.id,
      exercises: (routine?.exercises ?? []).map((we) => ({
        ...we,
        id: uid(),
        sets: we.sets.map((st) => ({ ...st, id: uid(), done: false })),
      })),
    };
    return { ...s, active: w, rest: null };
  });
  go('active');
}

export function WorkoutTab() {
  const { state, update, exMap } = useStore();
  const { active, routines, workouts } = state;
  const now = useNow(1000, !!active);
  const thisWeek = workouts.filter((w) => w.endedAt && w.startedAt >= weekStart(Date.now()));
  const last = [...workouts].filter((w) => w.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0];

  return (
    <>
      <Header title={<span className="brand">Foundry</span>} />
      <main className="page">
        <section className="hero-card">
          {active ? (
            <>
              <span className="eyebrow">In progress</span>
              <h2 className="hero-title">{active.name}</h2>
              <p className="hero-clock">{fmtClock((now - active.startedAt) / 1000)}</p>
              <button className="btn btn-primary btn-wide" onClick={() => go('active')}>
                Resume workout
              </button>
            </>
          ) : (
            <>
              <span className="eyebrow">This week</span>
              <h2 className="hero-title">
                {thisWeek.length} {thisWeek.length === 1 ? 'workout' : 'workouts'}
                <span className="muted hero-sub"> · {fmtVolume(thisWeek.reduce((t, w) => t + workoutVolume(w), 0), state.settings.unit)} lifted</span>
              </h2>
              {last && (
                <p className="muted small">
                  Last: {last.name}, {fmtDate(last.startedAt)} ({fmtDuration(last.endedAt! - last.startedAt)})
                </p>
              )}
              <button className="btn btn-primary btn-wide" onClick={() => startWorkout(update)}>
                <Icon name="plus" size={18} /> Start empty workout
              </button>
            </>
          )}
        </section>

        <div className="section-head">
          <h2>Routines</h2>
          <button className="btn btn-small" onClick={() => go('r/new')}>
            <Icon name="plus" size={16} /> New
          </button>
        </div>
        {!routines.length && (
          <div className="empty-card">
            <p>Routines are workout templates. Create one for each training day, then start it in one tap.</p>
          </div>
        )}
        <ul className="routine-list">
          {routines.map((r) => (
            <li key={r.id} className="routine">
              <button className="routine-body" onClick={() => go('r/' + r.id)} aria-label={`Edit ${r.name}`}>
                <span className="routine-name">{r.name}</span>
                <span className="muted small routine-ex">
                  {r.exercises.map((we) => exerciseName(exMap, we.exerciseId)).join(', ') || 'No exercises yet'}
                </span>
              </button>
              <button
                className="btn btn-small btn-primary"
                disabled={!!active || !r.exercises.length}
                onClick={() => startWorkout(update, r)}
              >
                Start
              </button>
            </li>
          ))}
        </ul>
        {active && routines.length > 0 && <p className="muted small">Finish the workout in progress to start a routine.</p>}
      </main>
    </>
  );
}
