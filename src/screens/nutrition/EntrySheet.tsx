import { useEffect, useState } from 'react';
import { NumInput, Sheet } from '../../components/ui';
import { MEAL_LABEL, MEALS, round1, type FoodEntry, type Meal } from '../../nutrition';
import { useNutrition } from '../../store';

/** Edit or delete a logged food: change the amount (macros scale with it) or the meal. */
export function EntrySheet({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  const { setN } = useNutrition();
  const [grams, setGrams] = useState<number | null>(null);
  const [meal, setMeal] = useState<Meal>('breakfast');
  const [quick, setQuick] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

  useEffect(() => {
    if (!entry) return;
    setGrams(entry.grams);
    setMeal(entry.meal);
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
        e.id === entry.id ? { ...e, meal, ...(entry.grams != null ? { grams: grams ?? e.grams } : {}), ...preview } : e,
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
            <span>Amount (g)</span>
            <NumInput id="edit-grams" label="Amount in grams" value={grams} onChange={setGrams} />
          </label>
        ) : (
          <div className="quick-grid">
            {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <label key={k} className="field">
                <span>{k === 'kcal' ? 'kcal' : `${k} (g)`}</span>
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
          <span>Meal</span>
          <select id="edit-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <p className="macro-line">
          <strong>{preview.kcal} kcal</strong> · P {preview.protein} g · C {preview.carbs} g · F {preview.fat} g
        </p>
        <div className="sheet-actions">
          <button className="btn btn-ghost-danger" onClick={remove}>
            Delete
          </button>
          <button className="btn btn-primary" onClick={save} disabled={entry.grams != null && !grams}>
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
