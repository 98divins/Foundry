import { useEffect, useRef, useState } from 'react';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Confirm, Header, Stat } from '../components/ui';
import { go, primeAudio, restDoneAlert, useNow, useWakeLock } from '../hooks';
import { useStore } from '../store';
import type { Workout } from '../types';
import { fmtClock, fmtVolume, workoutSetCount, workoutVolume } from '../utils';

export function ActiveWorkout() {
  const { state, update } = useStore();
  const w = state.active;
  const now = useNow(500, !!w);
  const [confirm, setConfirm] = useState<null | 'finish' | 'empty' | 'discard'>(null);
  useWakeLock(!!w);

  // Fire the rest alert once when the countdown crosses zero.
  const alerted = useRef<number | null>(null);
  useEffect(() => {
    const r = state.rest;
    if (!r || now < r.endsAt || alerted.current === r.endsAt) return;
    alerted.current = r.endsAt;
    if (now - r.endsAt < 5000) restDoneAlert(state.settings.sound);
    update((s) => ({ ...s, rest: null }));
  }, [now, state.rest, state.settings.sound, update]);

  if (!w) {
    return (
      <>
        <Header title="Workout" onBack={() => go('', { replace: true })} />
        <main className="page">
          <div className="empty-card">
            <p>No workout in progress.</p>
            <button className="btn btn-primary" onClick={() => go('', { replace: true })}>
              Go to start
            </button>
          </div>
        </main>
      </>
    );
  }

  const setW = (fn: (w: Workout) => Workout) => update((s) => (s.active ? { ...s, active: fn(s.active) } : s));
  const sets = w.exercises.flatMap((we) => we.sets);
  const doneCount = sets.filter((s) => s.done).length;

  const finish = () => {
    update((s) => {
      if (!s.active) return s;
      const done: Workout = {
        ...s.active,
        endedAt: Date.now(),
        exercises: s.active.exercises
          .map((we) => ({ ...we, sets: we.sets.filter((x) => x.done) }))
          .filter((we) => we.sets.length),
      };
      return { ...s, active: null, rest: null, workouts: [...s.workouts, done] };
    });
    go('w/' + w.id, { replace: true });
  };
  const discard = () => {
    update((s) => ({ ...s, active: null, rest: null }));
    go('', { replace: true });
  };

  const rest = state.rest;
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;

  return (
    <>
      <Header
        title={
          <input
            id="workout-name"
            className="title-input"
            aria-label="Workout name"
            value={w.name}
            onChange={(e) => setW((x) => ({ ...x, name: e.target.value }))}
          />
        }
        onBack={() => go('')}
        right={
          <button
            className="btn btn-primary btn-small"
            onClick={() => {
              if (doneCount === 0) setConfirm('empty');
              else if (doneCount < sets.length) setConfirm('finish');
              else finish();
            }}
          >
            Finish
          </button>
        }
      />
      <main className={'page' + (rest ? ' has-rest' : '')}>
        <div className="stats-row">
          <Stat label="Duration" value={fmtClock((now - w.startedAt) / 1000)} />
          <Stat label="Volume" value={fmtVolume(workoutVolume(w), state.settings.unit)} />
          <Stat label="Sets" value={workoutSetCount(w)} />
        </div>
        <WorkoutEditor
          exercises={w.exercises}
          mode="live"
          before={w.startedAt}
          onChange={(exercises) => setW((x) => ({ ...x, exercises }))}
          onSetCompleted={(we) => {
            primeAudio();
            if (we.restSec > 0) update((s) => ({ ...s, rest: { endsAt: Date.now() + we.restSec * 1000, total: we.restSec } }));
          }}
        />
        <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirm('discard')}>
          Discard workout
        </button>
      </main>

      {rest && (
        <div className="rest-bar" role="timer" aria-live="off">
          <div className="rest-progress" style={{ transform: `scaleX(${restLeft / rest.total})` }} />
          <button
            className="btn btn-small"
            onClick={() => update((s) => (s.rest ? { ...s, rest: { ...s.rest, endsAt: s.rest.endsAt - 15000 } } : s))}
          >
            −15s
          </button>
          <div className="rest-time">
            <span className="eyebrow">Rest</span>
            <span className="rest-clock">{fmtClock(restLeft)}</span>
          </div>
          <button
            className="btn btn-small"
            onClick={() =>
              update((s) => (s.rest ? { ...s, rest: { endsAt: s.rest.endsAt + 15000, total: s.rest.total + 15 } } : s))
            }
          >
            +15s
          </button>
          <button className="btn btn-small btn-primary" onClick={() => update((s) => ({ ...s, rest: null }))}>
            Skip
          </button>
        </div>
      )}

      <Confirm
        open={confirm === 'finish'}
        title="Finish workout?"
        message={`${sets.length - doneCount} set(s) are not ticked and will be left out. Only completed sets are saved.`}
        confirmLabel="Finish"
        onConfirm={finish}
        onClose={() => setConfirm(null)}
      />
      <Confirm
        open={confirm === 'empty'}
        title="No completed sets"
        message="Tick at least one set before finishing. You can also discard this workout."
        confirmLabel="Discard workout"
        danger
        onConfirm={discard}
        onClose={() => setConfirm(null)}
      />
      <Confirm
        open={confirm === 'discard'}
        title="Discard workout?"
        message="Everything logged in this workout will be deleted."
        confirmLabel="Discard"
        danger
        onConfirm={discard}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
