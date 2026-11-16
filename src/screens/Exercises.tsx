import { useMemo, useState } from 'react';
import { CreateExercise, ExerciseFilters, ExerciseRowText, emptyFilter, useFilteredExercises, type ExerciseFilter } from '../components/ExercisePicker';
import { ExerciseImage } from '../components/ExerciseImage';
import { Header, Icon } from '../components/ui';
import { back, go } from '../hooks';
import { useStore } from '../store';
import { t } from '../i18n';
import { canAdd } from '../pro';

export function Exercises() {
  const { state } = useStore();
  const [filter, setFilter] = useState<ExerciseFilter>(emptyFilter);
  const [creating, setCreating] = useState(false);
  const [onlyLogged, setOnlyLogged] = useState(false);
  const list = useFilteredExercises(filter);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of state.workouts) {
      if (!w.endedAt) continue;
      for (const id of new Set(w.exercises.map((we) => we.exerciseId))) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [state.workouts]);

  const shown = onlyLogged ? list.filter((e) => counts.has(e.id)) : list;

  return (
    <>
      <Header
        title={t('Exercises')}
        onBack={() => back('')}
        right={
          <button className="btn btn-small" onClick={() => canAdd('customExercises', state.customExercises.length) && setCreating(true)}>
            <Icon name="plus" size={16} />{' '}{t('New')}</button>
        }
      />
      <main className="page">
        <ExerciseFilters value={filter} onChange={setFilter} idPrefix="ex" />
        <div className="list-meta">
          <label className="toggle-line">
            <input id="only-logged" type="checkbox" checked={onlyLogged} onChange={(e) => setOnlyLogged(e.target.checked)} />{t('Only exercises I have logged')}</label>
          <span className="muted small">{shown.length}</span>
        </div>
        <ul className="ex-list">
          {shown.map((e) => (
            <li key={e.id}>
              <button className="ex-row" onClick={() => go('e/' + e.id)}>
                <ExerciseImage ex={e} label={e.label ?? e.name} />
                <ExerciseRowText e={e} />
                <span className="muted small ex-count">{counts.get(e.id) ? `${counts.get(e.id)}×` : ''}</span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="muted empty-line">{t('No exercise matches these filters.')}</li>}
        </ul>
      </main>
      <CreateExercise open={creating} initialName={filter.query} onClose={() => setCreating(false)} />
    </>
  );
}
