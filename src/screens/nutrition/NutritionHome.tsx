import { useState } from 'react';
import { Header, Icon, NumInput, Sheet } from '../../components/ui';
import { go } from '../../hooks';
import {
  addDays,
  checkInDue,
  currentTargets,
  dayKey,
  dayTotals,
  latestTrend,
  makeCheckIn,
  MEAL_LABEL,
  MEALS,
  parseDay,
  type FoodEntry,
  type Macros,
  type Meal,
} from '../../nutrition';
import { useNutrition } from '../../store';
import { fmtNum, fromDisplay, toDisplay } from '../../utils';
import { EntrySheet } from './EntrySheet';

export function fmtDay(key: string): string {
  const today = dayKey();
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  return parseDay(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function MacroBar({ label, value, target, unit = 'g', tone }: { label: string; value: number; target?: number; unit?: string; tone: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target != null && value > target * 1.05;
  return (
    <div className="macro">
      <div className="macro-top">
        <span className="macro-label">{label}</span>
        <span className="macro-value">
          {fmtNum(Math.round(value))}
          {target != null && <span className="muted"> / {target}</span>} {unit}
        </span>
      </div>
      <span className="macro-track">
        <span className={'macro-fill ' + tone + (over ? ' over' : '')} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function NutritionHome({ date }: { date: string }) {
  const { n, setN, unit } = useNutrition();
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [checkIn, setCheckIn] = useState(false);
  const today = dayKey();
  const totals = dayTotals(n.log, date);
  const targets = currentTargets(n);
  const entries = n.log.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
  const weigh = n.weights.find((w) => w.date === date);
  const trend = latestTrend(n, date);
  const due = date === today && checkInDue(n, today);
  const incomplete = n.incompleteDays.includes(date);

  if (!n.profile) {
    return (
      <>
        <Header title="Nutrition" />
        <main className="page">
          <section className="hero-card">
            <span className="eyebrow">Get started</span>
            <h2 className="hero-title">Eat to your goal</h2>
            <p>
              Log what you eat and weigh in most mornings. Foundry estimates how many calories you really burn from your
              weight trend and intake, then adjusts your calorie and macro targets every week.
            </p>
            <button className="btn btn-primary btn-wide" onClick={() => go('n/setup')}>
              Set up my plan
            </button>
          </section>
        </main>
      </>
    );
  }

  const remaining = targets ? targets.kcal - totals.kcal : null;
  const pct = targets ? Math.min(100, (totals.kcal / targets.kcal) * 100) : 0;

  return (
    <>
      <Header
        title="Nutrition"
        right={
          <button className="icon-btn" aria-label="Plan and settings" onClick={() => go('n/plan')}>
            <Icon name="edit" />
          </button>
        }
      />
      <main className="page">
        <div className="day-nav">
          <button className="icon-btn" aria-label="Previous day" onClick={() => go('n/' + addDays(date, -1), { replace: true })}>
            <Icon name="back" />
          </button>
          <button className="day-label" onClick={() => go('n/' + today, { replace: true })} disabled={date === today}>
            {fmtDay(date)}
          </button>
          <button
            className="icon-btn"
            aria-label="Next day"
            disabled={date >= today}
            onClick={() => go('n/' + addDays(date, 1), { replace: true })}
          >
            <Icon name="chevron" />
          </button>
        </div>

        {due && (
          <button className="checkin-banner" onClick={() => setCheckIn(true)}>
            <Icon name="trophy" size={18} />
            <span>
              <strong>Weekly check-in</strong>
              <span className="small"> · review your new targets</span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        )}

        <section className="panel kcal-panel">
          <div className="kcal-top">
            <div>
              <span className="eyebrow">{remaining == null ? 'Eaten' : remaining >= 0 ? 'Remaining' : 'Over target'}</span>
              <p className="kcal-big">
                {remaining == null ? totals.kcal : Math.abs(remaining)}
                <span className="kcal-unit"> kcal</span>
              </p>
            </div>
            <div className="kcal-side small muted">
              <span>
                Eaten <strong className="fg">{totals.kcal}</strong>
              </span>
              {targets && (
                <span>
                  Target <strong className="fg">{targets.kcal}</strong>
                </span>
              )}
            </div>
          </div>
          {targets && (
            <span className="macro-track big">
              <span className={'macro-fill kcal' + (remaining! < 0 ? ' over' : '')} style={{ width: `${pct}%` }} />
            </span>
          )}
          <div className="macro-grid">
            <MacroBar label="Protein" value={totals.protein} target={targets?.protein} tone="p" />
            <MacroBar label="Carbs" value={totals.carbs} target={targets?.carbs} tone="c" />
            <MacroBar label="Fat" value={totals.fat} target={targets?.fat} tone="f" />
          </div>
          {!targets && <p className="muted small">Log a weigh-in to get your first targets.</p>}
        </section>

        <WeighInCard date={date} weigh={weigh?.kg ?? null} trend={trend} unit={unit} />

        {MEALS.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={entries.filter((e) => e.meal === meal)}
            onAdd={() => go(`n/add/${date}/${meal}`)}
            onEdit={setEditing}
          />
        ))}

        {entries.length > 0 && (
          <label className="toggle-line">
            <input
              id="day-incomplete"
              type="checkbox"
              checked={incomplete}
              onChange={(e) =>
                setN((x) => ({
                  ...x,
                  incompleteDays: e.target.checked
                    ? [...x.incompleteDays, date]
                    : x.incompleteDays.filter((d) => d !== date),
                }))
              }
            />
            I did not log everything this day (leave it out of the expenditure estimate)
          </label>
        )}

        <div className="link-row">
          <button className="btn" onClick={() => go('n/weight')}>
            Weight
          </button>
          <button className="btn" onClick={() => go('n/insights')}>
            Expenditure
          </button>
          <button className="btn" onClick={() => go('n/plan')}>
            Plan
          </button>
        </div>
      </main>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
      <CheckInSheet open={checkIn} onClose={() => setCheckIn(false)} current={targets} />
    </>
  );
}

function MealSection({
  meal,
  entries,
  onAdd,
  onEdit,
}: {
  meal: Meal;
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (e: FoodEntry) => void;
}) {
  const kcal = entries.reduce((t, e) => t + e.kcal, 0);
  return (
    <section className="meal">
      <div className="meal-head">
        <h2>{MEAL_LABEL[meal]}</h2>
        <span className="muted small">{kcal ? `${Math.round(kcal)} kcal` : ''}</span>
        <button className="btn btn-small" onClick={onAdd} aria-label={`Add food to ${MEAL_LABEL[meal]}`}>
          <Icon name="plus" size={16} /> Add
        </button>
      </div>
      {entries.length > 0 && (
        <ul className="entries">
          {entries.map((e) => (
            <li key={e.id}>
              <button className="entry" onClick={() => onEdit(e)}>
                <span className="entry-text">
                  <span className="entry-name">{e.name}</span>
                  <span className="muted small">
                    {e.grams != null ? `${fmtNum(e.grams)} g · ` : 'Quick add · '}P {fmtNum(Math.round(e.protein))} · C{' '}
                    {fmtNum(Math.round(e.carbs))} · F {fmtNum(Math.round(e.fat))}
                  </span>
                </span>
                <span className="entry-kcal">{Math.round(e.kcal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WeighInCard({ date, weigh, trend, unit }: { date: string; weigh: number | null; trend: number | null; unit: 'kg' | 'lb' }) {
  const { setN } = useNutrition();
  const [value, setValue] = useState<number | null>(null);
  const save = () => {
    if (!value) return;
    const kg = Math.round(fromDisplay(value, unit) * 100) / 100;
    setN((x) => ({ ...x, weights: [...x.weights.filter((w) => w.date !== date), { date, kg }] }));
    setValue(null);
  };
  return (
    <section className="weigh-card">
      <div className="weigh-text">
        <span className="eyebrow">Weigh-in</span>
        {weigh != null ? (
          <span>
            <strong>
              {fmtNum(toDisplay(weigh, unit))} {unit}
            </strong>
            {trend != null && (
              <span className="muted small">
                {' '}
                · trend {fmtNum(Math.round(toDisplay(trend, unit) * 10) / 10)} {unit}
              </span>
            )}
          </span>
        ) : (
          <span className="muted small">Weigh yourself in the morning, after the toilet, before eating.</span>
        )}
      </div>
      <form
        className="weigh-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <NumInput id="weigh-input" label={`Weight in ${unit}`} value={value} placeholder={unit} onChange={setValue} />
        <button className="btn btn-small btn-primary" type="submit" disabled={!value}>
          {weigh != null ? 'Update' : 'Save'}
        </button>
      </form>
    </section>
  );
}

function CheckInSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: Macros | null }) {
  const { n, setN } = useNutrition();
  if (!open) return null;
  const ci = makeCheckIn(n);
  return (
    <Sheet open onClose={onClose} title="Weekly check-in">
      {!ci ? (
        <p className="muted sheet-text">Log a weigh-in first.</p>
      ) : (
        <>
          <p className="sheet-text">
            Your estimated expenditure is <strong>{ci.expenditure} kcal/day</strong>
            {ci.trendKg != null && <> and your trend weight is <strong>{ci.trendKg} kg</strong></>}. New daily targets:
          </p>
          <table className="ci-table">
            <thead>
              <tr>
                <th />
                <th>Now</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                <tr key={k}>
                  <td>{k === 'kcal' ? 'Calories' : k[0].toUpperCase() + k.slice(1)}</td>
                  <td className="muted">{current ? current[k] : '–'}</td>
                  <td>
                    <strong>{ci.targets[k]}</strong> {k === 'kcal' ? 'kcal' : 'g'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sheet-actions">
            <button className="btn" onClick={onClose}>
              Later
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setN((x) => ({ ...x, checkIns: [...x.checkIns, ci] }));
                onClose();
              }}
            >
              Apply targets
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
