import { useState } from 'react';
import { go, useNow } from '../hooks';
import { exerciseName, useStore } from '../store';
import type { Routine, RoutineFolder, State, Workout } from '../types';
import { defaultWorkoutName, fmtClock, fmtDate, fmtDuration, fmtVolume, uid, weekStart, workoutVolume } from '../utils';
import { Confirm, Header, Icon, Logo, Sheet } from '../components/ui';
import { codeFromText, liveSetFromRoutine } from '../routines';
import { ShareResult, useShareLink } from '../components/Share';

export function startWorkout(update: (fn: (s: State) => State) => void, routine?: Routine) {
  update((s) => {
    if (s.active) return s;
    const now = Date.now();
    const w: Workout = {
      id: uid(),
      name: routine?.name ?? defaultWorkoutName(now),
      startedAt: now,
      endedAt: null,
      routineId: routine?.id,
      exercises: (routine?.exercises ?? []).map((we) => ({
        ...we,
        id: uid(),
        sets: we.sets.map(liveSetFromRoutine),
      })),
    };
    return { ...s, active: w, rest: null };
  });
  go('active');
}

/** The folder a routine shows in; one whose folder no longer exists counts as unfiled. */
const folderOf = (r: Routine, folders: RoutineFolder[]) =>
  r.folderId && folders.some((f) => f.id === r.folderId) ? r.folderId : undefined;

const inFolder = (r: Routine, folders: RoutineFolder[], folderId: string | undefined) =>
  folderOf(r, folders) === folderId;

