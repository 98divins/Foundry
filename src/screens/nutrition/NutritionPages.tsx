import { useState } from 'react';
import { LineChart } from '../../components/Charts';
import { Header, HeightInput, Icon, NumInput, Segmented, Stat } from '../../components/ui';
import { back, go } from '../../hooks';
import {
  computeTargets,
  ACTIVITY_FACTOR,
  currentExpenditure,
  currentTargets,
  dayKey,
  expenditureSeries,
  initialExpenditure,
  latestTrend,
  makeCheckIn,
  parseDay,
  recentStats,
  weightTrend,
  type Activity,
  type NutritionState,
  type Sex,
} from '../../nutrition';
import { useNutrition, useStore } from '../../store';
import { fmtNum, fromDisplay, toDisplay } from '../../utils';
import { locale, t, tk } from '../../i18n';
import { CUSTOM_PLAN, MACRO_PLANS, planFor } from '../../macroPlans';
import { PRO_FREE_DURING_BETA } from '../../pro';

const ts = (key: string) => parseDay(key).getTime();

/* ---------- Weight ---------- */

export function WeightPage() {
  const { n, setN, unit } = useNutrition();
  const [date, setDate] = useState(dayKey());
  const [value, setValue] = useState<number | null>(null);
  const [range, setRange] = useState<'30' | '90' | 'all'>('90');
  const trend = weightTrend(n.weights);
  const since = range === 'all' ? '' : dayKey(new Date(Date.now() - Number(range) * 86400000));
  const shown = trend.filter((t) => t.date >= since);
  const d = (kg: number) => Math.round(toDisplay(kg, unit) * 10) / 10;
  const list = [...n.weights].sort((a, b) => b.date.localeCompare(a.date));
  const stats = recentStats(n, 14);

  return (
    <>
      <Header title={t('Weight')} onBack={() => back('n')} />
      <main className="page">
        <div className="stats-row">
          <Stat label={t('Trend')} value={trend.length ? `${fmtNum(d(trend[trend.length - 1].trend))} ${unit}` : '–'} />
          <Stat
            label={t('Per week (14 d)')}
            value={stats.weeklyChange != null ? `${stats.weeklyChange > 0 ? '+' : ''}${fmtNum(d(stats.weeklyChange))} ${unit}` : '–'}
          />
          <Stat label={t('Weigh-ins')} value={n.weights.length} />
        </div>
        <section className="panel">
          <Segmented
            label={t('Period')}
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: t('30 days') },
              { value: '90', label: t('90 days') },
              { value: 'all', label: t('All') },
            ]}
          />
          <LineChart
            points={shown.map((t) => ({ x: ts(t.date), y: d(t.trend) }))}
            scatter={shown.filter((t) => t.scale != null).map((t) => ({ x: ts(t.date), y: d(t.scale!) }))}
            format={(v) => fmtNum(v)}
            emptyText={t('Weigh in on at least two days to see your trend.')}
          />
          <p className="muted small">{t('Dots are your scale readings; the line is the trend, which smooths out day-to-day water changes. Judge progress by the line.')}</p>
        </section>

        <form
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!value) return;
            const kg = Math.round(fromDisplay(value, unit) * 100) / 100;
            setN((x) => ({ ...x, weights: [...x.weights.filter((w) => w.date !== date), { date, kg }] }));
            setValue(null);
          }}
        >
          <h2 className="panel-title">{t('Add a weigh-in')}</h2>
          <div className="field-row">
            <label className="field">
              <span>{t('Date')}</span>
              <input id="w-date" type="date" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field field-narrow">
              <span>{t('Weight ({0})', { 0: unit })}</span>
              <NumInput id="w-value" label={t('Weight in {unit}', { unit })} value={value} onChange={setValue} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={!value || !date}>{t('Save')}</button>
        </form>

        <ul className="weigh-list">
          {list.slice(0, 60).map((w) => (
            <li key={w.date}>
              <span>{parseDay(w.date).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <strong>
                {fmtNum(d(w.kg))} {unit}
              </strong>
              <button
                className="icon-btn"
                aria-label={t('Delete weigh-in of {date}', { date: w.date })}
                onClick={() => setN((x) => ({ ...x, weights: x.weights.filter((y) => y.date !== w.date) }))}
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

/* ---------- Expenditure ---------- */

export function InsightsPage() {
  const { n } = useNutrition();
  const series = expenditureSeries(n);
  const current = currentExpenditure(n);
  const stats = recentStats(n, 14);
  const seed = n.profile && n.weights.length ? initialExpenditure(n.profile, n.weights[0].kg) : null;
  const adapted = series.some((p) => p.raw != null);
  const recent = series.slice(-90);

  return (
    <>
      <Header title={t('Expenditure')} onBack={() => back('n')} />
      <main className="page">
        <div className="stats-row">
          <Stat label={t('Expenditure (kcal)')} value={current ?? '–'} />
          <Stat label={t('Avg intake, kcal (14 d)')} value={stats.avgIntake ?? '–'} />
          <Stat label={t('Logged days')} value={`${stats.loggedDays}/14`} />
        </div>
        <section className="panel">
          <h2 className="panel-title">{t('Estimated daily expenditure')}</h2>
          <LineChart
            points={recent.map((p) => ({ x: ts(p.date), y: p.estimate }))}
            format={(v) => String(Math.round(v))}
            emptyText={t('Log your weight and food for a few days to see the estimate.')}
          />
          <p className="muted small">
            {adapted
              ? t('Each day the estimate moves toward what your intake and weight trend of the last 3 weeks imply.')
              : t('This is still the starting estimate from your profile ({n} kcal). It starts adapting after 7 fully logged days with at least 4 weigh-ins.', { n: seed ?? '–' })}
          </p>
        </section>
        <section className="panel">
          <h2 className="panel-title">{t('How it works')}</h2>
          <ol className="how">
            <li>{t('The starting point comes from your age, height, weight, sex and activity (Mifflin-St Jeor).')}</li>
            <li>{t('Every day, it compares what you ate over the last 3 weeks with how your weight moved.')}</li>
            <li>{t('Losing 1 kg of body mass frees about 7 700 kcal. If you ate 2 100 kcal a day and lost 0.5 kg a week, you burned about 2 650 kcal a day.')}</li>
            <li>{t('Days you mark as not fully logged are left out, so a forgotten snack does not skew the result.')}</li>
            <li>{t('At the weekly check-in, your targets are recalculated from this estimate and your goal.')}</li>
          </ol>
        </section>
        {n.checkIns.length > 0 && (
          <section className="panel">
            <h2 className="panel-title">{t('Check-ins')}</h2>
            <ul className="weigh-list">
              {[...n.checkIns].reverse().slice(0, 12).map((c) => (
                <li key={c.date}>
                  <span>{parseDay(c.date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span>
                  <span className="small">
                    {t('{0} kcal · P {1} · C {2} · F {3}', { 0: c.targets.kcal, 1: c.targets.protein, 2: c.targets.carbs, 3: c.targets.fat })}</span>
                  <span className="muted small">{c.expenditure}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

/* ---------- Plan (setup and settings) ---------- */

const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: t('Sedentary (desk job, little walking)'),
  light: t('Light (some walking, 1–3 workouts a week)'),
  moderate: t('Moderate (on your feet, 3–5 workouts a week)'),
  active: t('Active (physical job or daily training)'),
  very_active: t('Very active (physical job and hard training)'),
};
const RATES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5];
const DAYS = [tk('Sunday'), tk('Monday'), tk('Tuesday'), tk('Wednesday'), tk('Thursday'), tk('Friday'), tk('Saturday')];

export function PlanPage({ setup }: { setup?: boolean }) {
  const { n, setN, unit } = useNutrition();
  const { state } = useStore();
  const heightUnit = state.settings.heightUnit ?? 'cm';
  const [draft, setDraft] = useState<NutritionState>(n);
  const [profile, setProfile] = useState(
    n.profile ?? { sex: 'male' as Sex, birthYear: new Date().getFullYear() - 30, heightCm: 175, activity: 'moderate' as Activity },
  );
  const latest = latestTrend(n);
  const [weight, setWeight] = useState<number | null>(latest != null ? Math.round(toDisplay(latest, unit) * 10) / 10 : null);
  const needsWeight = !n.weights.length;

  const save = () => {
    const today = dayKey();
    setN((x) => {
      let next: NutritionState = {
        ...x,
        profile,
        rateKgPerWeek: draft.rateKgPerWeek,
        proteinPerKg: draft.proteinPerKg,
        fatShare: draft.fatShare,
        macroPlan: plan,
        checkInDay: draft.checkInDay,
      };
      if (needsWeight && weight) {
        next = { ...next, weights: [...next.weights, { date: today, kg: Math.round(fromDisplay(weight, unit) * 100) / 100 }] };
      }
      // A new or changed plan takes effect now: record a check-in with fresh targets.
      const ci = makeCheckIn(next, today);
      if (ci) next = { ...next, checkIns: [...next.checkIns.filter((c) => c.date !== today), ci] };
      return next;
    });
    go('n', { replace: true });
  };

  const preview = (() => {
    const kg = latest ?? (weight ? fromDisplay(weight, unit) : null);
    if (!kg) return null;
    const exp = currentExpenditure({ ...n, profile, weights: n.weights.length ? n.weights : [{ date: dayKey(), kg }] });
    return exp != null ? { exp, ci: makeCheckIn({ ...draft, profile, weights: n.weights.length ? n.weights : [{ date: dayKey(), kg }] }) } : null;
  })();
  const current = currentTargets(n);
  const plan = planFor(draft.proteinPerKg, draft.fatShare, draft.macroPlan);
  /** % of calories from protein, carbs and fat with these settings, for this user's calories and weight. */
  const splitFor = (proteinPerKg: number, fatShare: number) => {
    const kg = latest ?? (weight ? fromDisplay(weight, unit) : null);
    if (!preview || !kg) return null;
    const m = computeTargets(preview.exp, kg, { ...draft, profile, proteinPerKg, fatShare });
    const p = Math.round(((m.protein * 4) / m.kcal) * 100);
    const f = Math.round(((m.fat * 9) / m.kcal) * 100);
    return { p, f, c: Math.max(0, 100 - p - f) };
  };
  const valid = profile.heightCm > 100 && profile.birthYear > 1920 && (!needsWeight || !!weight);

  return (
    <>
      <Header title={setup ? t('Set up my plan') : t('Plan')} onBack={() => back('n')} />
      <main className="page">
        <section className="panel form">
          <h2 className="panel-title">{t('About you')}</h2>
          <div className="field-row field-row-3">
            <label className="field">
              <span>{t('Sex')}</span>
              <select id="p-sex" value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value as Sex })}>
                <option value="male">{t('Male')}</option>
                <option value="female">{t('Female')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('Birth year')}</span>
              <NumInput
                id="p-year"
                label={t('Birth year')}
                decimal={false}
                value={profile.birthYear}
                onChange={(v) => setProfile({ ...profile, birthYear: v ?? 0 })}
              />
            </label>
            <label className="field">
              <span>{heightUnit === 'cm' ? t('Height (cm)') : t('Height (ft, in)')}</span>
              <HeightInput id="p-height" cm={profile.heightCm} unit={heightUnit} onChange={(heightCm) => setProfile({ ...profile, heightCm })} />
            </label>
          </div>
          {needsWeight && (
            <label className="field">
              <span>{t('Weight today ({0})', { 0: unit })}</span>
              <NumInput id="p-weight" label={t('Weight in {unit}', { unit })} value={weight} onChange={setWeight} />
            </label>
          )}
          <label className="field">
            <span>{t('Activity outside your workouts and training')}</span>
            <select id="p-activity" value={profile.activity} onChange={(e) => setProfile({ ...profile, activity: e.target.value as Activity })}>
              {(Object.keys(ACTIVITY_FACTOR) as Activity[]).map((a) => (
                <option key={a} value={a}>
                  {ACTIVITY_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">{t('Only used for the first estimate. After a few weeks your own data takes over.')}</p>
        </section>

        <section className="panel form">
          <h2 className="panel-title">{t('Goal')}</h2>
          <label className="field">
            <span>{t('Weight change per week')}</span>
            <select
              id="p-rate"
              value={draft.rateKgPerWeek}
              onChange={(e) => setDraft({ ...draft, rateKgPerWeek: Number(e.target.value) })}
            >
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? t('Maintain') : r > 0 ? t('Gain {v} {unit} / week', { v: fmtNum(Math.abs(toDisplay(r, unit))), unit }) : t('Lose {v} {unit} / week', { v: fmtNum(Math.abs(toDisplay(r, unit))), unit })}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>{t('Macro plan')}</span>
            <ul className="plan-choices">
              {[...MACRO_PLANS, null].map((m) => {
                const id = m ? m.id : CUSTOM_PLAN;
                const on = plan === id;
                const split = m ? splitFor(m.proteinPerKg, m.fatShare) : splitFor(draft.proteinPerKg, draft.fatShare);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="plan-choice"
                      aria-pressed={on}
                      onClick={() => setDraft({ ...draft, macroPlan: id, ...(m ? { proteinPerKg: m.proteinPerKg, fatShare: m.fatShare } : {}) })}
                    >
                      <span className="plan-choice-text">
                        <strong>
                          {m ? t(m.name) : t('Custom')}
                          {!m && <span className="pro-badge">Pro</span>}
                        </strong>
                        <span className="muted small">{m ? t(m.description) : t('Set protein and fat yourself.')}</span>
                      </span>
                      {split && <span className="plan-split small">{t('P {p}% · C {c}% · F {f}%', split)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {plan === CUSTOM_PLAN && (
            <>
              {PRO_FREE_DURING_BETA && <p className="muted small">{t('Pro feature, included for free during the beta.')}</p>}
          <div className="field-row">
              <label className="field">
                <span>{t('Protein (g per kg)')}</span>
                <select
                  id="p-protein"
                  value={draft.proteinPerKg}
                  onChange={(e) => setDraft({ ...draft, proteinPerKg: Number(e.target.value) })}
                >
                  {[...new Set([1.6, 1.8, 2, 2.2, 2.3, 2.4, 2.6, draft.proteinPerKg])].sort((x, y) => x - y).map((p) => (
                    <option key={p} value={p}>
                      {t('{0} g/kg', { 0: fmtNum(p) })}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('Fat (share of calories)')}</span>
                <select id="p-fat" value={draft.fatShare} onChange={(e) => setDraft({ ...draft, fatShare: Number(e.target.value) })}>
                  {[...new Set([0.2, 0.25, 0.28, 0.3, 0.35, 0.4, draft.fatShare])].sort((x, y) => x - y).map((f) => (
                    <option key={f} value={f}>
                      {Math.round(f * 100)} %
                    </option>
                  ))}
                </select>
              </label>
            </div>
            </>
          )}
          <label className="field">
            <span>{t('Weekly check-in day')}</span>
            <select id="p-day" value={draft.checkInDay} onChange={(e) => setDraft({ ...draft, checkInDay: Number(e.target.value) })}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {t(d)}
                </option>
              ))}
            </select>
          </label>
        </section>

        {preview?.ci && (
          <section className="panel">
            <h2 className="panel-title">{t('Your targets')}</h2>
            <p className="small muted">{t('Based on an expenditure of {n} kcal/day', { n: preview.exp })}{current ? t('; currently {n} kcal', { n: current.kcal }) : ''}.
            </p>
            <div className="summary-stats">
              <Stat label={t('Calories')} value={preview.ci.targets.kcal} />
              <Stat label={t('Protein')} value={`${preview.ci.targets.protein} g`} />
              <Stat label={t('Carbs')} value={`${preview.ci.targets.carbs} g`} />
            </div>
            <p className="small">{t('Fat {0} g', { 0: preview.ci.targets.fat })}</p>
          </section>
        )}

        <button className="btn btn-primary btn-wide" disabled={!valid} onClick={save}>
          {setup ? t('Start my plan') : t('Save plan')}
        </button>
        <p className="muted small">{t('This is an estimate for healthy adults, not medical advice. The app never sets calories below 1 200 (women) or 1 500 (men) kcal a day.')}</p>
      </main>
    </>
  );
}
