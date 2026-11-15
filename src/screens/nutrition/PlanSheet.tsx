import { useState } from 'react';
import { Segmented, Sheet } from '../../components/ui';
import { locale, t, tp } from '../../i18n';
import { addDays, dayKey, MEAL_LABEL, MEALS, parseDay, type FoodEntry, type Meal } from '../../nutrition';
import { useNutrition, useStore } from '../../store';
import { uid } from '../../utils';

/** First day of the week containing `key` (follows the user's first-day-of-week setting). */
function weekOf(key: string, startsOn: number): string {
  const d = parseDay(key);
  return addDays(key, -((d.getDay() - startsOn + 7) % 7));
}

/**
 * Put foods on several days ahead as planned entries (they count once confirmed on the day).
 * `make(date, meal)` builds the entries for one day; the sheet picks the days and the meal slot.
 */
export function PlanSheet({
  open,
  onClose,
  title,
  defaultMeal,
  make,
  skipDate,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  defaultMeal: Meal;
  make: (date: string, meal: Meal) => Omit<FoodEntry, 'id'>[];
  skipDate?: string;
}) {
  const { setN } = useNutrition();
  const { state } = useStore();
  const startsOn = state.settings.weekStartsOn ?? 1;
  const today = dayKey();
  const [week, setWeek] = useState<'this' | 'next' | 'month'>('this');
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [days, setDays] = useState<string[]>([]);
  const [done, setDone] = useState('');
  const first = week === 'next' ? addDays(weekOf(today, startsOn), 7) : weekOf(today, startsOn);
  // A month view shows four full weeks from this one, on a calendar grid.
  const week7 = Array.from({ length: week === 'month' ? 35 : 7 }, (_, i) => addDays(first, i));
  const usable = week7.filter((d) => d >= today && d !== skipDate);
  const toggle = (d: string) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const weekdays = usable.filter((d) => {
    const w = parseDay(d).getDay();
    return w >= 1 && w <= 5;
  });

  const plan = () => {
    const added: FoodEntry[] = [];
    for (const d of days) for (const e of make(d, meal)) added.push({ ...e, id: uid(), planned: true });
    setN((x) => ({ ...x, log: [...x.log, ...added] }));
    setDone(tp(days.length, 'Planned on {n} day.', 'Planned on {n} days.'));
    setDays([]);
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        setDone('');
        setDays([]);
        onClose();
      }}
      title={title}
    >
      <div className="form">
        <p className="muted small">{t('Planned foods show on those days and count once you confirm you ate them.')}</p>
        <label className="field">
          <span>{t('Meal')}</span>
          <select id="plan-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t(MEAL_LABEL[m])}
              </option>
            ))}
          </select>
        </label>
        <Segmented<'this' | 'next' | 'month'>
          label={t('Week')}
          value={week}
          onChange={(w) => {
            setWeek(w);
            setDays([]);
          }}
          options={[
            { value: 'this', label: t('This week') },
            { value: 'next', label: t('Next week') },
            { value: 'month', label: t('Month') },
          ]}
        />
        <div className="plan-days">
          {week7.map((d) => {
            const disabled = !usable.includes(d);
            return (
              <button key={d} type="button" className={'plan-day' + (days.includes(d) ? ' on' : '')} disabled={disabled} aria-pressed={days.includes(d)} onClick={() => toggle(d)}>
                {(week !== 'month' || d < addDays(first, 7)) && <span className="small">{parseDay(d).toLocaleDateString(locale(), { weekday: 'short' })}</span>}
                <strong>{parseDay(d).getDate()}</strong>
              </button>
            );
          })}
        </div>
        <div className="chips">
          <button type="button" className="chip" onClick={() => setDays(usable)}>
            {t('Every day')}
          </button>
          <button type="button" className="chip" onClick={() => setDays(weekdays)}>
            {t('Weekdays')}
          </button>
          <button type="button" className="chip" onClick={() => setDays([])}>
            {t('None')}
          </button>
        </div>
        {done && <p className="ok-line small">{done}</p>}
        <button className="btn btn-primary btn-wide" disabled={!days.length} onClick={plan}>
          {tp(days.length, 'Plan on {n} day', 'Plan on {n} days')}
        </button>
      </div>
    </Sheet>
  );
}
