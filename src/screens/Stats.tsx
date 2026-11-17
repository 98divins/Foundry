import { useMemo, useState } from 'react';
import { MUSCLE_GROUPS, dayKeyOf, groupSets, monthStart, muscleSets, periodSummary, topExercises, trainedDaySet, weekStreak, type MuscleGroup } from '../analytics';
import { BarChart, RadarChart } from '../components/Charts';
import { ExerciseImage } from '../components/ExerciseImage';
import { Header, Icon, Segmented, Stat } from '../components/ui';
import { muscleLabel, MUSCLES } from '../exercises';
import { back, go } from '../hooks';
import { locale, t, tk, tp } from '../i18n';
import { hasPro, requirePro } from '../pro';
import { DietTraining } from './Progress';
import { loadRatio, weeklyLoad } from '../trainingLoad';
import { useFeature } from '../features';
import { exerciseName, useStore } from '../store';
import type { Muscle } from '../types';
import { fmtDuration, fmtVolume, weekStart } from '../utils';

const DAY = 86400000;
export const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: tk('Chest'),
  back: tk('Back'),
  core: tk('Core'),
  shoulders: tk('Shoulders'),
  arms: tk('Arms'),
  legs: tk('Lower body'),
};

export type StatsPageId = 'diet' | 'load' | 'distribution' | 'muscles' | 'exercises' | 'month';

/** Entries of the "Advanced statistics" list on the Progress tab. */
export const STATS_PAGES: { id: StatsPageId; icon: 'chart' | 'dumbbell' | 'list' | 'history'; title: string; text: string; pro?: boolean }[] = [
  { id: 'diet', icon: 'chart', title: tk('Diet × training'), text: tk('How calories, protein and weight line up with your strength, week by week.') },
  { id: 'load', icon: 'chart', title: tk('Training load'), text: tk('Working sets, tonnage and time per week, and how this week compares with your usual.') },
  { id: 'distribution', icon: 'chart', title: tk('Muscle balance'), text: tk('Sets per muscle group, this period against the one before.'), pro: true },
  { id: 'muscles', icon: 'dumbbell', title: tk('Muscles week by week'), text: tk('Working sets per muscle for any week.') },
  { id: 'exercises', icon: 'list', title: tk('Main exercises'), text: tk('The exercises you do most often.') },
  { id: 'month', icon: 'history', title: tk('Monthly report'), text: tk('Your month in numbers, training days and streak.'), pro: true },
];

export function StatsPage({ page }: { page?: StatsPageId }) {
  switch (page) {
    case 'diet':
      return (
        <Sub title={t('Diet × training')}>
          <DietTraining />
        </Sub>
      );
    case 'load':
      return <TrainingLoad />;
    case 'distribution':
      return <Distribution />;
    case 'muscles':
      return <MusclesByWeek />;
    case 'exercises':
      return <MainExercises />;
    case 'month':
      return <MonthReport />;
    default:
      return <StatsHub />;
  }
}