export function WorkoutTab() {
  const { state, update } = useStore();
  const { active, routines, folders, workouts } = state;
  const now = useNow(1000, !!active);
  const thisWeek = workouts.filter((w) => w.endedAt && w.startedAt >= weekStart(Date.now()));
  const last = [...workouts].filter((w) => w.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0];

  const [folderForm, setFolderForm] = useState<{ id?: string; name: string } | null>(null);
  const [folderMenu, setFolderMenu] = useState<RoutineFolder | null>(null);
  const [folderDelete, setFolderDelete] = useState<RoutineFolder | null>(null);
  const [routineMenu, setRoutineMenu] = useState<Routine | null>(null);
  const [moving, setMoving] = useState<Routine | null>(null);
  const [routineDelete, setRoutineDelete] = useState<Routine | null>(null);
  const [importing, setImporting] = useState(false);
  const [pasted, setPasted] = useState('');
  const { shared, share, clear } = useShareLink();
  const pastedCode = codeFromText(pasted);

  const unfiled = routines.filter((r) => inFolder(r, folders, undefined));

  const saveFolder = () => {
    if (!folderForm) return;
    const name = folderForm.name.trim();
    if (!name) return;
    update((s) => ({
      ...s,
      folders: folderForm.id
        ? s.folders.map((f) => (f.id === folderForm.id ? { ...f, name } : f))
        : [...s.folders, { id: uid(), name }],
    }));
    setFolderForm(null);
  };

  const toggleFolder = (id: string) =>
    update((s) => ({ ...s, folders: s.folders.map((f) => (f.id === id ? { ...f, collapsed: !f.collapsed } : f)) }));

  const moveFolder = (id: string, dir: -1 | 1) =>
    update((s) => {
      const i = s.folders.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.folders.length) return s;
      const next = [...s.folders];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...s, folders: next };
    });

  const deleteFolder = (f: RoutineFolder, withRoutines: boolean) => {
    update((s) => ({
      ...s,
      folders: s.folders.filter((x) => x.id !== f.id),
      routines: withRoutines
        ? s.routines.filter((r) => r.folderId !== f.id)
        : s.routines.map((r) => (r.folderId === f.id ? { ...r, folderId: undefined } : r)),
    }));
    setFolderDelete(null);
  };

  /** Swap with the neighbouring routine in the same folder. */
  const moveRoutine = (r: Routine, dir: -1 | 1) =>
    update((s) => {
      const siblings = s.routines.filter((x) => inFolder(x, s.folders, folderOf(r, s.folders)));
      const k = siblings.findIndex((x) => x.id === r.id);
      const other = siblings[k + dir];
      if (!other) return s;
      const next = [...s.routines];
      const i = next.findIndex((x) => x.id === r.id);
      const j = next.findIndex((x) => x.id === other.id);
      [next[i], next[j]] = [next[j], next[i]];
      return { ...s, routines: next };
    });

  const duplicate = (r: Routine) =>
    update((s) => {
      const copy: Routine = {
        ...structuredClone(r),
        id: uid(),
        name: `${r.name} (copy)`,
        updatedAt: Date.now(),
      };
      copy.exercises = copy.exercises.map((we) => ({ ...we, id: uid(), sets: we.sets.map((st) => ({ ...st, id: uid() })) }));
      const i = s.routines.findIndex((x) => x.id === r.id);
      const next = [...s.routines];
      next.splice(i + 1, 0, copy);
      return { ...s, routines: next };
    });

  const renderRoutines = (list: Routine[]) => (
    <ul className="routine-list">
      {list.map((r) => (
        <RoutineRow
          key={r.id}
          r={r}
          disabled={!!active || !r.exercises.length}
          onStart={() => startWorkout(update, r)}
          onMenu={() => setRoutineMenu(r)}
        />
      ))}
    </ul>
  );

  return (
    <>
      <Header
        title={
          <span className="brand">
            <Logo /> Foundry
          </span>
        }
      />
      <main className="page">
        <section className="hero-card">
          {active ? (
            <>
              <span className="eyebrow">In progress</span>
              <h2 className="hero-title">{active.name}</h2>
              <p className="hero-clock">{fmtClock((now - active.startedAt) / 1000)}</p>
              <button className="btn btn-primary btn-wide" onClick={() => go('active')}>
                Resume workout
              </button>
            </>
          ) : (
            <>
              <span className="eyebrow">This week</span>
              <h2 className="hero-title">
                {thisWeek.length} {thisWeek.length === 1 ? 'workout' : 'workouts'}
                <span className="muted hero-sub">
                  {' '}
                  · {fmtVolume(thisWeek.reduce((t, w) => t + workoutVolume(w), 0), state.settings.unit)} lifted
                </span>
              </h2>
              {last && (
                <p className="muted small">
                  Last: {last.name}, {fmtDate(last.startedAt)} ({fmtDuration(last.endedAt! - last.startedAt)})
                </p>
              )}
              <button className="btn btn-primary btn-wide" onClick={() => startWorkout(update)}>
                <Icon name="plus" size={18} /> Start empty workout
              </button>
            </>
          )}
        </section>

        <div className="routine-entry">
          <button className="btn" onClick={() => go('r/new')}>
            <Icon name="plus" size={18} /> New routine
          </button>
          <button className="btn" onClick={() => go('explore')}>
            <Icon name="search" size={18} /> Explore programs
          </button>
        </div>

        <div className="section-head">
          <h2>My routines</h2>
          <div className="section-actions">
            <button className="btn btn-small" onClick={() => setImporting(true)} aria-label="Import routines from a link">
              <Icon name="link" size={16} />
            </button>
            <button className="btn btn-small" onClick={() => setFolderForm({ name: '' })}>
              <Icon name="folder" size={16} /> Folder
            </button>
          </div>
        </div>
        {active && routines.length > 0 && <p className="muted small">Finish the workout in progress to start a routine.</p>}
        <ShareResult shared={shared} onClose={clear} />

        {folders.map((f) => {
          const list = routines.filter((r) => inFolder(r, folders, f.id));
          return (
            <section key={f.id} className="folder">
              <div className="folder-head">
                <button
                  className="folder-toggle"
                  aria-expanded={!f.collapsed}
                  onClick={() => toggleFolder(f.id)}
                >
                  <span className={'folder-chevron' + (f.collapsed ? '' : ' open')}>
                    <Icon name="chevron" size={16} />
                  </span>
                  <span className="folder-name">{f.name}</span>
                  <span className="folder-count">{list.length}</span>
                </button>
                <button className="icon-btn" aria-label={`Options for folder ${f.name}`} onClick={() => setFolderMenu(f)}>
                  <Icon name="dots" />
                </button>
              </div>
              {!f.collapsed && (
                <>
                  {renderRoutines(list)}
                  <button className="add-in-folder" onClick={() => go('r/new/' + f.id)}>
                    <Icon name="plus" size={15} /> New routine in {f.name}
                  </button>
                </>
              )}
            </section>
          );
        })}

        {(unfiled.length > 0 || !folders.length) && (
          <section className="folder">
            {folders.length > 0 && <h3 className="folder-plain">Not in a folder</h3>}
            {!routines.length && (
              <div className="empty-card">
                <p>
                  Routines are your workout templates. Create one for each training day, or start from a ready-made
                  program in Explore programs.
                </p>
                <button className="btn btn-primary" onClick={() => go('explore')}>
                  Explore programs
                </button>
              </div>
            )}
            {renderRoutines(unfiled)}
          </section>
        )}
      </main>

      {/* Folder create / rename */}
      <Sheet open={!!folderForm} onClose={() => setFolderForm(null)} title={folderForm?.id ? 'Rename folder' : 'New folder'}>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            saveFolder();
          }}
        >
          <label className="field">
            <span>Folder name</span>
            <input
              id="folder-name"
              autoFocus
              placeholder="e.g. Upper/Lower x2"
              value={folderForm?.name ?? ''}
              onChange={(e) => setFolderForm((f) => (f ? { ...f, name: e.target.value } : f))}
            />
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setFolderForm(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!folderForm?.name.trim()}>
              {folderForm?.id ? 'Rename' : 'Create'}
            </button>
          </div>
        </form>
      </Sheet>

      {/* Folder options */}
      <Sheet open={!!folderMenu} onClose={() => setFolderMenu(null)} title={folderMenu?.name}>
        {folderMenu && (
          <div className="menu">
            <button className="menu-item" onClick={() => { go('r/new/' + folderMenu.id); setFolderMenu(null); }}>
              <Icon name="plus" size={18} /> New routine in this folder
            </button>
            <button
              className="menu-item"
              onClick={() => {
                share(folderMenu, routines.filter((r) => inFolder(r, folders, folderMenu.id)));
                setFolderMenu(null);
              }}
            >
              <Icon name="link" size={18} /> Copy share link
            </button>
            <button className="menu-item" onClick={() => { setFolderForm({ id: folderMenu.id, name: folderMenu.name }); setFolderMenu(null); }}>
              <Icon name="edit" size={18} /> Rename
            </button>
            <button className="menu-item" disabled={folders[0]?.id === folderMenu.id} onClick={() => { moveFolder(folderMenu.id, -1); setFolderMenu(null); }}>
              <Icon name="up" size={18} /> Move up
            </button>
            <button className="menu-item" disabled={folders[folders.length - 1]?.id === folderMenu.id} onClick={() => { moveFolder(folderMenu.id, 1); setFolderMenu(null); }}>
              <Icon name="down" size={18} /> Move down
            </button>
            <button className="menu-item danger" onClick={() => { setFolderDelete(folderMenu); setFolderMenu(null); }}>
              <Icon name="trash" size={18} /> Delete folder
            </button>
          </div>
        )}
      </Sheet>

      {/* Folder delete: keep or remove its routines */}
      <Sheet open={!!folderDelete} onClose={() => setFolderDelete(null)} title="Delete folder?">
        {folderDelete && (() => {
          const n = routines.filter((r) => r.folderId === folderDelete.id).length;
          return (
            <>
              <p className="muted sheet-text">
                {n
                  ? `“${folderDelete.name}” holds ${n} routine${n > 1 ? 's' : ''}. Keep them (they move out of the folder) or delete them with the folder. Past workouts stay in your history either way.`
                  : `“${folderDelete.name}” is empty.`}
              </p>
              <div className="menu">
                <button className="btn btn-wide" onClick={() => deleteFolder(folderDelete, false)}>
                  {n ? 'Delete folder, keep routines' : 'Delete folder'}
                </button>
                {n > 0 && (
                  <button className="btn btn-danger btn-wide" onClick={() => deleteFolder(folderDelete, true)}>
                    Delete folder and its {n} routine{n > 1 ? 's' : ''}
                  </button>
                )}
                <button className="btn btn-ghost btn-wide" onClick={() => setFolderDelete(null)}>
                  Cancel
                </button>
              </div>
            </>
          );
        })()}
      </Sheet>

      {/* Routine options */}
      <Sheet open={!!routineMenu} onClose={() => setRoutineMenu(null)} title={routineMenu?.name}>
        {routineMenu && (
          <div className="menu">
            <button className="menu-item" onClick={() => { go('r/' + routineMenu.id); setRoutineMenu(null); }}>
              <Icon name="edit" size={18} /> Edit routine
            </button>
            <button className="menu-item" onClick={() => { duplicate(routineMenu); setRoutineMenu(null); }}>
              <Icon name="copy" size={18} /> Duplicate
            </button>
            <button className="menu-item" onClick={() => { setMoving(routineMenu); setRoutineMenu(null); }}>
              <Icon name="folder" size={18} /> Move to folder
            </button>
            <button className="menu-item" onClick={() => { moveRoutine(routineMenu, -1); setRoutineMenu(null); }}>
              <Icon name="up" size={18} /> Move up
            </button>
            <button className="menu-item" onClick={() => { moveRoutine(routineMenu, 1); setRoutineMenu(null); }}>
              <Icon name="down" size={18} /> Move down
            </button>
            <button className="menu-item danger" onClick={() => { setRoutineDelete(routineMenu); setRoutineMenu(null); }}>
              <Icon name="trash" size={18} /> Delete routine
            </button>
          </div>
        )}
      </Sheet>

      {/* Move to folder */}
      <Sheet open={!!moving} onClose={() => setMoving(null)} title={`Move “${moving?.name ?? ''}”`}>
        {moving && (
          <div className="menu">
            {[{ id: undefined as string | undefined, name: 'No folder' }, ...folders].map((f) => {
              const current = folderOf(moving, folders) === f.id;
              return (
                <button
                  key={f.id ?? 'none'}
                  className={'menu-item' + (current ? ' current' : '')}
                  aria-current={current}
                  onClick={() => {
                    // Moved routines go to the end of their new folder.
                    update((s) => ({
                      ...s,
                      routines: [
                        ...s.routines.filter((r) => r.id !== moving.id),
                        { ...moving, folderId: f.id },
                      ],
                    }));
                    setMoving(null);
                  }}
                >
                  <Icon name={current ? 'check' : 'folder'} size={18} /> {f.name}
                </button>
              );
            })}
            <button className="menu-item" onClick={() => { setMoving(null); setFolderForm({ name: '' }); }}>
              <Icon name="plus" size={18} /> New folder…
            </button>
          </div>
        )}
      </Sheet>

      {/* Import from a pasted link */}
      <Sheet open={importing} onClose={() => setImporting(false)} title="Import routines">
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pastedCode) return;
            setImporting(false);
            setPasted('');
            go('import/' + pastedCode);
          }}
        >
          <label className="field">
            <span>Share link</span>
            <textarea
              id="import-link"
              rows={3}
              placeholder="Paste a Foundry routine link"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          </label>
          {pasted && !pastedCode && <p className="field-error">This is not a Foundry routine link.</p>}
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setImporting(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!pastedCode}>
              Continue
            </button>
          </div>
        </form>
      </Sheet>

      <Confirm
        open={!!routineDelete}
        title="Delete routine?"
        message={`“${routineDelete?.name}” will be removed. Past workouts stay in your history.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => update((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== routineDelete?.id) }))}
        onClose={() => setRoutineDelete(null)}
      />
    </>
  );
}

function RoutineRow({
  r,
  disabled,
  onStart,
  onMenu,
}: {
  r: Routine;
  disabled: boolean;
  onStart: () => void;
  onMenu: () => void;
}) {
  const { exMap } = useStore();
  return (
    <li className="routine">
      <button className="routine-body" onClick={() => go('rv/' + r.id)} aria-label={`Open ${r.name}`}>
        <span className="routine-name">{r.name}</span>
        <span className="muted small routine-ex">
          {r.exercises.map((we) => exerciseName(exMap, we.exerciseId)).join(', ') || 'No exercises yet'}
        </span>
      </button>
      <button className="icon-btn" aria-label={`Options for ${r.name}`} onClick={onMenu}>
        <Icon name="dots" />
      </button>
      <button className="btn btn-small btn-primary" disabled={disabled} onClick={onStart}>
        Start
      </button>
    </li>
  );
}
