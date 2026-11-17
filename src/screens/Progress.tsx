import { useMemo, useState } from 'react';
import {
  crossInsights,
  strengthBreakdown,
  liftTrends,
  groupSets,
  MUSCLE_GROUPS,
  type MuscleGroup,
  recentPRs,
  strengthIndexByWeek,
  weeklyDiet,
  weeklyTraining,
  weekStarts,
  weekStreak,
} from '../analytics';
import { GoalsCard } from './Goals';
import { BarChart, LineChart, Sparkline } from '../components/Charts';
import { ExerciseImage } from '../components/ExerciseImage';
import { Header, Icon, Segmented } from '../components/ui';
import { Avatar } from './Settings';
import { areaLabel } from '../exercises';
import { go } from '../hooks';
import { exerciseName, useStore } from '../store';
import type { PRKind } from '../types';
import { computePRs, exerciseKind, fmtDate, fmtEstimate, fmtSet, fmtVolume, toDisplay, weekStart } from '../utils';
import { locale, t, tk } from '../i18n';
import { gearCount } from '../gear';
import { useProgression } from './Levels';
import { BADGES } from '../levels';
import { YearReviewCard } from './YearReview';
import { ChallengesPanel } from './Challenges';
import { useFeature } from '../features';
import { DietStrengthCard, Phases } from '../components/DietStrength';
import { PeriodPicker, PRESETS_LONG, usePeriod } from '../components/PeriodPicker';
import { weeksIn } from '../period';

const DAY = 86400000;
const PR_LABEL: Record<PRKind, string> = {
  weight: tk('Heaviest'),
  '1rm': tk('Best 1RM'),
  volume: tk('Best set volume'),
  reps: tk('Most reps'),
  duration: tk('Longest'),
  distance: tk('Farthest'),
};

type WeekMetric = 'days' | 'workouts' | 'sets' | 'volume';

