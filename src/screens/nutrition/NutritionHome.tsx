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
  itemsFromEntries,
  type FoodEntry,
  type Macros,
  type Meal,
} from '../../nutrition';
import { useNutrition } from '../../store';
import { fmtNum, fromDisplay, toDisplay, uid } from '../../utils';
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
          {!targets && (
            <p className="muted small">
              {n.weights.length ? 'Open the weekly check-in above to get your targets.' : 'Log a weigh-in to get your first targets.'}
            </p>
          )}
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
          <button className="btn" onClick={() => go('n/meals')}>
            Meals
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

function EntryRow({ e, onEdit }: { e: FoodEntry; onEdit: (e: FoodEntry) => void }) {
  return (
    <li>
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
  const { setN } = useNutrition();
  const [open, setOpen] = useState<string | null>(null);
  const [groupMenu, setGroupMenu] = useState<FoodEntry[] | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const kcal = entries.reduce((t, e) => t + e.kcal, 0);

  // Entries logged together from a saved meal show as one block.
  const blocks: (FoodEntry | FoodEntry[])[] = [];
  const seen = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    if (!e.group) blocks.push(e);
    else if (seen.has(e.group.id)) seen.get(e.group.id)!.push(e);
    else {
      const g = [e];
      seen.set(e.group.id, g);
      blocks.push(g);
    }
  }

  const saveAsMeal = (name: string) => {
    const id = uid();
    setN((x) => ({
      ...x,
      savedMeals: [...x.savedMeals, { id, name: name.trim() || MEAL_LABEL[meal], items: itemsFromEntries(entries), updatedAt: Date.now() }],
    }));
    setNaming(null);
    go('n/meals/' + id);
  };

  return (
    <section className="meal">
      <div className="meal-head">
        <h2>{MEAL_LABEL[meal]}</h2>
        <span className="muted small">{kcal ? `${Math.round(kcal)} kcal` : ''}</span>
        <button className="btn btn-small" onClick={onAdd} aria-label={`Add food to ${MEAL_LABEL[meal]}`}>
          <Icon name="plus" size={16} /> Add
        </button>
      </div>
      {blocks.length > 0 && (
        <ul className="entries">
          {blocks.map((b) =>
            Array.isArray(b) ? (
              <li key={b[0].group!.id} className="meal-block">
                <div className="entry">
                  <button className="entry-text block-toggle" onClick={() => setOpen(open === b[0].group!.id ? null : b[0].group!.id)} aria-expanded={open === b[0].group!.id}>
                    <span className="entry-name">
                      <Icon name="chevron" size={14} /> {b[0].group!.name}
                      {b[0].group!.servings !== 1 && <span className="muted"> × {b[0].group!.servings}</span>}
                    </span>
                    <span className="muted small">
                      {b.length} foods · P {fmtNum(Math.round(b.reduce((t, e) => t + e.protein, 0)))} · C{' '}
                      {fmtNum(Math.round(b.reduce((t, e) => t + e.carbs, 0)))} · F {fmtNum(Math.round(b.reduce((t, e) => t + e.fat, 0)))}
                    </span>
                  </button>
                  <span className="entry-kcal">{Math.round(b.reduce((t, e) => t + e.kcal, 0))}</span>
                  <button className="icon-btn" aria-label={`Options for ${b[0].group!.name}`} onClick={() => setGroupMenu(b)}>
                    <Icon name="dots" />
                  </button>
                </div>
                {open === b[0].group!.id && (
                  <ul className="entries nested">
                    {b.map((e) => (
                      <EntryRow key={e.id} e={e} onEdit={onEdit} />
                    ))}
                  </ul>
                )}
              </li>
            ) : (
              <EntryRow key={b.id} e={b} onEdit={onEdit} />
            ),
          )}
        </ul>
      )}
      {entries.length > 1 && (
        <button className="add-in-folder" onClick={() => setNaming('')}>
          <Icon name="copy" size={15} /> Save as meal
        </button>
      )}

      <Sheet open={!!groupMenu} onClose={() => setGroupMenu(null)} title={groupMenu?.[0].group?.name}>
        {groupMenu && (
          <div className="menu">
            <button
              className="menu-item"
              onClick={() => {
                const gid = groupMenu[0].group!.id;
                setN((x) => ({ ...x, log: x.log.map((e) => (e.group?.id === gid ? { ...e, group: undefined } : e)) }));
                setGroupMenu(null);
              }}
            >
              <Icon name="unlink" size={18} /> Show as separate foods
            </button>
            <button className="menu-item" onClick={() => { go('n/meals/' + groupMenu[0].group!.savedMealId); setGroupMenu(null); }}>
              <Icon name="edit" size={18} /> Edit the saved meal
            </button>
            <button
              className="menu-item danger"
              onClick={() => {
                const gid = groupMenu[0].group!.id;
                setN((x) => ({ ...x, log: x.log.filter((e) => e.group?.id !== gid) }));
                setGroupMenu(null);
              }}
            >
              <Icon name="trash" size={18} /> Remove from this day
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={naming != null} onClose={() => setNaming(null)} title="Save as meal">
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            saveAsMeal(naming ?? '');
          }}
        >
          <p className="muted small">The {entries.length} foods of this {MEAL_LABEL[meal].toLowerCase()} become a meal you can log in one tap.</p>
          <label className="field">
            <span>Meal name</span>
            <input id="save-meal-name" autoFocus placeholder="e.g. Usual breakfast" value={naming ?? ''} onChange={(e) => setNaming(e.target.value)} />
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setNaming(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!naming?.trim()}>
              Save meal
            </button>
          </div>
        </form>
      </Sheet>
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
