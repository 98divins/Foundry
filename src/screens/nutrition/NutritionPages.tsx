import { useState } from 'react';
import { LineChart } from '../../components/Charts';
import { Header, Icon, NumInput, Segmented, Stat } from '../../components/ui';
import { back, go } from '../../hooks';
import {
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
import { useNutrition } from '../../store';
import { fmtNum, fromDisplay, toDisplay } from '../../utils';

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
      <Header title="Weight" onBack={() => back('n')} />
      <main className="page">
        <div className="stats-row">
          <Stat label="Trend" value={trend.length ? `${d(trend[trend.length - 1].trend)} ${unit}` : '–'} />
          <Stat
            label="Per week (14 d)"
            value={stats.weeklyChange != null ? `${stats.weeklyChange > 0 ? '+' : ''}${fmtNum(d(stats.weeklyChange))} ${unit}` : '–'}
          />
          <Stat label="Weigh-ins" value={n.weights.length} />
        </div>
        <section className="panel">
          <Segmented
            label="Period"
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: 'all', label: 'All' },
            ]}
          />
          <LineChart
            points={shown.map((t) => ({ x: ts(t.date), y: d(t.trend) }))}
            scatter={shown.filter((t) => t.scale != null).map((t) => ({ x: ts(t.date), y: d(t.scale!) }))}
            format={(v) => fmtNum(v)}
            emptyText="Weigh in on at least two days to see your trend."
          />
          <p className="muted small">
            Dots are your scale readings; the line is the trend, which smooths out day-to-day water changes. Judge
            progress by the line.
          </p>
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
          <h2 className="panel-title">Add a weigh-in</h2>
          <div className="field-row">
            <label className="field">
              <span>Date</span>
              <input id="w-date" type="date" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field field-narrow">
              <span>Weight ({unit})</span>
              <NumInput id="w-value" label={`Weight in ${unit}`} value={value} onChange={setValue} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={!value || !date}>
            Save
          </button>
        </form>

        <ul className="weigh-list">
          {list.slice(0, 60).map((w) => (
            <li key={w.date}>
              <span>{parseDay(w.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <strong>
                {fmtNum(d(w.kg))} {unit}
              </strong>
              <button
                className="icon-btn"
                aria-label={`Delete weigh-in of ${w.date}`}
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
      <Header title="Expenditure" onBack={() => back('n')} />
      <main className="page">
        <div className="stats-row">
          <Stat label="Expenditure" value={current != null ? `${current} kcal` : '–'} />
          <Stat label="Avg intake (14 d)" value={stats.avgIntake != null ? `${stats.avgIntake} kcal` : '–'} />
          <Stat label="Logged days" value={`${stats.loggedDays}/14`} />
        </div>
        <section className="panel">
          <h2 className="panel-title">Estimated daily expenditure</h2>
          <LineChart
            points={recent.map((p) => ({ x: ts(p.date), y: p.estimate }))}
            format={(v) => String(Math.round(v))}
            emptyText="Log your weight and food for a few days to see the estimate."
          />
          <p className="muted small">
            {adapted
              ? 'Each day the estimate moves toward what your intake and weight trend of the last 3 weeks imply.'
              : `This is still the starting estimate from your profile (${seed ?? '–'} kcal). It starts adapting after 7 fully logged days with at least 4 weigh-ins.`}
          </p>
        </section>
        <section className="panel">
          <h2 className="panel-title">How it works</h2>
          <ol className="how">
            <li>The starting point comes from your age, height, weight, sex and activity (Mifflin-St Jeor).</li>
            <li>Every day, it compares what you ate over the last 3 weeks with how your weight moved.</li>
            <li>
              Losing 1 kg of body mass frees about 7 700 kcal. If you ate 2 100 kcal a day and lost 0.5 kg a week, you
              burned about 2 650 kcal a day.
            </li>
            <li>Days you mark as not fully logged are left out, so a forgotten snack does not skew the result.</li>
            <li>At the weekly check-in, your targets are recalculated from this estimate and your goal.</li>
          </ol>
        </section>
        {n.checkIns.length > 0 && (
          <section className="panel">
            <h2 className="panel-title">Check-ins</h2>
            <ul className="weigh-list">
              {[...n.checkIns].reverse().slice(0, 12).map((c) => (
                <li key={c.date}>
                  <span>{parseDay(c.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  <span className="small">
                    {c.targets.kcal} kcal · P {c.targets.protein} · C {c.targets.carbs} · F {c.targets.fat}
                  </span>
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
  sedentary: 'Sedentary (desk job, little walking)',
  light: 'Light (some walking, 1–3 workouts a week)',
  moderate: 'Moderate (on your feet, 3–5 workouts a week)',
  active: 'Active (physical job or daily training)',
  very_active: 'Very active (physical job and hard training)',
};
const RATES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function PlanPage({ setup }: { setup?: boolean }) {
  const { n, setN, unit } = useNutrition();
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
  const valid = profile.heightCm > 100 && profile.birthYear > 1920 && (!needsWeight || !!weight);

  return (
    <>
      <Header title={setup ? 'Set up my plan' : 'Plan'} onBack={() => back('n')} />
      <main className="page">
        <section className="panel form">
          <h2 className="panel-title">About you</h2>
          <div className="field-row">
            <label className="field">
              <span>Sex</span>
              <select id="p-sex" value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value as Sex })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label className="field">
              <span>Birth year</span>
              <NumInput
                id="p-year"
                label="Birth year"
                decimal={false}
                value={profile.birthYear}
                onChange={(v) => setProfile({ ...profile, birthYear: v ?? 0 })}
              />
            </label>
            <label className="field">
              <span>Height (cm)</span>
              <NumInput id="p-height" label="Height in cm" value={profile.heightCm} onChange={(v) => setProfile({ ...profile, heightCm: v ?? 0 })} />
            </label>
          </div>
          {needsWeight && (
            <label className="field">
              <span>Weight today ({unit})</span>
              <NumInput id="p-weight" label={`Weight in ${unit}`} value={weight} onChange={setWeight} />
            </label>
          )}
          <label className="field">
            <span>Activity outside your workouts and training</span>
            <select id="p-activity" value={profile.activity} onChange={(e) => setProfile({ ...profile, activity: e.target.value as Activity })}>
              {(Object.keys(ACTIVITY_FACTOR) as Activity[]).map((a) => (
                <option key={a} value={a}>
                  {ACTIVITY_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">Only used for the first estimate. After a few weeks your own data takes over.</p>
        </section>

        <section className="panel form">
          <h2 className="panel-title">Goal</h2>
          <label className="field">
            <span>Weight change per week</span>
            <select
              id="p-rate"
              value={draft.rateKgPerWeek}
              onChange={(e) => setDraft({ ...draft, rateKgPerWeek: Number(e.target.value) })}
            >
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? 'Maintain' : `${r > 0 ? 'Gain' : 'Lose'} ${fmtNum(Math.abs(toDisplay(r, unit)))} ${unit} / week`}
                </option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label className="field">
              <span>Protein (g per kg)</span>
              <select
                id="p-protein"
                value={draft.proteinPerKg}
                onChange={(e) => setDraft({ ...draft, proteinPerKg: Number(e.target.value) })}
              >
                {[1.6, 1.8, 2, 2.2, 2.4].map((p) => (
                  <option key={p} value={p}>
                    {p} g/kg
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Fat (share of calories)</span>
              <select id="p-fat" value={draft.fatShare} onChange={(e) => setDraft({ ...draft, fatShare: Number(e.target.value) })}>
                {[0.2, 0.25, 0.28, 0.3, 0.35, 0.4].map((f) => (
                  <option key={f} value={f}>
                    {Math.round(f * 100)} %
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Weekly check-in day</span>
            <select id="p-day" value={draft.checkInDay} onChange={(e) => setDraft({ ...draft, checkInDay: Number(e.target.value) })}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </section>

        {preview?.ci && (
          <section className="panel">
            <h2 className="panel-title">Your targets</h2>
            <p className="small muted">
              Based on an expenditure of {preview.exp} kcal/day{current ? `; currently ${current.kcal} kcal` : ''}.
            </p>
            <div className="summary-stats">
              <Stat label="Calories" value={preview.ci.targets.kcal} />
              <Stat label="Protein" value={`${preview.ci.targets.protein} g`} />
              <Stat label="Carbs" value={`${preview.ci.targets.carbs} g`} />
            </div>
            <p className="small">Fat {preview.ci.targets.fat} g</p>
          </section>
        )}

        <button className="btn btn-primary btn-wide" disabled={!valid} onClick={save}>
          {setup ? 'Start my plan' : 'Save plan'}
        </button>
        <p className="muted small">
          This is an estimate for healthy adults, not medical advice. The app never sets calories below 1 200 (women) or
          1 500 (men) kcal a day.
        </p>
      </main>
    </>
  );
}
