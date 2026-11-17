import { useState } from 'react';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Confirm, Header } from '../components/ui';
import { RoutineSummaryPanel } from './RoutineView';
import { back, go } from '../hooks';
import { useStore } from '../store';
import type { Routine } from '../types';
import { uid } from '../utils';
import { t } from '../i18n';

export function RoutineEditor({ id, folderId }: { id: string; folderId?: string }) {
  const { state, update } = useStore();
  const existing = state.routines.find((r) => r.id === id);
  const [draft, setDraft] = useState<Routine>(
    () =>
      existing ?? {
        id: uid(),
        name: '',
        exercises: [],
        updatedAt: Date.now(),
        folderId: state.folders.some((f) => f.id === folderId) ? folderId : undefined,
      },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (id !== 'new' && !existing) {
    return (
      <>
        <Header title={t('Workout')} onBack={() => back()} />
        <main className="page">
          <p className="muted">{t('This workout no longer exists.')}</p>
        </main>
      </>
    );
  }

  const save = () => {
    const r = { ...draft, name: draft.name.trim() || t('Untitled workout'), updatedAt: Date.now() };
    update((s) => ({
      ...s,
      routines: existing ? s.routines.map((x) => (x.id === r.id ? r : x)) : [...s.routines, r],
    }));
    back();
  };

  return (
    <>
      <Header
        title={existing ? t('Edit workout') : t('New workout')}
        onBack={() => back()}
        right={
          <button className="btn btn-primary btn-small" onClick={save}>{t('Save')}</button>
        }
      />
      <main className="page">
        <label className="field">
          <span>{t('Workout name')}</span>
          <input
            id="routine-name"
            value={draft.name}
            placeholder={t('e.g. Upper A')}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        {state.folders.length > 0 && (
          <label className="field">
            <span>{t('Folder')}</span>
            <select
              id="routine-folder"
              value={draft.folderId && state.folders.some((f) => f.id === draft.folderId) ? draft.folderId : ''}
              onChange={(e) => setDraft({ ...draft, folderId: e.target.value || undefined })}
            >
              <option value="">{t('My workouts (no folder)')}</option>
              {state.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="muted small">{t('Set target reps per set, as a number or a range such as 8-12, and a weight if you like. During the workout the target shows in the reps field and the Previous column shows what you did last time. Use an exercise’s ⋯ menu to pair it with the next one as a superset.')}</p>
        <WorkoutEditor
          exercises={draft.exercises}
          mode="routine"
          before={Date.now()}
          onChange={(exercises) => setDraft({ ...draft, exercises })}
        />
        {draft.exercises.length > 0 && <RoutineSummaryPanel routine={draft} />}
        {existing && (
          <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmDelete(true)}>{t('Delete workout')}</button>
        )}
      </main>
      <Confirm
        open={confirmDelete}
        title={t('Delete workout?')}
        message={t('“{name}” will be removed. Past workouts stay in your history.', { name: existing?.name ?? '' })}
        confirmLabel={t('Delete')}
        danger
        onConfirm={() => {
          update((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== id) }));
          go('', { replace: true });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
