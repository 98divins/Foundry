import { useMemo } from 'react';
import { Icon } from '../../components/ui';
import { t, tp } from '../../i18n';
import { copyEntries, previousMeal } from '../../mealCopy';
import { addDays, dayKey, MEAL_LABEL, type Meal } from '../../nutrition';
import { useNutrition } from '../../store';
import { uid } from '../../utils';
import { fmtDay } from './NutritionHome';

/** "Same as yesterday": copies this meal from the last day that has it, in one tap (plan 4.4). */
export function CopyMealButton({ date, meal, onCopied }: { date: string; meal: Meal; onCopied?: (names: string[]) => void }) {
  const { n, setN } = useNutrition();
  const prev = useMemo(() => previousMeal(n.log, date, meal), [n.log, date, meal]);
  if (!prev) return null;
  const kcal = Math.round(prev.entries.reduce((s, e) => s + e.kcal, 0));
  const when = prev.date === addDays(date, -1) ? t('Same as yesterday') : t('Same as {day}', { day: fmtDay(prev.date).toLowerCase() });
  const copy = () => {
    setN((x) => ({ ...x, log: [...x.log, ...copyEntries(prev.entries, date, meal, uid, Date.now(), dayKey())] }));
    onCopied?.(prev.entries.map((e) => e.name));
  };
  return (
    <button className="copy-meal" onClick={copy} aria-label={t('Copy {meal} from {day}', { meal: t(MEAL_LABEL[meal]).toLowerCase(), day: fmtDay(prev.date) })}>
      <Icon name="copy" size={16} />
      <span>
        <strong>{when}</strong>
        <span className="muted small"> · {tp(prev.entries.length, '{n} food', '{n} foods')} · {kcal} kcal</span>
      </span>
    </button>
  );
}
