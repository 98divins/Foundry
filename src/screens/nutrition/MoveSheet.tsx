import { useEffect, useState } from 'react';
import { Sheet } from '../../components/ui';
import { t } from '../../i18n';
import { dayKey, MEAL_LABEL, MEALS, type FoodEntry, type Meal } from '../../nutrition';
import { useNutrition } from '../../store';

/** Move logged foods (one food, a saved meal or a whole meal) to another meal and/or day. */
export function MoveSheet({ entries, title, onClose }: { entries: FoodEntry[] | null; title?: string; onClose: () => void }) {
  const { setN } = useNutrition();
  const [meal, setMeal] = useState<Meal>('lunch');
  const [date, setDate] = useState(dayKey());
  useEffect(() => {
    if (!entries?.length) return;
    setMeal(entries[0].meal);
    setDate(entries[0].date);
  }, [entries]);
  if (!entries?.length) return null;
  const same = meal === entries[0].meal && date === entries[0].date;
  const move = () => {
    const ids = new Set(entries.map((e) => e.id));
    const future = date > dayKey();
    setN((x) => ({
      ...x,
      log: x.log.map((e) => (ids.has(e.id) ? { ...e, meal, date, ...(future ? { planned: true } : {}) } : e)),
    }));
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={title ?? t('Move')}>
      <div className="form">
        <p className="muted small">
          {entries.length > 1 ? t('Move these {n} foods to another meal or day.', { n: entries.length }) : t('Move this food to another meal or day.')}
        </p>
        <div className="chips wrap" role="radiogroup" aria-label={t('Meal')}>
          {MEALS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={meal === m} className={'chip' + (meal === m ? ' on' : '')} onClick={() => setMeal(m)}>
              {t(MEAL_LABEL[m])}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t('Day')}</span>
          <input id="move-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn-primary" onClick={move} disabled={same}>
            {t('Move')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
