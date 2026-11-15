import { useState } from 'react';
import { Header, Icon, Segmented } from '../components/ui';
import { goalWeeks, weekGoal } from '../goals';
import { back, go } from '../hooks';
import { locale, t, tp } from '../i18n';
import { useStore } from '../store';
import { weekStart } from '../utils';

const DAY = 86400000;

/** Set the weekly goals: training days, and days within the nutrition targets. */
export function GoalsPage() {
  const { state, update } = useStore();
  const g = state.goals;
  const [training, setTraining] = useState(g?.trainingDays ?? 3);
  const [diet, setDiet] = useState<number | null>(g?.dietDays ?? null);
  const hasPlan = state.nutrition.checkIns.length > 0;
  const save = () => {
    update((s) => ({ ...s, goals: { trainingDays: training, dietDays: diet, setAt: s.goals?.setAt ?? Date.now() } }));
    back('profile');
  };
  return (
    <>
      <Header title={t('My goals')} onBack={() => back('profile')} />
      <main className="page">
        <p className="muted">{t('Set what you aim for each week. Progress shows how often you hit it, and friends can compare how well each of you keeps their own goals.')}</p>
        <section className="panel form">
          <h2 className="panel-title">{t('Training')}</h2>
          <span>{t('Training days per week')}</span>
          <Segmented<string> label={t('Training days per week')} value={String(training)} onChange={(v) => setTraining(Number(v))} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))} />
          <p className="muted small">{t('A day counts once, however many routines you do that day.')}</p>
        </section>
        <section className="panel form">
          <h2 className="panel-title">{t('Diet')}</h2>
          <span>{t('Days within my targets per week')}</span>
          <Segmented<string>
            label={t('Days within my targets per week')}
            value={diet == null ? 'off' : String(diet)}
            onChange={(v) => setDiet(v === 'off' ? null : Number(v))}
            options={[{ value: 'off', label: t('Off') }, ...[3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))]}
          />
          <p className="muted small">{t('A day is within target when it is fully logged, calories are within 10 % of your target and protein reaches 90 % of it.')}</p>
          {diet != null && !hasPlan && (
            <p className="field-error small">
              {t('Set up your nutrition plan first, so there are targets to measure against.')}{' '}
              <button className="link-btn" onClick={() => go('n/setup')}>
                {t('Set up my plan')}
              </button>
            </p>
          )}
        </section>
        <button className="btn btn-primary btn-wide" onClick={save}>
          {t('Save my goals')}
        </button>
        {g && (
          <button
            className="btn btn-ghost-danger btn-wide"
            onClick={() => {
              update((s) => ({ ...s, goals: undefined }));
              back('profile');
            }}
          >
            {t('Remove my goals')}
          </button>
        )}
      </main>
    </>
  );
}

function Bar({ label, done, goal }: { label: string; done: number; goal: number }) {
  return (
    <div className="goal-bar">
      <span className="goal-bar-head">
        <span>{label}</span>
        <strong className={done >= goal ? 'met' : ''}>
          {done} / {goal}
        </strong>
      </span>
      <span className="goal-track">
        <span className={'goal-fill' + (done >= goal ? ' met' : '')} style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
      </span>
    </div>
  );
}

/** This week's goals and the last 8 weeks, on the Progress tab. */
export function GoalsCard() {
  const { state } = useStore();
  const g = state.goals;
  if (!g) {
    return (
      <button className="panel goals-cta" onClick={() => go('goals')}>
        <Icon name="flag" size={22} />
        <span>
          <strong>{t('Set my weekly goals')}</strong>
          <span className="muted small">{t('Training days and days within your diet targets: see each week if you hit them.')}</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>
    );
  }
  const now = Date.now();
  const week = weekGoal(state, g, weekStart(now), now);
  const past = goalWeeks(state, g, weekStart(now) - 8 * 7 * DAY, now);
  const met = past.filter((w) => w.met).length;
  let run = 0;
  for (let i = past.length - 1; i >= 0 && past[i].met; i--) run++;
  return (
    <section className="panel goals-card">
      <div className="goals-head">
        <h2 className="panel-title">{t('Goals this week')}</h2>
        <button className="link-btn small" onClick={() => go('goals')}>
          {t('Edit')}
        </button>
      </div>
      <Bar label={t('Training days')} done={week.training.done} goal={week.training.goal} />
      {week.diet && <Bar label={t('Days within diet targets')} done={week.diet.done} goal={week.diet.goal} />}
      {week.met && <p className="ok-line small">{t('Goals met this week. Well done!')}</p>}
      {past.length > 0 && (
        <>
          <div className="goal-weeks" aria-label={t('Last weeks')}>
            {past.map((w) => (
              <span key={w.start} className={w.met ? 'met' : ''} title={new Date(w.start).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}>
                {w.met ? <Icon name="check" size={14} /> : null}
              </span>
            ))}
          </div>
          <p className="muted small">
            {t('Met {a} of the last {b} weeks', { a: met, b: past.length })}
            {run > 1 && ' · ' + tp(run, '{n} week in a row', '{n} weeks in a row')}
          </p>
        </>
      )}
    </section>
  );
}
