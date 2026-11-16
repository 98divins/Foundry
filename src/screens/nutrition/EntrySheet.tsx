import { useEffect, useState } from 'react';
import { NumInput, Sheet } from '../../components/ui';
import { dayKey, MACRO_LABEL, MEAL_LABEL, MEALS, round1, type FoodEntry, type Meal } from '../../nutrition';
import { useNutrition } from '../../store';
import { t } from '../../i18n';

/** Edit or delete a logged food: change the amount (macros scale with it) or the meal. */
export function EntrySheet({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  const { setN } = useNutrition();
  const [grams, setGrams] = useState<number | null>(null);
  const [meal, setMeal] = useState<Meal>('breakfast');
  const [date, setDate] = useState('');
  const [quick, setQuick] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

  useEffect(() => {
    if (!entry) return;
    setGrams(entry.grams);
    setMeal(entry.meal);
    setDate(entry.date);
    setQuick({ kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs, fat: entry.fat });
  }, [entry]);

  if (!entry) return null;
  const ratio = entry.grams && grams ? grams / entry.grams : 1;
  const preview =
    entry.grams != null
      ? {
          kcal: Math.round(entry.kcal * ratio),
          protein: round1(entry.protein * ratio),
          carbs: round1(entry.carbs * ratio),
          fat: round1(entry.fat * ratio),
        }
      : quick;

  const save = () => {
    setN((n) => ({
      ...n,
      log: n.log.map((e) =>
        e.id === entry.id ? { ...e, meal, date: date || e.date, ...(date > dayKey() ? { planned: true } : {}), ...(entry.grams != null ? { grams: grams ?? e.grams } : {}), ...preview } : e,
      ),
    }));
    onClose();
  };
  const remove = () => {
    setN((n) => ({ ...n, log: n.log.filter((e) => e.id !== entry.id) }));
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={entry.name}>
      <div className="form">
        {entry.grams != null ? (
          <label className="field">
            <span>{t('Amount (g)')}</span>
            <NumInput id="edit-grams" label={t('Amount in grams')} value={grams} onChange={setGrams} />
          </label>
        ) : (
          <div className="quick-grid">
            {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <label key={k} className="field">
                <span>{k === 'kcal' ? t('kcal') : t('{0} (g)', { 0: t(MACRO_LABEL[k]) })}</span>
                <NumInput
                  id={'edit-' + k}
                  label={k}
                  value={quick[k]}
                  onChange={(v) => setQuick((q) => ({ ...q, [k]: v ?? 0 }))}
                />
              </label>
            ))}
          </div>
        )}
        <label className="field">
          <span>{t('Meal')}</span>
          <select id="edit-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t(MEAL_LABEL[m])}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Day')}</span>
          <input id="edit-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <p className="macro-line">
          <strong>{t('{0} kcal', { 0: preview.kcal })}</strong> · P {preview.protein} g · C {preview.carbs} g · F {preview.fat} g
        </p>
        <div className="sheet-actions">
          <button className="btn btn-ghost-danger" onClick={remove}>{t('Delete')}</button>
          <button className="btn btn-primary" onClick={save} disabled={entry.grams != null && !grams}>{t('Save')}</button>
        </div>
      </div>
    </Sheet>
  );
}