/** The list of detailed statistics pages. */
function StatsHub() {
  return (
    <>
      <Header title={t('Detailed statistics')} onBack={() => back('profile')} />
      <main className="page">
        <ul className="settings-list">
          {STATS_PAGES.map((p) => (
            <li key={p.id}>
              <button className="settings-row" onClick={() => (!p.pro || requirePro('advancedStats')) && go('stats/' + p.id)}>
                <Icon name={p.icon} />
                <span className="settings-label">
                  <span>
                    {t(p.title)}
                    {p.pro && <span className="pro-badge">Pro</span>}
                  </span>
                  <span className="muted small">{t(p.text)}</span>
                </span>
                <Icon name="chevron" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Header title={title} onBack={() => back('profile')} />
      <main className="page">
        {hasPro() && STATS_PAGES.find((p) => t(p.title) === title)?.pro && (
          <p className="muted small">{t('Pro feature, included for free during the beta.')}</p>
        )}
        {children}
      </main>
    </>
  );
}

const PERIODS = [
  { value: '30', label: tk('30 days') },
  { value: '90', label: tk('90 days') },
  { value: '365', label: tk('1 year') },
] as const;

function Distribution() {
  const { state, exMap } = useStore();
  const [days, setDays] = useState<'30' | '90' | '365'>('30');
  const span = Number(days) * DAY;
  const now = Date.now();
  const cur = useMemo(() => groupSets(state.workouts, exMap, now - span, now + DAY), [state.workouts, exMap, span, now]);
  const prev = useMemo(() => groupSets(state.workouts, exMap, now - 2 * span, now - span), [state.workouts, exMap, span, now]);
  const total = MUSCLE_GROUPS.reduce((s, g) => s + cur[g], 0);
  return (
    <Sub title={t('Muscle balance')}>
      <Segmented label={t('Period')} value={days} onChange={setDays} options={PERIODS.map((p) => ({ value: p.value, label: t(p.label) }))} />
      <section className="panel">
        <RadarChart labels={MUSCLE_GROUPS.map((g) => t(GROUP_LABEL[g]))} current={MUSCLE_GROUPS.map((g) => cur[g])} previous={MUSCLE_GROUPS.map((g) => prev[g])} />
        <p className="legend small">
          <span className="dot cur" /> {t('This period')} <span className="dot prev" /> {t('Period before')}
        </p>
      </section>
      <section className="panel">
        <ul className="group-list">
          {MUSCLE_GROUPS.map((g) => {
            const d = cur[g] - prev[g];
            return (
              <li key={g}>
                <span>{t(GROUP_LABEL[g])}</span>
                <span className="muted small">{total ? Math.round((cur[g] / total) * 100) : 0} %</span>
                <strong>{cur[g]}</strong>
                <span className={'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '')}>{d > 0 ? '+' : ''}{d}</span>
              </li>
            );
          })}
        </ul>
        <p className="muted small">{t('Working sets, primary muscle only. Full-body moves and cardio are left out.')}</p>
      </section>
    </Sub>
  );
}

function MusclesByWeek() {
  const { state, exMap } = useStore();
  const [start, setStart] = useState(() => weekStart(Date.now()));
  const sets = useMemo(() => muscleSets(state.workouts, exMap, start, weekStart(start + 10.5 * DAY)), [state.workouts, exMap, start]);
  const rows = MUSCLES.filter((m) => m !== 'cardio').map((m) => [m, sets.get(m) ?? 0] as [Muscle, number]);
  const total = rows.reduce((s, [, n]) => s + n, 0);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => start + i * DAY + 3600000);
  const trained = trainedDaySet(state.workouts);
  const isThisWeek = start === weekStart(Date.now());
  return (
    <Sub title={t('Muscles week by week')}>
      <div className="week-nav">
        <button className="icon-btn" aria-label={t('Previous week')} onClick={() => setStart(weekStart(start - 3.5 * DAY))}>
          <Icon name="back" />
        </button>
        <strong>
          {new Date(start).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} – {new Date(start + 6 * DAY).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}
        </strong>
        <button className="icon-btn" aria-label={t('Next week')} disabled={isThisWeek} onClick={() => setStart(weekStart(start + 10.5 * DAY))}>
          <Icon name="chevron" />
        </button>
      </div>
      <div className="week-days">
        {days.map((d) => (
          <span key={d} className={trained.has(dayKeyOf(d)) ? 'on' : ''}>
            <span className="muted small">{new Date(d).toLocaleDateString(locale(), { weekday: 'narrow' })}</span>
            <strong>{new Date(d).getDate()}</strong>
          </span>
        ))}
      </div>
      <section className="panel">
        <div className="heat-head">
          <span>{t('Muscle')}</span>
          <span>{t('Sets')}</span>
        </div>
        <ul className="heat-list">
          <li className="heat-total">
            <span>{t('Total')}</span>
            <strong>{total}</strong>
          </li>
          {rows.map(([m, n]) => (
            <li key={m} style={{ ['--heat' as string]: String(n / max) }} className={n ? '' : 'zero'}>
              <span>{muscleLabel(m)}</span>
              <strong>{n}</strong>
            </li>
          ))}
        </ul>
      </section>
    </Sub>
  );
}

type LoadMetric = 'sets' | 'tonnage' | 'minutes' | 'effort';

/** Training load: weekly totals over 12 weeks and the acute:chronic ratio. */
function TrainingLoad() {
  const { state } = useStore();
  const unit = state.settings.unit;
  const rpeOn = useFeature('rpe');
  const [metric, setMetric] = useState<LoadMetric>('sets');
  const starts = useMemo(() => {
    const out = [weekStart(Date.now())];
    while (out.length < 12) out.unshift(weekStart(out[0] - 3.5 * DAY));
    return out;
  }, []);
  const weeks = useMemo(() => weeklyLoad(state.workouts, starts), [state.workouts, starts]);
  const ratio = useMemo(() => loadRatio(state.workouts), [state.workouts]);
  const label = (ts: number) => new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'numeric' });
  const value = (w: (typeof weeks)[number]) => (metric === 'effort' ? (w.effort ?? 0) : metric === 'tonnage' ? Math.round(w.tonnage / 100) / 10 : w[metric]);
  const zoneText = {
    low: t('Lighter than usual: fine for a deload or a busy week.'),
    steady: t('In line with what you usually do.'),
    jump: t('A big jump compared with your usual. Jumps like this are often harder to recover from: keep an eye on sleep, aches and how sessions feel.'),
  };
  const options: { value: LoadMetric; label: string }[] = [
    { value: 'sets', label: t('Sets') },
    { value: 'tonnage', label: t('Tonnage') },
    { value: 'minutes', label: t('Time') },
    ...(rpeOn ? [{ value: 'effort' as const, label: t('Effort') }] : []),
  ];
  return (
    <Sub title={t('Training load')}>
      <section className="panel">
        <h2 className="panel-title">{t('This week against your usual')}</h2>
        {ratio ? (
          <>
            <div className={'load-ratio z-' + ratio.zone}>
              <strong>{ratio.ratio.toLocaleString(locale())}</strong>
              <span className="muted small">{t('{a} sets in the last 7 days · usual {b} a week (last 4 weeks)', { a: ratio.acute, b: ratio.chronic.toLocaleString(locale()) })}</span>
            </div>
            <div className="load-scale" aria-hidden="true">
              <span className="z-low">{'< 0,8'}</span>
              <span className="z-steady">0,8 – 1,3</span>
              <span className="z-jump">{'> 1,3'}</span>
            </div>
            <p className="small">{zoneText[ratio.zone]}</p>
          </>
        ) : (
          <p className="muted small">{t('Train on at least 3 of the last 4 weeks to compare this week with your usual.')}</p>
        )}
      </section>
      <section className="panel">
        <h2 className="panel-title">{t('Per week')}</h2>
        <Segmented label={t('Measure')} value={metric} onChange={setMetric} options={options} />
        <BarChart bars={weeks.map((w) => ({ label: label(w.start), value: value(w) }))} />
        <p className="muted small">
          {metric === 'sets'
            ? t('Completed working sets (warm-ups left out).')
            : metric === 'tonnage'
              ? t('Weight × reps, in tonnes ({unit} converted to t).', { unit })
              : metric === 'minutes'
                ? t('Workout time in minutes, pauses left out.')
                : t('Average RPE of rated sets × minutes, added up over the week (sets without RPE are left out).')}
        </p>
      </section>
      <p className="muted small">{t('The ratio is a rough guide to spot sudden changes, not a prediction of injury.')}</p>
    </Sub>
  );
}

function MainExercises() {
  const { state, exMap } = useStore();
  const [days, setDays] = useState<'30' | '90' | '365'>('30');
  const now = Date.now();
  const top = useMemo(() => topExercises(state.workouts, now - Number(days) * DAY, now + DAY), [state.workouts, days, now]);
  return (
    <Sub title={t('Main exercises')}>
      <Segmented label={t('Period')} value={days} onChange={setDays} options={PERIODS.map((p) => ({ value: p.value, label: t(p.label) }))} />
      {!top.length && <div className="empty-card"><p>{t('No workout in this period yet.')}</p></div>}
      <ul className="lift-list">
        {top.map((e) => (
          <li key={e.exerciseId}>
            <button className="lift-row" onClick={() => go('e/' + e.exerciseId)}>
              <ExerciseImage ex={exMap.get(e.exerciseId)} label={exerciseName(exMap, e.exerciseId)} />
              <span className="lift-text">
                <span className="entry-name">{exerciseName(exMap, e.exerciseId)}</span>
                <span className="muted small">
                  {tp(e.workouts, '{n} workout', '{n} workouts')} · {tp(e.sets, '{n} set', '{n} sets')}
                </span>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </Sub>
  );
}

function Delta({ cur, prev, fmt = String }: { cur: number; prev: number; fmt?: (v: number) => string }) {
  const d = cur - prev;
  return (
    <span className={'delta small ' + (d > 0 ? 'up' : d < 0 ? 'down' : '')}>
      {d > 0 ? '↑ ' : d < 0 ? '↓ ' : '= '}
      {fmt(Math.abs(d))}
    </span>
  );
}

function MonthReport() {
  const { state, exMap } = useStore();
  const unit = state.settings.unit;
  const [offset, setOffset] = useState(0);
  const now = Date.now();
  const from = monthStart(now, offset);
  const to = monthStart(now, offset + 1);
  const prevFrom = monthStart(now, offset - 1);
  const cur = periodSummary(state.workouts, from, to);
  const prev = periodSummary(state.workouts, prevFrom, from);
  const g = groupSets(state.workouts, exMap, from, to);
  const gp = groupSets(state.workouts, exMap, prevFrom, from);
  const trained = trainedDaySet(state.workouts);
  const streak = weekStreak(state.workouts, Math.min(now, to - 1));
  const months = [-5, -4, -3, -2, -1, 0].map((k) => monthStart(now, offset + k));
  const bars = months.map((m) => ({
    label: new Date(m).toLocaleDateString(locale(), { month: 'narrow' }),
    value: periodSummary(state.workouts, m, monthStart(m, 1)).days,
  }));
  // Calendar grid: blanks before the 1st so columns follow the first day of the week.
  const first = new Date(from);
  const wsOn = state.settings.weekStartsOn ?? 1;
  const lead = (first.getDay() - wsOn + 7) % 7;
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1).getTime())];
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(2024, 0, 7 + ((i + wsOn) % 7)).toLocaleDateString(locale(), { weekday: 'narrow' }));
  const title = new Date(from).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });

  return (
    <Sub title={t('Monthly report')}>
      <div className="week-nav">
        <button className="icon-btn" aria-label={t('Previous month')} onClick={() => setOffset(offset - 1)}>
          <Icon name="back" />
        </button>
        <strong className="month-title">{title}</strong>
        <button className="icon-btn" aria-label={t('Next month')} disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
          <Icon name="chevron" />
        </button>
      </div>

      <div className="stats-row">
        <Stat label={t('Training days')} value={<>{cur.days} <Delta cur={cur.days} prev={prev.days} /></>} />
        <Stat label={t('Workouts')} value={<>{cur.workouts} <Delta cur={cur.workouts} prev={prev.workouts} /></>} />
        <Stat label={t('Duration')} value={<>{fmtDuration(cur.minutes * 60000)} <Delta cur={cur.minutes} prev={prev.minutes} fmt={(v) => fmtDuration(v * 60000)} /></>} />
        <Stat label={t('Volume')} value={<>{fmtVolume(cur.volume, unit)} <Delta cur={cur.volume} prev={prev.volume} fmt={(v) => fmtVolume(v, unit)} /></>} />
        <Stat label={t('Sets')} value={<>{cur.sets} <Delta cur={cur.sets} prev={prev.sets} /></>} />
      </div>
      <p className="muted small">{t('Arrows compare with the month before.')}</p>

      <section className="panel">
        <h2 className="panel-title">{t('Training days per month')}</h2>
        <BarChart bars={bars} />
      </section>

      <section className="panel">
        <h2 className="panel-title">{t('Workout days')}</h2>
        <p className="streak-line">
          <Icon name="flame" size={20} /> {tp(streak.weeks, '{n} week streak', '{n} weeks streak')}
        </p>
        <div className="month-cal">
          {weekdayNames.map((d, i) => (
            <span key={'h' + i} className="muted small">
              {d}
            </span>
          ))}
          {cells.map((c, i) =>
            c == null ? (
              <span key={'b' + i} />
            ) : (
              <span key={c} className={trained.has(dayKeyOf(c)) ? 'on' : ''}>
                {new Date(c).getDate()}
              </span>
            ),
          )}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">{t('Muscle balance')}</h2>
        <RadarChart labels={MUSCLE_GROUPS.map((x) => t(GROUP_LABEL[x]))} current={MUSCLE_GROUPS.map((x) => g[x])} previous={MUSCLE_GROUPS.map((x) => gp[x])} />
        <p className="legend small">
          <span className="dot cur" /> {title} <span className="dot prev" /> {new Date(prevFrom).toLocaleDateString(locale(), { month: 'long' })}
        </p>
      </section>
    </Sub>
  );
}
