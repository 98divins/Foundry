import { useMemo, useState } from 'react';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../exercises';
import { useStore } from '../store';
import type { Equipment, Exercise, ExerciseKind, Muscle } from '../types';
import { uid } from '../utils';
import { Icon, Sheet } from './ui';

export function useFilteredExercises(query: string, muscle: Muscle | 'all') {
  const { exercises } = useStore();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => (muscle === 'all' || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, muscle]);
}

export function MuscleChips({ value, onChange }: { value: Muscle | 'all'; onChange: (m: Muscle | 'all') => void }) {
  const items: (Muscle | 'all')[] = ['all', ...(Object.keys(MUSCLE_LABEL) as Muscle[])];
  return (
    <div className="chips" role="group" aria-label="Filter by muscle">
      {items.map((m) => (
        <button key={m} className={'chip' + (value === m ? ' on' : '')} onClick={() => onChange(m)}>
          {m === 'all' ? 'All' : MUSCLE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const list = useFilteredExercises(query, muscle);

  const close = () => {
    setPicked([]);
    setQuery('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="Add exercises" tall>
      <div className="picker-tools">
        <label className="search">
          <Icon name="search" size={18} />
          <input
            id="picker-search"
            placeholder="Search exercises"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <MuscleChips value={muscle} onChange={setMuscle} />
      </div>
      <ul className="picker-list">
        {list.map((e) => {
          const on = picked.includes(e.id);
          return (
            <li key={e.id}>
              <button
                className={'picker-row' + (on ? ' on' : '')}
                aria-pressed={on}
                onClick={() => setPicked(on ? picked.filter((p) => p !== e.id) : [...picked, e.id])}
              >
                <span className="ex-initial" aria-hidden="true">
                  {on ? <Icon name="check" size={18} /> : e.name[0]}
                </span>
                <span className="picker-text">
                  <span className="picker-name">{e.name}</span>
                  <span className="muted small">
                    {MUSCLE_LABEL[e.muscle]} · {EQUIPMENT_LABEL[e.equipment]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="muted empty-line">No exercise matches “{query}”.</li>}
      </ul>
      <div className="sheet-actions sticky-actions">
        <button className="btn" onClick={() => setCreating(true)}>
          New exercise
        </button>
        <button
          className="btn btn-primary"
          disabled={!picked.length}
          onClick={() => {
            onPick(picked);
            close();
          }}
        >
          {picked.length ? `Add ${picked.length}` : 'Add'}
        </button>
      </div>
      <CreateExercise
        open={creating}
        initialName={query}
        onClose={() => setCreating(false)}
        onCreated={(e) => setPicked((p) => [...p, e.id])}
      />
    </Sheet>
  );
}

export function CreateExercise({
  open,
  onClose,
  onCreated,
  initialName = '',
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (e: Exercise) => void;
  initialName?: string;
}) {
  const { update, exercises } = useStore();
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [kind, setKind] = useState<ExerciseKind>('weight');
  const clash = exercises.some((e) => e.name.toLowerCase() === name.trim().toLowerCase());

  return (
    <Sheet open={open} onClose={onClose} title="New exercise">
      <form
        className="form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!name.trim() || clash) return;
          const e: Exercise = { id: 'c_' + uid(), name: name.trim(), muscle, equipment, kind, custom: true };
          update((s) => ({ ...s, customExercises: [...s.customExercises, e] }));
          onCreated?.(e);
          setName('');
          onClose();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input id="new-ex-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pendlay Row" autoFocus />
          {clash && <span className="field-error">An exercise with this name already exists.</span>}
        </label>
        <label className="field">
          <span>Primary muscle</span>
          <select id="new-ex-muscle" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
            {(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Equipment</span>
          <select id="new-ex-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((m) => (
              <option key={m} value={m}>
                {EQUIPMENT_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tracking</span>
          <select id="new-ex-kind" value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
            <option value="weight">Weight × reps</option>
            <option value="bodyweight">Bodyweight reps (optional added weight)</option>
          </select>
        </label>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || clash}>
            Create
          </button>
        </div>
      </form>
    </Sheet>
  );
}
