import { useMemo, useState } from 'react';
import { EQUIPMENT, KIND_LABEL, MUSCLES, equipmentLabel, fold, muscleLabel } from '../exercises';
import { useStore } from '../store';
import type { Equipment, Exercise, ExerciseKind, Muscle } from '../types';
import { uid } from '../utils';
import { ExerciseImage } from './ExerciseImage';
import { Icon, Sheet } from './ui';

export interface ExerciseFilter {
  query: string;
  muscle: Muscle | 'all';
  equipment: Equipment | 'all';
}

export const emptyFilter: ExerciseFilter = { query: '', muscle: 'all', equipment: 'all' };

/** Matches French and English names, ignoring accents and word order. */
export function useFilteredExercises({ query, muscle, equipment }: ExerciseFilter) {
  const { exercises } = useStore();
  return useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return exercises
      .filter((e) => {
        if (muscle !== 'all' && e.muscle !== muscle && !(muscle === 'upper_back' && e.muscle === 'back')) return false;
        if (equipment !== 'all' && e.equipment !== equipment) return false;
        if (!words.length) return true;
        const hay = fold(`${e.name} ${e.nameFr ?? ''}`);
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name));
  }, [exercises, query, muscle, equipment]);
}

export function ExerciseFilters({
  value,
  onChange,
  idPrefix,
}: {
  value: ExerciseFilter;
  onChange: (f: ExerciseFilter) => void;
  idPrefix: string;
}) {
  const { state } = useStore();
  const lang = state.settings.exerciseLang;
  return (
    <div className="filters">
      <label className="search">
        <Icon name="search" size={18} />
        <input
          id={idPrefix + '-search'}
          placeholder={lang === 'fr' ? 'Rechercher (FR ou EN)' : 'Search (English or French)'}
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
        {value.query && (
          <button className="icon-btn search-clear" aria-label="Clear search" onClick={() => onChange({ ...value, query: '' })}>
            <Icon name="x" size={16} />
          </button>
        )}
      </label>
      <div className="filter-row">
        <select
          id={idPrefix + '-muscle'}
          aria-label="Muscle"
          value={value.muscle}
          onChange={(e) => onChange({ ...value, muscle: e.target.value as Muscle | 'all' })}
        >
          <option value="all">{lang === 'fr' ? 'Tous les muscles' : 'All muscles'}</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {muscleLabel(m, lang)}
            </option>
          ))}
        </select>
        <select
          id={idPrefix + '-equipment'}
          aria-label="Equipment"
          value={value.equipment}
          onChange={(e) => onChange({ ...value, equipment: e.target.value as Equipment | 'all' })}
        >
          <option value="all">{lang === 'fr' ? 'Tout l’équipement' : 'All equipment'}</option>
          {EQUIPMENT.map((m) => (
            <option key={m} value={m}>
              {equipmentLabel(m, lang)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ExerciseRowText({ e }: { e: Exercise }) {
  const { state } = useStore();
  const lang = state.settings.exerciseLang;
  return (
    <span className="picker-text">
      <span className="picker-name">
        {e.label ?? e.name}
        {e.custom && <span className="tag">Custom</span>}
      </span>
      <span className="muted small">
        {muscleLabel(e.muscle, lang)} · {equipmentLabel(e.equipment, lang)}
      </span>
    </span>
  );
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  replacing,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  /** Replace mode: one tap picks, and the list starts on the same muscle. */
  replacing?: Exercise;
}) {
  const startFilter = replacing ? { ...emptyFilter, muscle: replacing.muscle } : emptyFilter;
  const [filter, setFilter] = useState<ExerciseFilter>(startFilter);
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const list = useFilteredExercises(filter);

  const close = () => {
    setPicked([]);
    setFilter(startFilter);
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={replacing ? `Replace ${replacing.label ?? replacing.name}` : 'Add exercises'} tall>
      <div className="picker-tools">
        <ExerciseFilters value={filter} onChange={setFilter} idPrefix="picker" />
        <span className="muted small">{list.length} exercises</span>
      </div>
      <ul className="picker-list">
        {list.map((e) => {
          if (replacing && e.id === replacing.id) return null;
          const on = picked.includes(e.id);
          return (
            <li key={e.id}>
              <button
                className={'picker-row' + (on ? ' on' : '')}
                aria-pressed={on}
                onClick={() => {
                  if (replacing) {
                    onPick([e.id]);
                    close();
                  } else setPicked(on ? picked.filter((p) => p !== e.id) : [...picked, e.id]);
                }}
              >
                <span className="thumb-wrap">
                  <ExerciseImage ex={e} label={e.label ?? e.name} />
                  {on && (
                    <span className="thumb-check" aria-hidden="true">
                      <Icon name="check" size={18} />
                    </span>
                  )}
                </span>
                <ExerciseRowText e={e} />
              </button>
            </li>
          );
        })}
        {!list.length && <li className="muted empty-line">No exercise matches these filters.</li>}
      </ul>
      <div className="sheet-actions sticky-actions">
        <button className="btn" onClick={() => setCreating(true)}>
          New exercise
        </button>
        {!replacing && (
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
        )}
      </div>
      <CreateExercise
        open={creating}
        initialName={filter.query}
        onClose={() => setCreating(false)}
        onCreated={(e) => {
          if (replacing) {
            onPick([e.id]);
            close();
          } else setPicked((p) => [...p, e.id]);
        }}
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
  const { state, update, exercises } = useStore();
  const lang = state.settings.exerciseLang;
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [kind, setKind] = useState<ExerciseKind>('weight');
  const clash = exercises.some(
    (e) => fold(e.name) === fold(name.trim()) || (e.nameFr && fold(e.nameFr) === fold(name.trim())),
  );

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
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {muscleLabel(m, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Equipment</span>
          <select id="new-ex-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((m) => (
              <option key={m} value={m}>
                {equipmentLabel(m, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tracking</span>
          <select id="new-ex-kind" value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
            {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
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
