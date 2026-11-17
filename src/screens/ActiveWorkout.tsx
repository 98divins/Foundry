import { useEffect, useRef, useState } from 'react';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Confirm, Header, Icon, Sheet, Stat } from '../components/ui';
import { go, primeAudio, restDoneAlert, useNow, useWakeLock } from '../hooks';
import { useStore } from '../store';
import type { SetEntry, Workout, WorkoutExercise } from '../types';
import { fmtClock, fmtVolume, hasEntry, workoutElapsed, workoutSetCount, workoutVolume } from '../utils';
import { t, tp } from '../i18n';

export function ActiveWorkout() {
  const { state, update, exMap } = useStore();
  const w = state.active;
  const now = useNow(500, !!w);
  const [confirm, setConfirm] = useState<null | 'finish' | 'empty' | 'discard'>(null);
  useWakeLock(!!w && (state.settings.keepAwake ?? true));

  // Fire the rest alert once when the countdown crosses zero. When the phone was locked or the
  // app was in the background, the alert could not play: say so as soon as the user is back.
  const alerted = useRef<number | null>(null);
  const [missedAt, setMissedAt] = useState<number | null>(null);
  useEffect(() => {
    const r = state.rest;
    if (!r || r.pausedLeft != null || now < r.endsAt || alerted.current === r.endsAt) return;
    alerted.current = r.endsAt;
    if (now - r.endsAt < 5000) restDoneAlert(state.settings.sound);
    else {
      setMissedAt(r.endsAt);
      navigator.vibrate?.([300, 120, 300]);
    }
    update((s) => ({ ...s, rest: null }));
  }, [now, state.rest, state.settings.sound, update]);

  if (!w) {
    return (
      <>
        <Header title={t('Workout')} onBack={() => go('', { replace: true })} />
        <main className="page">
          <div className="empty-card">
            <p>{t('No workout in progress.')}</p>
            <button className="btn btn-primary" onClick={() => go('', { replace: true })}>{t('Go to start')}</button>
          </div>
        </main>
      </>
    );
  }

  const setW = (fn: (w: Workout) => Workout) => update((s) => (s.active ? { ...s, active: fn(s.active) } : s));
  const sets = w.exercises.flatMap((we) => we.sets);
  const doneCount = sets.filter((s) => s.done).length;
  const isFilled = (we: WorkoutExercise, s: SetEntry) => hasEntry(s, exMap.get(we.exerciseId)?.kind ?? 'weight');
  // Sets with numbers typed in but not ticked: saved too if the user says so.
  const filledCount = w.exercises.reduce((n, we) => n + we.sets.filter((s) => !s.done && isFilled(we, s)).length, 0);
  const emptyCount = sets.length - doneCount - filledCount;

  /** Saves ticked sets, plus typed-in ones when includeFilled; untouched sets and exercises are dropped. */
  const finish = (includeFilled: boolean) => {
    update((s) => {
      if (!s.active) return s;
      const elapsed = workoutElapsed(s.active);
      const done: Workout = {
        ...s.active,
        // Recorded duration leaves out pauses.
        endedAt: s.active.startedAt + elapsed,
        hideFromFeed: s.settings.postWorkouts === false || undefined,
        pausedAt: null,
        pausedMs: 0,
        exercises: s.active.exercises
          .map((we) => ({
            ...we,
            sets: we.sets
              .filter((x) => x.done || (includeFilled && isFilled(we, x)))
              .map((x) => ({ ...x, done: true })),
          }))
          .filter((we) => we.sets.length),
      };
      return { ...s, active: null, rest: null, workouts: [...s.workouts, done] };
    });
    go('w/' + w.id + '/done', { replace: true });
  };
  const discard = () => {
    update((s) => ({ ...s, active: null, rest: null }));
    go('', { replace: true });
  };

  const rest = state.rest;
  const restPaused = rest?.pausedLeft != null;
  const restLeft = rest ? Math.max(0, Math.ceil((restPaused ? rest.pausedLeft! : rest.endsAt - now) / 1000)) : 0;
  const paused = w.pausedAt != null;
  const togglePause = () =>
    setW((x) =>
      x.pausedAt != null
        ? { ...x, pausedMs: (x.pausedMs ?? 0) + (Date.now() - x.pausedAt), pausedAt: null }
        : { ...x, pausedAt: Date.now() },
    );
  const toggleRestPause = () =>
    update((s) => {
      if (!s.rest) return s;
      return s.rest.pausedLeft != null
        ? { ...s, rest: { ...s.rest, endsAt: Date.now() + s.rest.pausedLeft, pausedLeft: null } }
        : { ...s, rest: { ...s.rest, pausedLeft: Math.max(0, s.rest.endsAt - Date.now()) } };
    });

  return (
    <>
      <Header
        title={
          <input
            id="workout-name"
            className="title-input"
            aria-label={t('Workout name')}
            value={w.name}
            onChange={(e) => setW((x) => ({ ...x, name: e.target.value }))}
          />
        }
        onBack={() => go('')}
        right={
          <button
            className="btn btn-primary btn-small"
            onClick={() => {
              if (doneCount === 0 && filledCount === 0) setConfirm('empty');
              else if (doneCount < sets.length) setConfirm('finish');
              else finish(false);
            }}
          >{t('Finish')}</button>
        }
      />
      <main className={'page' + (rest || missedAt ? ' has-rest' : '')}>
        <div className="stats-row">
          <button className={'stat stat-btn' + (paused ? ' paused' : '')} onClick={togglePause} aria-label={paused ? t('Resume the workout timer') : t('Pause the workout timer')}>
            <span className="stat-label">{paused ? t('Paused') : t('Duration')}</span>
            <span className="stat-value">
              <Icon name={paused ? 'play' : 'pause'} size={16} /> {fmtClock(workoutElapsed(w, now) / 1000)}
            </span>
          </button>
          <Stat label={t('Volume')} value={fmtVolume(workoutVolume(w), state.settings.unit)} />
          <Stat label={t('Sets')} value={workoutSetCount(w)} />
        </div>
        <WorkoutEditor
          exercises={w.exercises}
          mode="live"
          before={w.startedAt}
          onChange={(exercises) => setW((x) => ({ ...x, exercises }))}
          onSetCompleted={(we) => {
            primeAudio();
            setMissedAt(null);
            if (we.restSec > 0) update((s) => ({ ...s, rest: { endsAt: Date.now() + we.restSec * 1000, total: we.restSec } }));
          }}
        />
        <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirm('discard')}>{t('Discard workout')}</button>
      </main>

      {!rest && missedAt && (
        <div className="rest-bar rest-missed" role="alert">
          <div className="rest-time">
            <span className="eyebrow">{t('Rest is over')}</span>
            <span className="rest-clock">{t('{0} ago', { 0: fmtClock((now - missedAt) / 1000) })}</span>
          </div>
          <button className="btn btn-small btn-primary" onClick={() => setMissedAt(null)}>{t('Got it')}</button>
        </div>
      )}
      {rest && (
        <div className="rest-bar" role="timer" aria-live="off">
          <div className="rest-progress" style={{ transform: `scaleX(${restLeft / rest.total})` }} />
          <button
            className="btn btn-small"
            onClick={() => update((s) => (s.rest ? (s.rest.pausedLeft != null ? { ...s, rest: { ...s.rest, pausedLeft: Math.max(0, s.rest.pausedLeft - 15000) } } : { ...s, rest: { ...s.rest, endsAt: s.rest.endsAt - 15000 } }) : s))}
          >
            −15s
          </button>
          <button className="rest-time rest-toggle" onClick={toggleRestPause} aria-label={restPaused ? t('Resume rest') : t('Pause rest')}>
            <span className="eyebrow">
              {restPaused ? t('Rest paused') : t('Rest')} <Icon name={restPaused ? 'play' : 'pause'} size={11} />
            </span>
            <span className="rest-clock">{fmtClock(restLeft)}</span>
          </button>
          <button
            className="btn btn-small"
            onClick={() =>
              update((s) => (s.rest ? (s.rest.pausedLeft != null ? { ...s, rest: { ...s.rest, pausedLeft: s.rest.pausedLeft + 15000, total: s.rest.total + 15 } } : { ...s, rest: { ...s.rest, endsAt: s.rest.endsAt + 15000, total: s.rest.total + 15 } }) : s))
            }
          >
            +15s
          </button>
          <button className="btn btn-small btn-primary" onClick={() => update((s) => ({ ...s, rest: null }))}>{t('Skip')}</button>
        </div>
      )}

      <Sheet open={confirm === 'finish'} onClose={() => setConfirm(null)} title={t('Finish workout?')}>
        <div className="finish-summary">
          <p>
            {t('{done} of {n} sets ticked', { done: doneCount, n: sets.length })}
            {filledCount > 0 && tp(filledCount, ', {n} set filled in but not ticked', ', {n} sets filled in but not ticked')}.
          </p>
          {emptyCount > 0 && (
            <p className="muted small">
              {tp(emptyCount, '{n} empty set will be left out, along with exercises you did not start. Nothing you logged is lost.', '{n} empty sets will be left out, along with exercises you did not start. Nothing you logged is lost.')}</p>
          )}
        </div>
        <div className="menu">
          {filledCount > 0 && (
            <button
              className="btn btn-primary btn-wide"
              onClick={() => {
                setConfirm(null);
                finish(true);
              }}
            >{tp(filledCount, 'Finish and save the {n} filled set too', 'Finish and save the {n} filled sets too')}</button>
          )}
          {doneCount > 0 && (
            <button
              className={'btn btn-wide' + (filledCount > 0 ? '' : ' btn-primary')}
              onClick={() => {
                setConfirm(null);
                finish(false);
              }}
            >
              {filledCount > 0 ? t('Finish with ticked sets only') : t('Finish workout')}
            </button>
          )}
          <button className="btn btn-ghost btn-wide" onClick={() => setConfirm(null)}>{t('Keep training')}</button>
        </div>
      </Sheet>
      <Confirm
        open={confirm === 'empty'}
        title={t('Nothing logged yet')}
        message={t('No set has numbers in it, so there is nothing to save. Log a set first, or discard this workout.')}
        confirmLabel={t('Discard workout')}
        danger
        onConfirm={discard}
        onClose={() => setConfirm(null)}
      />
      <Confirm
        open={confirm === 'discard'}
        title={t('Discard workout?')}
        message={t('Everything logged in this workout will be deleted.')}
        confirmLabel={t('Discard')}
        danger
        onConfirm={discard}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
