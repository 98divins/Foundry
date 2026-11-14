import { useMemo, useState } from 'react';
import { CreateExercise, MuscleChips, useFilteredExercises } from '../components/ExercisePicker';
import { Header, Icon } from '../components/ui';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../exercises';
import { go } from '../hooks';
import { useStore } from '../store';
import type { Muscle } from '../types';

export function Exercises() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [onlyLogged, setOnlyLogged] = useState(false);
  const list = useFilteredExercises(query, muscle);

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
        title="Exercises"
        right={
          <button className="btn btn-small" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New
          </button>
        }
      />
      <main className="page">
        <label className="search">
          <Icon name="search" size={18} />
          <input id="ex-search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <MuscleChips value={muscle} onChange={setMuscle} />
        <label className="toggle-line">
          <input id="only-logged" type="checkbox" checked={onlyLogged} onChange={(e) => setOnlyLogged(e.target.checked)} />
          Only exercises I have logged
        </label>
        <ul className="ex-list">
          {shown.map((e) => (
            <li key={e.id}>
              <button className="ex-row" onClick={() => go('e/' + e.id)}>
                <span className="ex-initial" aria-hidden="true">
                  {e.name[0]}
                </span>
                <span className="picker-text">
                  <span className="picker-name">
                    {e.name}
                    {e.custom && <span className="tag">Custom</span>}
                  </span>
                  <span className="muted small">
                    {MUSCLE_LABEL[e.muscle]} · {EQUIPMENT_LABEL[e.equipment]}
                  </span>
                </span>
                <span className="muted small ex-count">
                  {counts.get(e.id) ? `${counts.get(e.id)}×` : ''}
                </span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="muted empty-line">No exercise matches these filters.</li>}
        </ul>
      </main>
      <CreateExercise open={creating} initialName={query} onClose={() => setCreating(false)} />
    </>
  );
}
