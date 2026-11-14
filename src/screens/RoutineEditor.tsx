import { useState } from 'react';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Confirm, Header } from '../components/ui';
import { back, go } from '../hooks';
import { useStore } from '../store';
import type { Routine } from '../types';
import { uid } from '../utils';

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
        <Header title="Routine" onBack={() => back()} />
        <main className="page">
          <p className="muted">This routine no longer exists.</p>
        </main>
      </>
    );
  }

  const save = () => {
    const r = { ...draft, name: draft.name.trim() || 'Untitled routine', updatedAt: Date.now() };
    update((s) => ({
      ...s,
      routines: existing ? s.routines.map((x) => (x.id === r.id ? r : x)) : [...s.routines, r],
    }));
    back();
  };

  return (
    <>
      <Header
        title={existing ? 'Edit routine' : 'New routine'}
        onBack={() => back()}
        right={
          <button className="btn btn-primary btn-small" onClick={save}>
            Save
          </button>
        }
      />
      <main className="page">
        <label className="field">
          <span>Routine name</span>
          <input
            id="routine-name"
            value={draft.name}
            placeholder="e.g. Upper A"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        {state.folders.length > 0 && (
          <label className="field">
            <span>Folder</span>
            <select
              id="routine-folder"
              value={draft.folderId && state.folders.some((f) => f.id === draft.folderId) ? draft.folderId : ''}
              onChange={(e) => setDraft({ ...draft, folderId: e.target.value || undefined })}
            >
              <option value="">My routines (no folder)</option>
              {state.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="muted small">
          Set the target reps and, if you like, a weight for each set. When you start the routine, each set also shows
          what you lifted last time.
        </p>
        <WorkoutEditor
          exercises={draft.exercises}
          mode="routine"
          before={Date.now()}
          onChange={(exercises) => setDraft({ ...draft, exercises })}
        />
        {existing && (
          <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmDelete(true)}>
            Delete routine
          </button>
        )}
      </main>
      <Confirm
        open={confirmDelete}
        title="Delete routine?"
        message={`“${existing?.name}” will be removed. Past workouts stay in your history.`}
        confirmLabel="Delete"
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
