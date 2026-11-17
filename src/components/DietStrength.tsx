import { useMemo, useState } from 'react';
import { strengthIndexByWeek, weekStarts, weeklyDiet } from '../analytics';
import { dietTips, endPhase, PHASE_LABEL, phaseReview, startPhase, weeklyCard, weeklyExpenditure, weekSummaries } from '../dietStrength';
import { go } from '../hooks';
import { locale, t } from '../i18n';
import { dayKey, expenditureSeries, latestTrend, parseDay, type PhaseKind } from '../nutrition';
import { useStore } from '../store';
import { toDisplay, uid } from '../utils';
import { Icon, Segmented } from './ui';

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString(locale(), { maximumFractionDigits: 1 });

/** Last complete week: calorie gap, protein per kg, strength index change, and tips (4.5). */
export function DietStrengthCard() {
  const { state } = useStore();
  const { workouts, nutrition } = state;
  const starts = useMemo(() => weekStarts(6), []);
  const weeks = useMemo(() => {
    const diet = weeklyDiet(nutrition, starts);
    const index = strengthIndexByWeek(workouts, starts);
    return weekSummaries(diet, index, weeklyExpenditure(expenditureSeries(nutrition), starts));
  }, [nutrition, workouts, starts]);
  const card = weeklyCard(weeks);
  const tips = useMemo(() => dietTips(weeks, latestTrend(nutrition)), [weeks, nutrition]);
  if (!card) return null;
  const week = new Date(card.start).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  return (
    <section className="panel diet-strength">
      <button className="panel-title-row" onClick={() => go('stats/diet')}>
        <h2 className="panel-title">{t('Diet × strength · week of {d}', { d: week })}</h2>
        <Icon name="chevron" size={18} />
      </button>
      <div className="stats-row">
        <div className="stat">
          <span className="stat-value">{card.kcalGap != null ? sign(card.kcalGap) : '–'}</span>
          <span className="muted small">{t('kcal/day vs expenditure')}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{card.proteinPerKg != null ? card.proteinPerKg.toLocaleString(locale()) : '–'}</span>
          <span className="muted small">{t('g protein per kg')}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{card.strengthDelta != null ? sign(card.strengthDelta) : '–'}</span>
          <span className="muted small">{t('Strength index (pts)')}</span>
        </div>
      </div>
      {tips.map((tip) => (
        <div key={tip.id} className="tip" role="note">
          <strong>{t(tip.title)}</strong>
          <p className="small">{t(tip.text)}</p>
        </div>
      ))}
      <p className="muted small">{t('Patterns in your own data, not proof of cause.')}</p>
    </section>
  );
}

/** Phases: mark a period as a cut, maintenance or bulk, and compare them (4.5). */
export function Phases() {
  const { state, update } = useStore();
  const unit = state.settings.unit;
  const phases = useMemo(() => state.nutrition.phases ?? [], [state.nutrition.phases]);
  const running = phases.find((p) => !p.end);
  const [kind, setKind] = useState<PhaseKind>('cut');
  const [start, setStart] = useState(dayKey());
  const reviews = useMemo(() => phases.map((p) => phaseReview(p, state.workouts, state.nutrition)).reverse(), [phases, state.workouts, state.nutrition]);
  const setPhases = (f: (p: typeof phases) => typeof phases) => update((s) => ({ ...s, nutrition: { ...s.nutrition, phases: f(s.nutrition.phases ?? []) } }));
  const fmt = (d: string) => parseDay(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className="panel">
      <h2 className="panel-title">{t('Phases')}</h2>
      <p className="muted small">{t('Mark a period as a cut, maintenance or bulk to compare how your weight and strength moved in each.')}</p>
      <Segmented<PhaseKind>
        label={t('Phase')}
        value={kind}
        onChange={setKind}
        options={(['cut', 'maintain', 'bulk'] as const).map((k) => ({ value: k, label: t(PHASE_LABEL[k]) }))}
      />
      <div className="phase-form">
        <label className="field">
          <span>{t('From')}</span>
          <input id="phase-start" type="date" value={start} max={dayKey()} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </label>
        <button className="btn btn-primary" onClick={() => setPhases((p) => startPhase(p, kind, start, uid()))}>
          {t('Start this phase')}
        </button>
      </div>
      {running && (
        <button className="btn btn-wide" onClick={() => setPhases((p) => endPhase(p, dayKey()))}>
          {t('End the {phase} today', { phase: t(PHASE_LABEL[running.kind]).toLowerCase() })}
        </button>
      )}
      {reviews.length > 0 && (
        <ul className="phase-list">
          {reviews.map((r) => (
            <li key={r.phase.id} className={'phase phase-' + r.phase.kind}>
              <div className="phase-head">
                <strong>{t(PHASE_LABEL[r.phase.kind])}</strong>
                <span className="muted small">
                  {fmt(r.phase.start)} → {r.phase.end ? fmt(r.phase.end) : t('now')} · {t('{n} weeks', { n: Math.round(r.days / 7) })}
                </span>
                <button className="link-btn" aria-label={t('Delete')} onClick={() => setPhases((p) => p.filter((x) => x.id !== r.phase.id))}>
                  <Icon name="x" size={14} />
                </button>
              </div>
              <div className="phase-stats small">
                <span>
                  {t('Weight')} <strong>{r.weightChange != null ? `${sign(Math.round(toDisplay(r.weightChange, unit) * 10) / 10)} ${unit}` : '–'}</strong>
                </span>
                <span>
                  {t('Strength')} <strong>{r.strengthChange != null ? `${sign(r.strengthChange)} %` : '–'}</strong>
                </span>
                <span>
                  {t('Calories')} <strong>{r.avgKcal ?? '–'}</strong>
                </span>
                <span>
                  {t('Protein')} <strong>{r.proteinPerKg != null ? `${r.proteinPerKg.toLocaleString(locale())} g/kg` : '–'}</strong>
                </span>
              </div>
              {r.strengthChange == null && (
                <p className="muted small">{t('Strength is compared after 3 weeks, on lifts done in both the first and last two weeks.')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
