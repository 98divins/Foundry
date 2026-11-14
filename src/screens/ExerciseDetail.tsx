import { useMemo, useState } from 'react';
import { LineChart } from '../components/Charts';
import { Confirm, Header, Segmented, Stat } from '../components/ui';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../exercises';
import { back, go } from '../hooks';
import { useStore } from '../store';
import { exerciseSessions, fmtDate, fmtEstimate, fmtNum, fmtVolume, fmtWeight, toDisplay, type Session } from '../utils';

type Metric = '1rm' | 'weight' | 'volume' | 'reps';

export function ExerciseDetail({ id }: { id: string }) {
  const { state, update, exMap } = useStore();
  const ex = exMap.get(id);
  const unit = state.settings.unit;
  const sessions = useMemo(() => exerciseSessions(state.workouts, id), [state.workouts, id]);
  const bodyweight = ex?.kind === 'bodyweight';
  const [metric, setMetric] = useState<Metric>(bodyweight ? 'reps' : '1rm');
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

  const pick: Record<Metric, (s: Session) => number> = {
    '1rm': (s) => s.best1rm,
    weight: (s) => s.bestWeight,
    volume: (s) => s.volume,
    reps: (s) => s.bestReps,
  };
  const best = (m: Metric) => Math.max(0, ...sessions.map(pick[m]));
  const points = sessions.map((s) => ({ x: s.date, y: m2display(pick[metric](s)) }));
  function m2display(v: number) {
    return metric === 'reps' ? v : toDisplay(v, unit);
  }
  const fmtAxis = (v: number) => (metric === 'reps' ? String(v) : v >= 10000 ? `${fmtNum(v / 1000)}k` : fmtNum(v));
  const recent = [...sessions].reverse().slice(0, 12);

  return (
    <>
      <Header title={ex.name} onBack={() => back('exercises')} />
      <main className="page">
        <p className="muted small">
          {MUSCLE_LABEL[ex.muscle]} · {EQUIPMENT_LABEL[ex.equipment]}
          {ex.custom && ' · Custom'}
        </p>

        <div className="stats-row">
          {!bodyweight && <Stat label="Heaviest" value={fmtWeight(best('weight') || null, unit)} />}
          {!bodyweight && <Stat label="Best est. 1RM" value={fmtEstimate(best('1rm'), unit)} />}
          <Stat label="Most reps" value={best('reps') || '–'} />
          <Stat label="Sessions" value={sessions.length} />
        </div>

        <section className="panel">
          <Segmented<Metric>
            label="Chart metric"
            value={metric}
            onChange={setMetric}
            options={[
              ...(bodyweight ? [] : [
                { value: '1rm' as const, label: 'Est. 1RM' },
                { value: 'weight' as const, label: 'Heaviest' },
              ]),
              { value: 'volume', label: 'Volume' },
              { value: 'reps', label: 'Reps' },
            ]}
          />
          <LineChart points={points} format={fmtAxis} />
          <p className="muted small">
            {metric === '1rm' && 'Estimated one-rep max per workout (Epley formula, best set).'}
            {metric === 'weight' && `Heaviest completed set per workout, in ${unit}.`}
            {metric === 'volume' && `Weight × reps summed over working sets, in ${unit}.`}
            {metric === 'reps' && 'Most reps in a single set per workout.'}
          </p>
        </section>

        <h2 className="section-title">Recent sessions</h2>
        {!recent.length && <p className="muted">No completed sets yet. Add this exercise to a workout to start tracking it.</p>}
        <ul className="session-list">
          {recent.map((s) => (
            <li key={s.workoutId}>
              <button className="session" onClick={() => go('w/' + s.workoutId)}>
                <span className="session-date">{fmtDate(s.date)}</span>
                <span className="session-sets small">
                  {s.sets
                    .map((x) => (x.weight ? `${fmtNum(toDisplay(x.weight, unit))}×${x.reps}` : `${x.reps} reps`))
                    .join('  ·  ')}
                </span>
                <span className="muted small">{fmtVolume(s.volume, unit)}</span>
              </button>
            </li>
          ))}
        </ul>

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
            ? `“${ex.name}” appears in ${sessions.length} workout(s). Those sets stay in your history but will show as “Deleted exercise”.`
            : `“${ex.name}” will be removed from your library.`
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