export function Progress() {
  const { state, exMap } = useStore();
  const { workouts, settings } = state;
  const unit = settings.unit;
  const [metric, setMetric] = useState<WeekMetric>('sets');
  const [muscleRange, setMuscleRange] = useState<'week' | 'avg'>('avg');
  const recapsOn = useFeature('recaps');
  const challengesOn = useFeature('challenges');

  // The chosen period drives the strength curve, the weekly chart and the records below.
  const { period, setPeriod, range, name: periodLabel } = usePeriod(91);
  const starts = useMemo(() => weeksIn(range), [range]);
  const training = useMemo(() => weeklyTraining(workouts, starts), [workouts, starts]);
  const index = useMemo(() => strengthIndexByWeek(workouts, starts), [workouts, starts]);
  const lifts = useMemo(() => liftTrends(workouts), [workouts]);
  const prs = useMemo(
    () => recentPRs(workouts, computePRs(workouts), Math.ceil((range.to - range.from) / DAY), range.to).filter((p) => p.date < range.to),
    [workouts, range],
  );
  const prs30 = useMemo(() => recentPRs(workouts, computePRs(workouts), 30), [workouts]);

  const done = workouts.filter((w) => w.endedAt);
  const thisWeek = useMemo(() => weeklyTraining(workouts, weekStarts(1))[0], [workouts]);
  const streak = useMemo(() => weekStreak(workouts).weeks, [workouts]);

  // Sets per body area: this week, or the average of the last 4 full weeks (whatever period is chosen above).
  const muscles = useMemo(() => {
    const now = Date.now();
    const last5 = weekStarts(5);
    const g = muscleRange === 'week' ? groupSets(workouts, exMap, weekStart(now), now + DAY) : groupSets(workouts, exMap, last5[0], last5[4]);
    const div = muscleRange === 'week' ? 1 : 4;
    return MUSCLE_GROUPS.map((k) => [k, Math.round((g[k] / div) * 10) / 10] as [MuscleGroup, number])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [workouts, exMap, muscleRange]);
  const maxMuscle = Math.max(1, ...muscles.map((m) => m[1]));

  const weekLabel = (t: number) => new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'numeric' });
  const bars = training.map((w) => ({
    label: weekLabel(w.start),
    value: metric === 'days' ? w.days : metric === 'workouts' ? w.workouts : metric === 'sets' ? w.sets : Math.round(toDisplay(w.volume, unit) / 1000),
  }));
  const indexPoints = starts.map((t, i) => ({ x: t, y: index[i] })).filter((p): p is { x: number; y: number } => p.y != null);
  if (!done.length) {
    return (
      <>
        <ProgressHeader />
        <main className="page">
          <ProfileHeader workouts={0} records={0} streak={0} />
          <h2 className="settings-group">{t('This week')}</h2>
          <GoalsCard />
          <div className="empty-card">
            <Icon name="chart" size={28} />
            <p>{t('Your progress shows here after your first finished workout: strength trends, weekly volume, records and how your diet affects them.')}</p>
          </div>
          <MySpace />
        </main>
      </>
    );
  }

  return (
    <>
      <ProgressHeader />
      <main className="page">
        <ProfileHeader workouts={done.length} records={prs30.length} streak={streak} />
        {recapsOn && <YearReviewCard />}

        <h2 className="settings-group">{t('This week')}</h2>
        <GoalsCard />
        {challengesOn && <ChallengesPanel compact />}
        <DietStrengthCard />
        <p className="muted small center">{t('{d} training days and {s} sets so far this week.', { d: thisWeek.days, s: thisWeek.sets })}</p>

        <h2 className="settings-group">{t('Progress')}</h2>
        <PeriodPicker id="progress" value={period} onChange={setPeriod} presets={PRESETS_LONG} />

        <section className="panel">
          <h2 className="panel-title">{t('Strength')}</h2>
          {(() => {
            // Plain reading first: where you are against your start, then the curve once there is enough of it.
            const last = indexPoints[indexPoints.length - 1];
            if (!last) return <p className="muted small">{t('Train for two weeks to see how your strength changes.')}</p>;
            const pct = Math.round(last.y - 100);
            const weeks = indexPoints.length;
            const since = new Date(indexPoints[0].x).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
            return (
              <>
                <div className="strength-head">
                  <strong className={'strength-pct ' + (pct > 0 ? 'up' : pct < 0 ? 'down' : '')}>
                    {pct > 0 ? '+' : pct < 0 ? '−' : ''}
                    {Math.abs(pct)} %
                  </strong>
                  <span className="small">
                    {pct > 0
                      ? t('stronger than your first week ({d}).', { d: since })
                      : pct < 0
                        ? t('below your first week ({d}).', { d: since })
                        : t('same level as your first week ({d}).', { d: since })}
                  </span>
                </div>
                <StrengthParts start={last.x} />
                {weeks < 4 ? (
                  <p className="muted small">
                    {t(
                      'Only {n} weeks so far: fatigue and day-to-day form move these numbers by a few % either way. The curve appears after 4 weeks, when the trend means something.',
                      { n: weeks },
                    )}
                  </p>
                ) : (
                  <>
                    <LineChart points={indexPoints} format={(v) => String(Math.round(v))} baseline={100} minSpan={20} />
                    <p className="muted small">
                      {t('The grey line is your start (100). Above it you lift more than at the start; 110 means 10 % more. Each point is a week.')}
                    </p>
                  </>
                )}
              </>
            );
          })()}
          <ul className="lift-list">
            {lifts.map((l) => (
              <li key={l.exerciseId}>
                <button className="lift-row" onClick={() => go('e/' + l.exerciseId)}>
                  <ExerciseImage ex={exMap.get(l.exerciseId)} label={exerciseName(exMap, l.exerciseId)} />
                  <span className="lift-text">
                    <span className="entry-name">{exerciseName(exMap, l.exerciseId)}</span>
                    <span className="muted small">{t('Est. 1RM {0} · {1} sessions', { 0: fmtEstimate(l.current, unit), 1: l.sessions })}</span>
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
          {!lifts.length && <p className="muted small">{t('Each exercise gets its own trend here once you have done it with weight in 3 workouts.')}</p>}
        </section>

        <section className="panel">
          <h2 className="panel-title">{t('Training per week')}</h2>
          <Segmented<WeekMetric>
            label={t('Weekly metric')}
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'sets', label: t('Sets') },
              { value: 'days', label: t('Days') },
              { value: 'workouts', label: t('Workouts') },
              { value: 'volume', label: unit === 'kg' ? t('Volume (t)') : t('Volume (k lb)') },
            ]}
          />
          <BarChart bars={bars} />
        </section>

        <section className="panel">
          <h2 className="panel-title">{t('Sets per muscle')}</h2>
          <Segmented
            label={t('Period')}
            value={muscleRange}
            onChange={setMuscleRange}
            options={[
              { value: 'avg', label: t('Avg of last 4 weeks') },
              { value: 'week', label: t('This week') },
            ]}
          />
          {!muscles.length && <p className="muted small">{t('No working sets in this period.')}</p>}
          <ul className="muscle-bars">
            {muscles.map(([m, n]) => (
              <li key={m}>
                <span className="muscle-name">{areaLabel(m)}</span>
                <span className="muscle-track">
                  <span className="muscle-fill" style={{ width: `${(n / maxMuscle) * 100}%` }} />
                </span>
                <span className="muscle-n">{n}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">{t('Working sets per body area, counted on the main muscle of each exercise.')}</p>
        </section>

        <section className="panel">
          <h2 className="panel-title">
            {t('Records')} · {periodLabel}
          </h2>
          {!prs.length && <p className="muted small">{t('No new record in this period.')}</p>}
          <ul className="pr-list">
            {prs.slice(0, 10).map((p) => (
              <li key={p.set.id}>
                <button className="lift-row" onClick={() => go('w/' + p.workoutId)}>
                  <Icon name="trophy" size={18} />
                  <span className="lift-text">
                    <span className="entry-name">{exerciseName(exMap, p.exerciseId)}</span>
                    <span className="muted small">
                      {fmtSet(p.set, exerciseKind(p.exerciseId), unit)} · {p.kinds.map((k) => t(PR_LABEL[k])).join(', ')}
                    </span>
                  </span>
                  <span className="muted small">{fmtDate(p.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <p className="muted small center">
          {t('{0} lifted in the last 12 weeks', {
            0: fmtVolume(
              training.reduce((t, w) => t + w.volume, 0),
              unit,
            ),
          })}
        </p>

        <MySpace />
      </main>
    </>
  );
}

/** The lifts behind the strength figure, each against its own first session. */
function StrengthParts({ start }: { start: number }) {
  const { state, exMap } = useStore();
  const parts = useMemo(() => strengthBreakdown(state.workouts, start), [state.workouts, start]);
  if (!parts.length) return null;
  return (
    <>
      <p className="muted small">{t('Average of the lifts you did with weight in your latest week, each compared with your first session of it:')}</p>
      <ul className="strength-parts">
        {parts.map((p) => (
          <li key={p.exerciseId}>
            <button className="link-btn" onClick={() => go('e/' + p.exerciseId)}>
              {exerciseName(exMap, p.exerciseId)}
            </button>
            <span className={'delta ' + (p.pct > 0 ? 'up' : p.pct < 0 ? 'down' : '')}>
              {p.pct > 0 ? '+' : p.pct < 0 ? '−' : ''}
              {Math.abs(p.pct)} %
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Who you are and where you stand: picture, name, level, three numbers. */
function ProfileHeader({ workouts, records, streak }: { workouts: number; records: number; streak: number }) {
  const { state } = useStore();
  const p = useProgression();
  const levelsOn = useFeature('levels');
  const pct = p.level >= 50 ? 100 : Math.round((p.intoLevel / p.levelSize) * 100);
  return (
    <section className="panel profile-head">
      <button className="profile-head-id" onClick={() => go('settings/profile')}>
        <Avatar size={64} />
        <span className="profile-card-text">
          <strong>{state.profile?.name || t('Add your name')}</strong>
          <span className="muted small">{state.profile?.bio || t('Edit profile')}</span>
        </span>
      </button>
      {levelsOn && (
        <button className="profile-head-level" onClick={() => go('levels')} aria-label={t('Level and badges')}>
          <span className="level-num" style={{ '--rank': p.rank.color } as React.CSSProperties}>
            {p.level}
          </span>
          <span className="profile-head-xp">
            <span className="small">
              <strong>{t(p.rank.name)}</strong> · {t('{a} / {b} badges', { a: p.badges.length, b: BADGES.length })}
            </span>
            <span className="xp-bar" style={{ '--rank': p.rank.color } as React.CSSProperties}>
              <span style={{ width: pct + '%' }} />
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      )}
      <span className="profile-card-stats">
        <span>
          <strong>{workouts}</strong>
          <span className="muted small">{t('Workouts')}</span>
        </span>
        <span>
          <strong className="streak-value">
            <Icon name="flame" size={18} />
            {streak}
          </strong>
          <span className="muted small">{t('Week streak')}</span>
        </span>
        <span>
          <strong>{records}</strong>
          <span className="muted small">{t('Records (30 d)')}</span>
        </span>
      </span>
    </section>
  );
}

/** Short list of the personal pages. */
function MySpace() {
  const { state } = useStore();
  const n = gearCount(state.profile?.gear);
  const on: Record<string, boolean> = { recap: useFeature('recaps'), levels: useFeature('levels'), gear: useFeature('gear') };
  type R = { icon: 'chart' | 'share' | 'trophy' | 'dumbbell'; label: string; text: string; to: string };
  const rows = (
    [
      { icon: 'chart', label: t('Detailed statistics'), text: t('Diet × training, muscle balance, main exercises, monthly report.'), to: 'stats' },
      { icon: 'share', label: t('My recaps'), text: t('Your week, month or year in a story, with an image to share.'), to: 'recap' },
      { icon: 'trophy', label: t('Level and badges'), text: t('How you earn XP, ranks and every badge.'), to: 'levels' },
      {
        icon: 'dumbbell',
        label: t('My gear'),
        text: n ? t('{0} / 13 slots', { 0: n }) : t('Belt, gloves, shoes, shaker… show what you train with.'),
        to: 'gear',
      },
    ] as R[]
  ).filter((r) => on[r.to] !== false);
  return (
    <>
      <h2 className="settings-group">{t('My space')}</h2>
      <ul className="settings-list">
        {rows.map((r) => (
          <li key={r.to}>
            <button className="settings-row" onClick={() => go(r.to)}>
              <Icon name={r.icon} />
              <span className="settings-label">
                {r.label}
                <span className="muted small">{r.text}</span>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Diet × training: how calories, protein and weight line up with strength, week by week. */
export function DietTraining() {
  const { state } = useStore();
  const { workouts, settings, nutrition } = state;
  const unit = settings.unit;
  const { period, setPeriod, range } = usePeriod(91);
  const starts = useMemo(() => weeksIn(range), [range]);
  const training = useMemo(() => weeklyTraining(workouts, starts), [workouts, starts]);
  const index = useMemo(() => strengthIndexByWeek(workouts, starts), [workouts, starts]);
  const diet = useMemo(() => weeklyDiet(nutrition, starts), [nutrition, starts]);
  const insights = useMemo(() => crossInsights(index, diet, nutrition.proteinPerKg), [index, diet, nutrition.proteinPerKg]);
  const weekLabel = (t: number) => new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'numeric' });
  const hasDiet = diet.some((d) => d.loggedDays > 0);
  const dietRows = starts.map((t, i) => ({ t, d: diet[i], idx: index[i], tr: training[i] })).reverse();
  return (
    <>
      <section className="panel">
        <h2 className="panel-title">{t('Diet × training')}</h2>
        <PeriodPicker id="diet" value={period} onChange={setPeriod} presets={PRESETS_LONG} />
        {!hasDiet ? (
          <>
            <p className="muted small">
              {t('Log your meals and weight in the Nutrition tab to see how calories, protein and weight change line up with your strength.')}
            </p>
            <button className="btn" onClick={() => go('n')}>
              {t('Open Nutrition')}
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
                {t('Insights appear after about 5 weeks with both workouts and at least 4 logged days a week. Until then, compare the weeks below.')}
              </p>
            )}
            <div className="table-scroll">
              <table className="diet-table">
                <thead>
                  <tr>
                    <th>{t('Week of')}</th>
                    <th>{t('kcal/day')}</th>
                    <th>{t('Protein')}</th>
                    <th>{t('Weight')}</th>
                    <th>{t('Sets')}</th>
                    <th>{t('Strength')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dietRows.map(({ t, d, idx, tr }) => (
                    <tr key={t}>
                      <td>{weekLabel(t)}</td>
                      <td>{d.avgKcal ?? '–'}</td>
                      <td>{d.proteinPerKg != null ? `${d.proteinPerKg} g/kg` : '–'}</td>
                      <td>
                        {d.weightChange != null ? `${d.weightChange > 0 ? '+' : ''}${Math.round(toDisplay(d.weightChange, unit) * 10) / 10} ${unit}` : '–'}
                      </td>
                      <td>{tr.sets || '–'}</td>
                      <td>{idx ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">{t('Averages use fully logged days only. These are patterns in your own data, not proof of cause.')}</p>
          </>
        )}
      </section>
      <Phases />
    </>
  );
}

function ProgressHeader() {
  return (
    <Header
      title={t('Profile')}
      right={
        <button className="icon-btn" aria-label={t('Settings')} onClick={() => go('settings')}>
          <Icon name="gear" />
        </button>
      }
    />
  );
}
