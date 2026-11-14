import { useMemo, useState } from 'react';
import { LineChart } from '../components/Charts';
import { ExerciseImage } from '../components/ExerciseImage';
import { Confirm, Header, Segmented, Stat } from '../components/ui';
import { equipmentLabel, muscleLabel } from '../exercises';
import { back, go } from '../hooks';
import { useStore } from '../store';
import type { ExerciseKind } from '../types';
import {
  exerciseSessions,
  fmtClock,
  fmtDate,
  fmtEstimate,
  fmtKm,
  fmtNum,
  fmtSet,
  fmtVolume,
  fmtWeight,
  toDisplay,
  type Session,
} from '../utils';

type Metric = '1rm' | 'weight' | 'volume' | 'reps' | 'duration' | 'distance' | 'time';

const METRICS: Record<ExerciseKind, Metric[]> = {
  weight: ['1rm', 'weight', 'volume', 'reps'],
  bodyweight: ['reps', 'volume'],
  assisted: ['reps'],
  duration: ['duration'],
  cardio: ['distance', 'time'],
};
const METRIC_LABEL: Record<Metric, string> = {
  '1rm': 'Est. 1RM',
  weight: 'Heaviest',
  volume: 'Volume',
  reps: 'Reps',
  duration: 'Longest',
  distance: 'Distance',
  time: 'Time',
};

export function ExerciseDetail({ id }: { id: string }) {
  const { state, update, exMap } = useStore();
  const ex = exMap.get(id);
  const unit = state.settings.unit;
  const lang = state.settings.exerciseLang;
  const sessions = useMemo(() => exerciseSessions(state.workouts, id), [state.workouts, id]);
  const kind: ExerciseKind = ex?.kind ?? 'weight';
  const [metric, setMetric] = useState<Metric>(METRICS[kind][0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!ex) {
    return (
      <>
        <Header title="Exercise" onBack={() => back('exercises')} />
        <main className="page">
          <p className="muted">This exercise was deleted.</p>
        </main>
      </>
    );
  }

  const label = ex.label ?? ex.name;
  const pick: Record<Metric, (s: Session) => number> = {
    '1rm': (s) => s.best1rm,
    weight: (s) => s.bestWeight,
    volume: (s) => s.volume,
    reps: (s) => s.bestReps,
    duration: (s) => s.bestDuration,
    distance: (s) => s.totalDistance,
    time: (s) => s.totalDuration,
  };
  const best = (m: Metric) => Math.max(0, ...sessions.map(pick[m]));
  const isLoad = metric === '1rm' || metric === 'weight' || metric === 'volume';
  const isTime = metric === 'duration' || metric === 'time';
  const toChart = (v: number) => (isLoad ? toDisplay(v, unit) : isTime ? v / 60 : v);
  const points = sessions.map((s) => ({ x: s.date, y: toChart(pick[metric](s)) }));
  const fmtAxis = (v: number) =>
    isTime ? fmtClock(v * 60) : v >= 10000 ? `${fmtNum(v / 1000)}k` : fmtNum(v);
  const recent = [...sessions].reverse().slice(0, 12);
  const otherName = lang === 'fr' ? ex.name : ex.nameFr;

  return (
    <>
      <Header title={label} onBack={() => back('exercises')} />
      <main className="page">
        {ex.image && (
          <div className="photo-pair">
            <ExerciseImage ex={ex} label={label} size="large" frame={0} />
            <ExerciseImage ex={ex} label={label} size="large" frame={1} />
          </div>
        )}
        <p className="muted small">
          {muscleLabel(ex.muscle, lang)} · {equipmentLabel(ex.equipment, lang)}
          {ex.custom && ' · Custom'}
          {otherName && otherName !== label && <> · {otherName}</>}
        </p>

        <div className="stats-row">
          {kind === 'weight' && <Stat label="Heaviest" value={fmtWeight(best('weight') || null, unit)} />}
          {kind === 'weight' && <Stat label="Best est. 1RM" value={fmtEstimate(best('1rm'), unit)} />}
          {(kind === 'weight' || kind === 'bodyweight' || kind === 'assisted') && (
            <Stat label="Most reps" value={best('reps') || '–'} />
          )}
          {kind === 'bodyweight' && <Stat label="Most added" value={best('weight') ? fmtWeight(best('weight'), unit) : '–'} />}
          {kind === 'duration' && <Stat label="Longest" value={best('duration') ? fmtClock(best('duration')) : '–'} />}
          {kind === 'cardio' && <Stat label="Longest distance" value={best('distance') ? fmtKm(best('distance')) : '–'} />}
          {kind === 'cardio' && <Stat label="Longest session" value={best('time') ? fmtClock(best('time')) : '–'} />}
          <Stat label="Sessions" value={sessions.length} />
        </div>

        <section className="panel">
          {METRICS[kind].length > 1 && (
            <Segmented<Metric>
              label="Chart metric"
              value={metric}
              onChange={setMetric}
              options={METRICS[kind].map((m) => ({ value: m, label: METRIC_LABEL[m] }))}
            />
          )}
          <LineChart points={points} format={fmtAxis} />
          <p className="muted small">
            {metric === '1rm' && 'Estimated one-rep max per workout (Epley formula, best set).'}
            {metric === 'weight' && `Heaviest completed set per workout, in ${unit}.`}
            {metric === 'volume' && `Weight × reps summed over working sets, in ${unit}.`}
            {metric === 'reps' && 'Most reps in a single set per workout.'}
            {metric === 'duration' && 'Longest set per workout.'}
            {metric === 'distance' && 'Total distance per workout, in km.'}
            {metric === 'time' && 'Total time per workout.'}
          </p>
        </section>

        <h2 className="section-title">Recent sessions</h2>
        {!recent.length && <p className="muted">No completed sets yet. Add this exercise to a workout to start tracking it.</p>}
        <ul className="session-list">
          {recent.map((s) => (
            <li key={s.workoutId}>
              <button className="session" onClick={() => go('w/' + s.workoutId)}>
                <span className="session-date">{fmtDate(s.date)}</span>
                <span className="session-sets small">{s.sets.map((x) => fmtSet(x, kind, unit)).join('  ·  ')}</span>
                {s.volume > 0 && <span className="muted small">{fmtVolume(s.volume, unit)}</span>}
              </button>
            </li>
          ))}
        </ul>

        {ex.image && (
          <p className="muted small credit">
            Photos: Free Exercise DB (public domain). They show the movement and may differ slightly from your variation.
          </p>
        )}

        {ex.custom && (
          <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmDelete(true)}>
            Delete custom exercise
          </button>
        )}
      </main>
      <Confirm
        open={confirmDelete}
        title="Delete exercise?"
        message={
          sessions.length
            ? `“${label}” appears in ${sessions.length} workout(s). Those sets stay in your history but will show as “Deleted exercise”.`
            : `“${label}” will be removed from your library.`
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          update((s) => ({ ...s, customExercises: s.customExercises.filter((e) => e.id !== id) }));
          go('exercises', { replace: true });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
