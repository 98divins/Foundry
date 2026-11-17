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
  MACRO_LABEL,
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
import { MoveSheet } from './MoveSheet';
import { PlanSheet } from './PlanSheet';
import { locale, t, tp } from '../../i18n';
import { canAdd, requirePro } from '../../pro';
import { bmi, MIN_BMI } from '../../safeguards';

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
  const [more, setMore] = useState(false);
  const today = dayKey();
  const totals = dayTotals(n.log, date);
  const planned = n.log.filter((e) => e.date === date && e.planned);
  const plannedKcal = Math.round(planned.reduce((s, e) => s + e.kcal, 0));
  const future = date > today;
  const confirm = (ids: string[]) => setN((x) => ({ ...x, log: x.log.map((e) => (ids.includes(e.id) ? { ...e, planned: false } : e)) }));
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
            <p>
              {t(
                'Log what you eat and weigh in most mornings. Foundry estimates how many calories you really burn from your weight trend and intake, then adjusts your calorie and macro targets every week.',
              )}
            </p>
            <button className="btn btn-primary btn-wide" onClick={() => go('n/setup')}>
              {t('Set up my plan')}
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
            disabled={date >= addDays(today, 60)}
            onClick={() => go('n/' + addDays(date, 1), { replace: true })}
          >
            <Icon name="chevron" />
          </button>
        </div>

        {future && <p className="plan-banner small">{t('Planning ahead: foods you add here are planned. Confirm them on the day.')}</p>}
        {!future && planned.length > 0 && (
          <div className="plan-banner small">
            <span>{tp(planned.length, '{n} planned food to confirm ({kcal} kcal)', '{n} planned foods to confirm ({kcal} kcal)', { kcal: plannedKcal })}</span>
            <button className="btn btn-small btn-primary" onClick={() => confirm(planned.map((e) => e.id))}>
              {t('Confirm all')}
            </button>
          </div>
        )}

        {n.rateKgPerWeek < 0 && n.profile && trend != null && (bmi(trend, n.profile.heightCm) ?? 99) < MIN_BMI && (
          <div className="plan-banner small">
            <span>{t('Your weight is now low for your height. Switching to maintenance is recommended; talk to a doctor if you are worried.')}</span>
            <button
              className="btn btn-small btn-primary"
              onClick={() =>
                setN((x) => {
                  const next = { ...x, rateKgPerWeek: 0 };
                  const ci = makeCheckIn(next, dayKey());
                  return ci ? { ...next, checkIns: [...next.checkIns.filter((c) => c.date !== ci.date), ci] } : next;
                })
              }
            >
              {t('Maintain my weight')}
            </button>
          </div>
        )}

        {due && (
          <button className="checkin-banner" onClick={() => requirePro('adaptiveCoach') && setCheckIn(true)}>
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
            {targets && (
              <div className="kcal-side small muted">
                <span>
                  {t('Eaten')} <strong className="fg">{totals.kcal}</strong>
                </span>
                <span>
                  {t('Target')} <strong className="fg">{targets.kcal}</strong>
                </span>
              </div>
            )}
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
            date={date}
            entries={entries.filter((e) => e.meal === meal)}
            onAdd={() => go(`n/add/${date}/${meal}`)}
            onEdit={setEditing}
            onConfirm={confirm}
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
                  incompleteDays: e.target.checked ? [...x.incompleteDays, date] : x.incompleteDays.filter((d) => d !== date),
                }))
              }
            />
            {t('I did not log everything this day (leave it out of the expenditure estimate)')}
          </label>
        )}

        <button className="btn btn-wide more-row" onClick={() => setMore(true)}>
          <Icon name="list" size={18} />
          <span>{t('Weight · Expenditure · Meals · Plan')}</span>
          <Icon name="chevron" size={18} />
        </button>
        <Sheet open={more} onClose={() => setMore(false)} title={t('More')}>
          <div className="menu">
            {(
              [
                ['ruler', t('Weight'), t('Your weigh-ins and the trend line.'), 'n/weight'],
                ['chart', t('Expenditure'), t('How many calories you really burn, learned from your data.'), 'n/insights'],
                ['copy', t('Meals'), t('Your saved meals, meal ideas and community meals.'), 'n/meals'],
                ['flag', t('Plan'), t('Your goal, calories and macros.'), 'n/plan'],
              ] as const
            ).map(([icon, label, text, to]) => (
              <button
                key={to}
                className="menu-item routine-kind"
                onClick={() => {
                  setMore(false);
                  go(to);
                }}
              >
                <Icon name={icon} size={22} />
                <span>
                  <strong>{label}</strong>
                  <span className="muted small">{text}</span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      </main>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
      <CheckInSheet open={checkIn} onClose={() => setCheckIn(false)} current={targets} />
    </>
  );
}

function EntryRow({ e, onEdit, onConfirm }: { e: FoodEntry; onEdit: (e: FoodEntry) => void; onConfirm?: (ids: string[]) => void }) {
  return (
    <li className={e.planned ? 'planned' : ''}>
      <div className="entry-line">
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
        {e.planned && onConfirm && (
          <button className="icon-btn confirm-btn" aria-label={t('I ate it')} onClick={() => onConfirm([e.id])}>
            <Icon name="check" size={18} />
          </button>
        )}
      </div>
    </li>
  );
}

/** Meals the user unfolded during this session. */
const openMeals = new Set<Meal>();

function MealSection({
  meal,
  date,
  entries,
  onAdd,
  onEdit,
  onConfirm,
}: {
  meal: Meal;
  date: string;
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (e: FoodEntry) => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [planning, setPlanning] = useState(false);
  const canConfirm = date <= dayKey();
  const plannedHere = entries.filter((e) => e.planned);
  const { n: nAll, setN } = useNutrition();
  const savedCount = nAll.savedMeals.length;
  const [open, setOpen] = useState<string | null>(null);
  const [groupMenu, setGroupMenu] = useState<FoodEntry[] | null>(null);
  const [moving, setMoving] = useState<{ entries: FoodEntry[]; title: string } | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const kcal = entries.reduce((t, e) => t + e.kcal, 0);
  const sum = (k: 'protein' | 'carbs' | 'fat') => fmtNum(Math.round(entries.reduce((t, e) => t + e[k], 0)));
  // Meals start folded so the day stays short; the choice is kept while the app is open.
  const [expanded, setExpandedState] = useState(() => openMeals.has(meal));
  const setExpanded = (v: boolean) => {
    if (v) openMeals.add(meal);
    else openMeals.delete(meal);
    setExpandedState(v);
  };

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
    if (!canAdd('savedMeals', savedCount)) return;
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
        {entries.length ? (
          <button className="meal-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            <span className="meal-title">
              <Icon name="chevron" size={16} />
              <h2>{t(MEAL_LABEL[meal])}</h2>
            </span>
            <span className="muted small">
              {tp(entries.length, '{n} food', '{n} foods')} · {Math.round(kcal)} kcal ·{' '}
              {t('P {p} · C {c} · F {f}', { p: sum('protein'), c: sum('carbs'), f: sum('fat') })}
            </span>
          </button>
        ) : (
          <h2 className="meal-title-empty">{t(MEAL_LABEL[meal])}</h2>
        )}
        <button className="btn btn-small" onClick={onAdd} aria-label={t('Add food to {meal}', { meal: t(MEAL_LABEL[meal]) })}>
          <Icon name="plus" size={16} /> {t('Add')}
        </button>
      </div>
      {expanded && blocks.length > 0 && (
        <ul className="entries">
          {blocks.map((b) =>
            Array.isArray(b) ? (
              <li key={b[0].group!.id} className="meal-block">
                <div className="entry">
                  <button
                    className="entry-text block-toggle"
                    onClick={() => setOpen(open === b[0].group!.id ? null : b[0].group!.id)}
                    aria-expanded={open === b[0].group!.id}
                  >
                    <span className="entry-name">
                      <Icon name="chevron" size={14} /> {b[0].group!.name}
                      {b[0].group!.servings !== 1 && <span className="muted"> × {fmtNum(b[0].group!.servings)}</span>}
                    </span>
                    <span className="muted small">
                      {t('{0} foods · P {1} · C {3} · F {4}', {
                        0: b.length,
                        1: fmtNum(Math.round(b.reduce((t, e) => t + e.protein, 0))),
                        3: fmtNum(Math.round(b.reduce((t, e) => t + e.carbs, 0))),
                        4: fmtNum(Math.round(b.reduce((t, e) => t + e.fat, 0))),
                      })}
                    </span>
                  </button>
                  <span className="entry-kcal">{Math.round(b.reduce((t, e) => t + e.kcal, 0))}</span>
                  <button className="icon-btn" aria-label={t('Options for {name}', { name: b[0].group!.name })} onClick={() => setGroupMenu(b)}>
                    <Icon name="dots" />
                  </button>
                </div>
                {open === b[0].group!.id && (
                  <ul className="entries nested">
                    {b.map((e) => (
                      <EntryRow key={e.id} e={e} onEdit={onEdit} onConfirm={canConfirm ? onConfirm : undefined} />
                    ))}
                  </ul>
                )}
              </li>
            ) : (
              <EntryRow key={b.id} e={b} onEdit={onEdit} onConfirm={canConfirm ? onConfirm : undefined} />
            ),
          )}
        </ul>
      )}
      {expanded && entries.length > 0 && (
        <div className="meal-actions">
          {canConfirm && plannedHere.length > 0 && (
            <button className="add-in-folder" onClick={() => onConfirm(plannedHere.map((e) => e.id))}>
              <Icon name="check" size={15} /> {t('I ate this meal')}
            </button>
          )}
          <button className="add-in-folder" onClick={() => setMoving({ entries, title: t('Move: {meal}', { meal: t(MEAL_LABEL[meal]) }) })}>
            <Icon name="swap" size={15} /> {t('Move')}
          </button>
          <button className="add-in-folder" onClick={() => setPlanning(true)}>
            <Icon name="history" size={15} /> {t('Plan on other days')}
          </button>
          {entries.length > 1 && (
            <button className="add-in-folder" onClick={() => setNaming('')}>
              <Icon name="copy" size={15} /> {t('Save as meal')}
            </button>
          )}
        </div>
      )}
      <PlanSheet
        open={planning}
        onClose={() => setPlanning(false)}
        title={t('Plan this {meal}', { meal: t(MEAL_LABEL[meal]).toLowerCase() })}
        defaultMeal={meal}
        skipDate={date}
        make={(d, m) =>
          entries.map(({ id: _id, planned: _p, group, ...rest }, k) => ({
            ...rest,
            date: d,
            meal: m,
            createdAt: Date.now() + k,
            ...(group ? { group: { ...group, id: group.id + '-' + d + '-' + m } } : {}),
          }))
        }
      />

      <MoveSheet entries={moving?.entries ?? null} title={moving?.title} onClose={() => setMoving(null)} />
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
              <Icon name="unlink" size={18} /> {t('Show as separate foods')}
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setMoving({ entries: groupMenu, title: t('Move “{name}”', { name: groupMenu[0].group!.name }) });
                setGroupMenu(null);
              }}
            >
              <Icon name="swap" size={18} /> {t('Move to another meal or day')}
            </button>
            <button
              className="menu-item"
              onClick={() => {
                go('n/meals/' + groupMenu[0].group!.savedMealId);
                setGroupMenu(null);
              }}
            >
              <Icon name="edit" size={18} /> {t('Edit the saved meal')}
            </button>
            <button
              className="menu-item danger"
              onClick={() => {
                const gid = groupMenu[0].group!.id;
                setN((x) => ({ ...x, log: x.log.filter((e) => e.group?.id !== gid) }));
                setGroupMenu(null);
              }}
            >
              <Icon name="trash" size={18} /> {t('Remove from this day')}
            </button>
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
          <p className="muted small">
            {t('The {0} foods of this {1} become a meal you can log in one tap.', { 0: entries.length, 1: t(MEAL_LABEL[meal]).toLowerCase() })}
          </p>
          <label className="field">
            <span>{t('Meal name')}</span>
            <input id="save-meal-name" autoFocus placeholder={t('e.g. Usual breakfast')} value={naming ?? ''} onChange={(e) => setNaming(e.target.value)} />
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setNaming(null)}>
              {t('Cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={!naming?.trim()}>
              {t('Save meal')}
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
        <span className="eyebrow">{t('Weigh-in')}</span>
        {weigh != null ? (
          <span>
            <strong>
              {fmtNum(toDisplay(weigh, unit))} {unit}
            </strong>
            {trend != null && (
              <span className="muted small">{t('{0} · trend {1} {2}', { 0: ' ', 1: fmtNum(Math.round(toDisplay(trend, unit) * 10) / 10), 2: unit })}</span>
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
              ? t('Your estimated expenditure is {kcal} kcal/day and your trend weight is {kg} kg. New daily targets:', {
                  kcal: ci.expenditure,
                  kg: ci.trendKg,
                })
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
                  <td>{t(MACRO_LABEL[k])}</td>
                  <td className="muted">{current ? current[k] : '–'}</td>
                  <td>
                    <strong>{ci.targets[k]}</strong> {k === 'kcal' ? t('kcal') : 'g'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sheet-actions">
            <button className="btn" onClick={onClose}>
              {t('Later')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setN((x) => ({ ...x, checkIns: [...x.checkIns, ci] }));
                onClose();
              }}
            >
              {t('Apply targets')}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
