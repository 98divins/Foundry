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
import { locale, t } from '../../i18n';

export function fmtDay(key: string): string {
  const today = dayKey();
  if (key === today) return t('Today');
  if (key === addDays(today, -1)) return t('Yesterday');
  if (key === addDays(today, 1)) return t('Tomorrow');
  return parseDay(key).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
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
        <Header title={t('Nutrition')} />
        <main className="page">
          <section className="hero-card">
            <span className="eyebrow">{t('Get started')}</span>
            <h2 className="hero-title">{t('Eat to your goal')}</h2>
            <p>{t('Log what you eat and weigh in most mornings. Foundry estimates how many calories you really burn from your weight trend and intake, then adjusts your calorie and macro targets every week.')}</p>
            <button className="btn btn-primary btn-wide" onClick={() => go('n/setup')}>{t('Set up my plan')}</button>
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
        title={t('Nutrition')}
        right={
          <button className="icon-btn" aria-label={t('Plan and settings')} onClick={() => go('n/plan')}>
            <Icon name="edit" />
          </button>
        }
      />
      <main className="page">
        <div className="day-nav">
          <button className="icon-btn" aria-label={t('Previous day')} onClick={() => go('n/' + addDays(date, -1), { replace: true })}>
            <Icon name="back" />
          </button>
          <button className="day-label" onClick={() => go('n/' + today, { replace: true })} disabled={date === today}>
            {fmtDay(date)}
          </button>
          <button
            className="icon-btn"
            aria-label={t('Next day')}
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
              <strong>{t('Weekly check-in')}</strong>
              <span className="small">{t('· review your new targets')}</span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        )}

        <section className="panel kcal-panel">
          <div className="kcal-top">
            <div>
              <span className="eyebrow">{remaining == null ? t('Eaten') : remaining >= 0 ? t('Remaining') : t('Over target')}</span>
              <p className="kcal-big">
                {remaining == null ? totals.kcal : Math.abs(remaining)}
                <span className="kcal-unit">{t('kcal')}</span>
              </p>
            </div>
            <div className="kcal-side small muted">
              <span>{t('Eaten')}{' '}<strong className="fg">{totals.kcal}</strong>
              </span>
              {targets && (
                <span>{t('Target')}{' '}<strong className="fg">{targets.kcal}</strong>
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
            <MacroBar label={t('Protein')} value={totals.protein} target={targets?.protein} tone="p" />
            <MacroBar label={t('Carbs')} value={totals.carbs} target={targets?.carbs} tone="c" />
            <MacroBar label={t('Fat')} value={totals.fat} target={targets?.fat} tone="f" />
          </div>
          {!targets && (
            <p className="muted small">
              {n.weights.length ? t('Open the weekly check-in above to get your targets.') : t('Log a weigh-in to get your first targets.')}
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
            />{t('I did not log everything this day (leave it out of the expenditure estimate)')}</label>
        )}

        <div className="link-row">
          <button className="btn" onClick={() => go('n/weight')}>{t('Weight')}</button>
          <button className="btn" onClick={() => go('n/insights')}>{t('Expenditure')}</button>
          <button className="btn" onClick={() => go('n/meals')}>{t('Meals')}</button>
          <button className="btn" onClick={() => go('n/plan')}>{t('Plan')}</button>
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
            {e.grams != null ? `${fmtNum(e.grams)} g · ` : t('Quick add') + ' · '}
            {t('P {p} · C {c} · F {f}', { p: fmtNum(Math.round(e.protein)), c: fmtNum(Math.round(e.carbs)), f: fmtNum(Math.round(e.fat)) })}
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
      savedMeals: [...x.savedMeals, { id, name: name.trim() || t(MEAL_LABEL[meal]), items: itemsFromEntries(entries), updatedAt: Date.now() }],
    }));
    setNaming(null);
    go('n/meals/' + id);
  };

  return (
    <section className="meal">
      <div className="meal-head">
        <h2>{t(MEAL_LABEL[meal])}</h2>
        <span className="muted small">{kcal ? `${Math.round(kcal)} kcal` : ''}</span>
        <button className="btn btn-small" onClick={onAdd} aria-label={t('Add food to {meal}', { meal: t(MEAL_LABEL[meal]) })}>
          <Icon name="plus" size={16} />{' '}{t('Add')}</button>
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
                      {t('{0} foods · P {1} · C {3} · F {4}', { 0: b.length, 1: fmtNum(Math.round(b.reduce((t, e) => t + e.protein, 0))), 3: fmtNum(Math.round(b.reduce((t, e) => t + e.carbs, 0))), 4: fmtNum(Math.round(b.reduce((t, e) => t + e.fat, 0))) })}</span>
                  </button>
                  <span className="entry-kcal">{Math.round(b.reduce((t, e) => t + e.kcal, 0))}</span>
                  <button className="icon-btn" aria-label={t('Options for {name}', { name: b[0].group!.name })} onClick={() => setGroupMenu(b)}>
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
          <Icon name="copy" size={15} />{' '}{t('Save as meal')}</button>
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
              <Icon name="unlink" size={18} />{' '}{t('Show as separate foods')}</button>
            <button className="menu-item" onClick={() => { go('n/meals/' + groupMenu[0].group!.savedMealId); setGroupMenu(null); }}>
              <Icon name="edit" size={18} />{' '}{t('Edit the saved meal')}</button>
            <button
              className="menu-item danger"
              onClick={() => {
                const gid = groupMenu[0].group!.id;
                setN((x) => ({ ...x, log: x.log.filter((e) => e.group?.id !== gid) }));
                setGroupMenu(null);
              }}
            >
              <Icon name="trash" size={18} />{' '}{t('Remove from this day')}</button>
          </div>
        )}
      </Sheet>

      <Sheet open={naming != null} onClose={() => setNaming(null)} title={t('Save as meal')}>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            saveAsMeal(naming ?? '');
          }}
        >
          <p className="muted small">{t('The {0} foods of this {1} become a meal you can log in one tap.', { 0: entries.length, 1: t(MEAL_LABEL[meal]).toLowerCase() })}</p>
          <label className="field">
            <span>{t('Meal name')}</span>
            <input id="save-meal-name" autoFocus placeholder={t('e.g. Usual breakfast')} value={naming ?? ''} onChange={(e) => setNaming(e.target.value)} />
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setNaming(null)}>{t('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={!naming?.trim()}>{t('Save meal')}</button>
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
        <span className="eyebrow">{t('Weigh-in')}</span>
        {weigh != null ? (
          <span>
            <strong>
              {fmtNum(toDisplay(weigh, unit))} {unit}
            </strong>
            {trend != null && (
              <span className="muted small">
                {t('{0} · trend {1} {2}', { 0: ' ', 1: fmtNum(Math.round(toDisplay(trend, unit) * 10) / 10), 2: unit })}</span>
            )}
          </span>
        ) : (
          <span className="muted small">{t('Weigh yourself in the morning, after the toilet, before eating.')}</span>
        )}
      </div>
      <form
        className="weigh-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <NumInput id="weigh-input" label={t('Weight in {unit}', { unit })} value={value} placeholder={unit} onChange={setValue} />
        <button className="btn btn-small btn-primary" type="submit" disabled={!value}>
          {weigh != null ? t('Update') : t('Save')}
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
    <Sheet open onClose={onClose} title={t('Weekly check-in')}>
      {!ci ? (
        <p className="muted sheet-text">{t('Log a weigh-in first.')}</p>
      ) : (
        <>
          <p className="sheet-text">
            {ci.trendKg != null
              ? t('Your estimated expenditure is {kcal} kcal/day and your trend weight is {kg} kg. New daily targets:', { kcal: ci.expenditure, kg: ci.trendKg })
              : t('Your estimated expenditure is {kcal} kcal/day. New daily targets:', { kcal: ci.expenditure })}
          </p>
          <table className="ci-table">
            <thead>
              <tr>
                <th />
                <th>{t('Now')}</th>
                <th>{t('New')}</th>
              </tr>
            </thead>
            <tbody>
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                <tr key={k}>
                  <td>{k === 'kcal' ? t('Calories') : k[0].toUpperCase() + k.slice(1)}</td>
                  <td className="muted">{current ? current[k] : '–'}</td>
                  <td>
                    <strong>{ci.targets[k]}</strong> {k === 'kcal' ? t('kcal') : 'g'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sheet-actions">
            <button className="btn" onClick={onClose}>{t('Later')}</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setN((x) => ({ ...x, checkIns: [...x.checkIns, ci] }));
                onClose();
              }}
            >{t('Apply targets')}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
