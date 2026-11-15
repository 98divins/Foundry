import { useEffect, useState } from 'react';
import { weekStreak } from '../analytics';
import { go } from '../hooks';
import { t, tp } from '../i18n';
import { useStore } from '../store';
import { Icon } from './ui';

const KEY = 'foundry:streak-toast';

/** Once a day, when the app opens, a small note in the corner about the week streak. */
export function StreakToast() {
  const { state } = useStore();
  const [shown, setShown] = useState(false);
  const { weeks, thisWeekDone } = weekStreak(state.workouts);

  useEffect(() => {
    const today = new Date().toDateString();
    let last: string | null = null;
    try {
      last = localStorage.getItem(KEY);
    } catch {
      /* private mode: show it anyway */
    }
    if (last === today || !state.workouts.length) return;
    try {
      localStorage.setItem(KEY, today);
    } catch {
      /* ignore */
    }
    setShown(true);
    const id = setTimeout(() => setShown(false), 5000);
    return () => clearTimeout(id);
    // Only on opening the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!shown) return null;
  const text = !weeks
    ? t('Start a streak: train once this week.')
    : thisWeekDone
      ? tp(weeks, 'Week {n} in a row. Keep going!', 'Week {n} in a row. Keep going!')
      : tp(weeks, 'Your {n}-week streak is waiting: train this week to keep it.', 'Your {n}-week streak is waiting: train this week to keep it.');
  return (
    <button
      className={'streak-toast' + (thisWeekDone ? ' lit' : '')}
      onClick={() => {
        setShown(false);
        go('stats/month');
      }}
    >
      <Icon name="flame" size={20} />
      <span>{text}</span>
    </button>
  );
}

/** Flame with the streak count, for headers. */
export function StreakChip() {
  const { state } = useStore();
  const { weeks, thisWeekDone } = weekStreak(state.workouts);
  if (!state.workouts.length) return null;
  return (
    <button
      className={'streak-chip' + (thisWeekDone ? ' lit' : '')}
      aria-label={tp(weeks, '{n} week streak', '{n} weeks streak')}
      onClick={() => go('stats/month')}
    >
      <Icon name="flame" size={18} />
      {weeks}
    </button>
  );
}
