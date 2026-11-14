import { useMemo, useState } from 'react';
import {
  crossInsights,
  liftTrends,
  muscleSets,
  recentPRs,
  strengthIndexByWeek,
  volumeStatus,
  weeklyDiet,
  weeklyTraining,
  weekStarts,
} from '../analytics';
import { BarChart, LineChart, Sparkline } from '../components/Charts';
import { ExerciseImage } from '../components/ExerciseImage';
import { Header, Icon, Segmented, Stat } from '../components/ui';
import { muscleLabel } from '../exercises';
import { go } from '../hooks';
import { exerciseName, useStore } from '../store';
import type { Muscle, PRKind } from '../types';
import { computePRs, exerciseKind, fmtDate, fmtEstimate, fmtSet, fmtVolume, toDisplay, weekStart } from '../utils';

const DAY = 86400000;
const PR_LABEL: Record<PRKind, string> = {
  weight: 'Heaviest',
  '1rm': 'Best 1RM',
  volume: 'Best set volume',
  reps: 'Most reps',
  duration: 'Longest',
  distance: 'Farthest',
};

type WeekMetric = 'workouts' | 'sets' | 'volume';

export function Progress() {
  const { state, exMap } = useStore();
  const { workouts, settings, nutrition } = state;
  const unit = settings.unit;
  const lang = settings.exerciseLang;
  const [metric, setMetric] = useState<WeekMetric>('sets');
  const [muscleRange, setMuscleRange] = useState<'week' | 'avg'>('avg');

  const starts = useMemo(() => weekStarts(12), []);
  const training = useMemo(() => weeklyTraining(workouts, starts), [workouts, starts]);
  const index = useMemo(() => strengthIndexByWeek(workouts, starts), [workouts, starts]);
  const lifts = useMemo(() => liftTrends(workouts), [workouts]);
  const prs = useMemo(() => recentPRs(workouts, computePRs(workouts), 30), [workouts]);
  const diet = useMemo(() => weeklyDiet(nutrition, starts), [nutrition, starts]);
  const proteinGoal = nutrition.proteinPerKg;
  const insights = useMemo(() => crossInsights(index, diet, proteinGoal), [index, diet, proteinGoal]);

  const done = workouts.filter((w) => w.endedAt);
  const thisWeek = training[training.length - 1];
  const streak = (() => {
    let n = 0;
    let i = training.length - 1;
    if (!training[i].workouts) i--;
    while (i >= 0 && training[i].workouts) {
      n++;
      i--;
    }
    return n;
  })();

  // Sets per muscle: this week, or the average of the last 4 full weeks.
  const muscles = useMemo(() => {
    const now = Date.now();
    const m =
      muscleRange === 'week'
        ? muscleSets(workouts, exMap, weekStart(now), now + DAY)
        : muscleSets(workouts, exMap, starts[starts.length - 5], starts[starts.length - 1]);
    const div = muscleRange === 'week' ? 1 : 4;
    return [...m.entries()]
      .map(([k, v]) => [k, Math.round((v / div) * 10) / 10] as [Muscle, number])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [workouts, exMap, starts, muscleRange]);
  const maxMuscle = Math.max(20, ...muscles.map((m) => m[1]));

  const weekLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' });
  const bars = training.map((w) => ({
    label: weekLabel(w.start),
    value: metric === 'workouts' ? w.workouts : metric === 'sets' ? w.sets : Math.round(toDisplay(w.volume, unit) / 1000),
  }));
  const indexPoints = starts
    .map((t, i) => ({ x: t, y: index[i] }))
    .filter((p): p is { x: number; y: number } => p.y != null);
  const hasDiet = diet.some((d) => d.loggedDays > 0);
  const dietRows = starts
    .map((t, i) => ({ t, d: diet[i], idx: index[i], tr: training[i] }))
    .slice(-8)
    .reverse();

  if (!done.length) {
    return (
      <>
        <ProgressHeader />
        <main className="page">
          <div className="empty-card">
            <Icon name="chart" size={28} />
            <p>Your progress shows here after your first finished workout: strength trends, weekly volume, records and how your diet affects them.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <ProgressHeader />
      <main className="page">
        <div className="stats-row">
          <Stat label="This week" value={`${thisWeek.workouts} workout${thisWeek.workouts === 1 ? '' : 's'}`} />
          <Stat label="Week streak" value={streak} />
          <Stat label="Sets this week" value={thisWeek.sets} />
          <Stat label="Workouts" value={done.length} />
        </div>

        <section className="panel">
          <h2 className="panel-title">Strength</h2>
          {indexPoints.length >= 2 ? (
            <>
              <LineChart points={indexPoints} format={(v) => String(Math.round(v))} />
              <p className="muted small">
                Strength index: each lift’s best estimated 1RM of the week as a % of your first session with it, averaged.
                100 = where you started.
              </p>
            </>
          ) : (
            <p className="muted small">Train for two weeks to see your strength index.</p>
          )}
          <ul className="lift-list">
            {lifts.map((l) => (
              <li key={l.exerciseId}>
                <button className="lift-row" onClick={() => go('e/' + l.exerciseId)}>
                  <ExerciseImage ex={exMap.get(l.exerciseId)} label={exerciseName(exMap, l.exerciseId)} />
                  <span className="lift-text">
                    <span className="entry-name">{exerciseName(exMap, l.exerciseId)}</span>
                    <span className="muted small">
                      Est. 1RM {fmtEstimate(l.current, unit)} · {l.sessions} sessions
                    </span>
                  </span>
                  <Sparkline values={l.points.slice(-12).map((p) => p.e1rm)} width={56} height={28} />
                  {l.changePct != null && (
                    <span className={'delta ' + (l.changePct > 0 ? 'up' : l.changePct < 0 ? 'down' : '')}>
                      {l.changePct > 0 ? '+' : ''}
                      {l.changePct}%
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {!lifts.length && <p className="muted small">Log a lift with weight in 3 workouts to see its trend.</p>}
        </section>

        <section className="panel">
          <h2 className="panel-title">Training per week</h2>
          <Segmented<WeekMetric>
            label="Weekly metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'sets', label: 'Sets' },
              { value: 'workouts', label: 'Workouts' },
              { value: 'volume', label: unit === 'kg' ? 'Volume (t)' : 'Volume (k lb)' },
            ]}
          />
          <BarChart bars={bars} />
        </section>

        <section className="panel">
          <h2 className="panel-title">Sets per muscle</h2>
          <Segmented
            label="Period"
            value={muscleRange}
            onChange={setMuscleRange}
            options={[
              { value: 'avg', label: 'Avg of last 4 weeks' },
              { value: 'week', label: 'This week' },
            ]}
          />
          {!muscles.length && <p className="muted small">No working sets in this period.</p>}
          <ul className="muscle-bars graded">
            {muscles.map(([m, n]) => {
              const status = volumeStatus(n);
              return (
                <li key={m}>
                  <span className="muscle-name">{muscleLabel(m, lang)}</span>
                  <span className="muscle-track">
                    <span className="muscle-zone" style={{ left: `${(10 / maxMuscle) * 100}%`, width: `${(10 / maxMuscle) * 100}%` }} />
                    <span className={'muscle-fill ' + status} style={{ width: `${(n / maxMuscle) * 100}%` }} />
                  </span>
                  <span className="muscle-n">{n}</span>
                </li>
              );
            })}
          </ul>
          <p className="muted small">
            The two marks show 10 and 20 hard sets a week, a common range for muscle growth: green inside, grey below,
            orange above. Primary muscle only.
          </p>
        </section>

        <section className="panel">
          <h2 className="panel-title">Records, last 30 days</h2>
          {!prs.length && <p className="muted small">No new record in the last 30 days.</p>}
          <ul className="pr-list">
            {prs.slice(0, 10).map((p) => (
              <li key={p.set.id}>
                <button className="lift-row" onClick={() => go('w/' + p.workoutId)}>
                  <Icon name="trophy" size={18} />
                  <span className="lift-text">
                    <span className="entry-name">{exerciseName(exMap, p.exerciseId)}</span>
                    <span className="muted small">
                      {fmtSet(p.set, exerciseKind(p.exerciseId), unit)} · {p.kinds.map((k) => PR_LABEL[k]).join(', ')}
                    </span>
                  </span>
                  <span className="muted small">{fmtDate(p.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2 className="panel-title">Diet × training</h2>
          {!hasDiet ? (
            <>
              <p className="muted small">
                Log your meals and weight in the Nutrition tab to see how calories, protein and weight change line up with
                your strength.
              </p>
              <button className="btn" onClick={() => go('n')}>
                Open Nutrition
              </button>
            </>
          ) : (
            <>
              {insights.map((i) => (
                <div key={i.title} className="insight">
                  <strong>{i.title}</strong>
                  <span className="small">{i.detail}</span>
                </div>
              ))}
              {!insights.length && (
                <p className="muted small">
                  Insights appear after about 5 weeks with both workouts and at least 4 logged days a week. Until then,
                  compare the weeks below.
                </p>
              )}
              <div className="table-scroll">
                <table className="diet-table">
                  <thead>
                    <tr>
                      <th>Week of</th>
                      <th>kcal/day</th>
                      <th>Protein</th>
                      <th>Weight</th>
                      <th>Sets</th>
                      <th>Strength</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dietRows.map(({ t, d, idx, tr }) => (
                      <tr key={t}>
                        <td>{weekLabel(t)}</td>
                        <td>{d.avgKcal ?? '–'}</td>
                        <td>{d.proteinPerKg != null ? `${d.proteinPerKg} g/kg` : '–'}</td>
                        <td>
                          {d.weightChange != null
                            ? `${d.weightChange > 0 ? '+' : ''}${Math.round(toDisplay(d.weightChange, unit) * 10) / 10} ${unit}`
                            : '–'}
                        </td>
                        <td>{tr.sets || '–'}</td>
                        <td>{idx ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                Averages use fully logged days only. These are patterns in your own data, not proof of cause.
              </p>
            </>
          )}
        </section>

        <p className="muted small center">
          {fmtVolume(training.reduce((t, w) => t + w.volume, 0), unit)} lifted in the last 12 weeks
        </p>
      </main>
    </>
  );
}

function ProgressHeader() {
  return (
    <Header
      title="Progress"
      right={
        <button className="icon-btn" aria-label="Settings" onClick={() => go('settings')}>
          <Icon name="gear" />
        </button>
      }
    />
  );
}
