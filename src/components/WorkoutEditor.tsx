import { useEffect, useState } from 'react';
import { go } from '../hooks';
import { exerciseName, useStore } from '../store';
import type { ExerciseKind, SetEntry, SetType, WorkoutExercise } from '../types';
import { displayToKm, distUnit, fmtClock, fmtNum, fmtSet, fromDisplay, kmToDisplay, previousSets, toDisplay, uid } from '../utils';
import { ExerciseImage } from './ExerciseImage';
import { ExercisePicker } from './ExercisePicker';
import { fmtRepRange, linkWithNext, parseRepRange, supersetSlots, unlink, type SupersetSlot } from '../routines';
import { Icon, NumInput, Sheet, TimeInput } from './ui';
import { t } from '../i18n';

export type EditorMode = 'live' | 'edit' | 'routine';

const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function newBlock(exerciseId: string, restSec: number): WorkoutExercise {
  return {
    id: uid(),
    exerciseId,
    restSec,
    sets: [{ id: uid(), type: 'normal', weight: null, reps: null, done: false }],
  };
}

export function WorkoutEditor({
  exercises,
  onChange,
  mode,
  before,
  onSetCompleted,
}: {
  exercises: WorkoutExercise[];
  onChange: (next: WorkoutExercise[]) => void;
  mode: EditorMode;
  /** Only workouts that started before this time count as "previous". */
  before: number;
  onSetCompleted?: (we: WorkoutExercise) => void;
}) {
  const { state } = useStore();
  const [picking, setPicking] = useState(false);
  const slots = supersetSlots(exercises);

  const replace = (i: number, we: WorkoutExercise | null) => {
    const next = [...exercises];
    if (we) next[i] = we;
    else next.splice(i, 1);
    onChange(next);
  };
  /** Swaps in another exercise. Sets already done stay on the old one, so the history stays true. */
  const replaceExercise = (i: number, exerciseId: string) => {
    const we = exercises[i];
    const done = we.sets.filter((s) => s.done);
    const todo = we.sets.filter((s) => !s.done);
    const fresh: WorkoutExercise = {
      id: uid(),
      exerciseId,
      restSec: we.restSec,
      ...(we.supersetId ? { supersetId: we.supersetId } : {}),
      sets: (todo.length ? todo : [{ ...we.sets[we.sets.length - 1], done: false }]).map((s) => ({
        ...s,
        id: uid(),
        weight: null,
        duration: null,
        distance: null,
        done: false,
      })),
    };
    const next = [...exercises];
    if (done.length) next.splice(i, 1, { ...we, sets: done }, fresh);
    else next.splice(i, 1, fresh);
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= exercises.length) return;
    const next = [...exercises];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="editor">
      {exercises.map((we, i) => (
        <div key={we.id} className={supersetClass(slots[i])}>
          {slots[i].first && <span className={'ss-label ss-c' + ((slots[i].group ?? 0) % 4)}>{t('Superset')}</span>}
          <ExerciseCard
            we={we}
            mode={mode}
            prev={mode === 'routine' ? [] : previousSets(state.workouts, we.exerciseId, before)}
            canUp={i > 0}
            canDown={i < exercises.length - 1}
            inSuperset={slots[i].group != null}
            canLink={i < exercises.length - 1}
            onLink={() => onChange(linkWithNext(exercises, i))}
            onReplace={(id) => replaceExercise(i, id)}
            onUnlink={() => onChange(unlink(exercises, i))}
            onMove={(d) => move(i, d)}
            onChange={(n) => replace(i, n)}
            onSetCompleted={() => onSetCompleted?.(we)}
          />
        </div>
      ))}
      {!exercises.length && (
        <div className="empty-card">
          <Icon name="dumbbell" size={28} />
          <p>{mode === 'routine' ? t('Add the exercises this routine is made of.') : t('Add your first exercise to start logging sets.')}</p>
        </div>
      )}
      <button className="btn btn-primary btn-wide" onClick={() => setPicking(true)}>
        <Icon name="plus" size={18} />{' '}{t('Add exercise')}</button>
      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ids) => onChange([...exercises, ...ids.map((id) => newBlock(id, state.settings.defaultRest))])}
      />
    </div>
  );
}

/** Enough rows to show a routine note in full on a phone (about 40 characters a line), up to 6. */
const noteRows = (note?: string) =>
  Math.min(6, Math.max(1, (note ?? '').split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 40)), 0)));

export function supersetClass(slot: SupersetSlot): string {
  if (slot.group == null) return 'ss-none';
  return `ss ss-c${slot.group % 4}` + (slot.first ? ' ss-first' : '') + (slot.last ? ' ss-last' : '');
}

function setLabel(sets: SetEntry[], i: number): string {
  const type = sets[i].type;
  // Short set-type marks: W(arm-up), D(rop), F(ailure) — translated (É, D, É in French).
  if (type === 'warmup') return t('W');
  if (type === 'drop') return t('D');
  const n = sets.slice(0, i + 1).filter((s) => s.type === 'normal' || s.type === 'failure').length;
  return type === 'failure' ? `${n}${t('F')}` : String(n);
}

function ExerciseCard({
  we,
  mode,
  prev,
  canUp,
  canDown,
  inSuperset,
  canLink,
  onLink,
  onUnlink,
  onReplace,
  onMove,
  onChange,
  onSetCompleted,
}: {
  we: WorkoutExercise;
  mode: EditorMode;
  prev: SetEntry[];
  canUp: boolean;
  canDown: boolean;
  inSuperset: boolean;
  canLink: boolean;
  onLink: () => void;
  onUnlink: () => void;
  onReplace: (exerciseId: string) => void;
  onMove: (d: -1 | 1) => void;
  onChange: (we: WorkoutExercise | null) => void;
  onSetCompleted: () => void;
}) {
  const { state, exMap } = useStore();
  const unit = state.settings.unit;
  const ex = exMap.get(we.exerciseId);
  const kind: ExerciseKind = ex?.kind ?? 'weight';
  const [menu, setMenu] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!we.note);
  const [flash, setFlash] = useState<string | null>(null);
  const showCheck = mode === 'live';
  const timed = kind === 'duration' || kind === 'cardio';

  const setSet = (i: number, patch: Partial<SetEntry>) => {
    const sets = we.sets.map((s, j) => (j === i ? { ...s, ...patch } : s));
    onChange({ ...we, sets });
  };

  const toggleDone = (i: number) => {
    const s = we.sets[i];
    if (s.done) return setSet(i, { done: false });
    // Empty fields take the values shown as placeholders (last session).
    const p = prev[i];
    const filled = {
      weight: s.weight ?? p?.weight ?? null,
      reps: s.reps ?? p?.reps ?? s.target?.reps ?? null,
      duration: s.duration ?? p?.duration ?? null,
      distance: s.distance ?? p?.distance ?? null,
    };
    const ok =
      kind === 'weight'
        ? !!filled.reps && filled.weight != null
        : kind === 'duration'
          ? !!filled.duration
          : kind === 'cardio'
            ? !!filled.duration || !!filled.distance
            : !!filled.reps;
    if (!ok) {
      setFlash(s.id);
      setTimeout(() => setFlash(null), 600);
      return;
    }
    setSet(i, { done: true, ...filled });
    onSetCompleted();
  };

  const addSet = () => {
    const last = we.sets[we.sets.length - 1];
    onChange({
      ...we,
      sets: [
        ...we.sets,
        {
          id: uid(),
          type: 'normal',
          weight: last?.weight ?? null,
          reps: last?.reps ?? null,
          duration: last?.duration ?? null,
          distance: last?.distance ?? null,
          repsMax: last?.repsMax ?? null,
          target: last?.target ?? null,
          done: false,
        },
      ],
    });
  };

  const prevText = (p: SetEntry | undefined) => {
    if (!p) return '–';
    if (timed) return fmtSet(p, kind, unit);
    const w = p.weight ? fmtNum(toDisplay(p.weight, unit)) : null;
    const sign = kind === 'assisted' ? '−' : kind === 'bodyweight' ? '+' : '';
    return `${w ? `${sign}${w} × ` : ''}${p.reps ?? '–'}`;
  };

  const weightHeader = kind === 'bodyweight' ? `+${unit}` : kind === 'assisted' ? `−${unit}` : unit;

  return (
    <section className="ex-card" aria-label={ex?.label ?? ex?.name}>
      <div className="ex-head">
        <button className="ex-title" onClick={() => ex && go('e/' + ex.id)}>
          <ExerciseImage ex={ex} label={exerciseName(exMap, we.exerciseId)} />
          <span>{exerciseName(exMap, we.exerciseId)}</span>
        </button>
        <button className="icon-btn" aria-label={t('Exercise options')} onClick={() => setMenu(true)}>
          <Icon name="dots" />
        </button>
      </div>
      {noteOpen && (
        <textarea
          id={'note-' + we.id}
          className="ex-note"
          placeholder={t('Notes: seat height, grip, how it felt…')}
          rows={noteRows(we.note)}
          value={we.note ?? ''}
          onChange={(e) => onChange({ ...we, note: e.target.value })}
        />
      )}
      {mode !== 'edit' && (
        <button className="rest-chip" onClick={() => setMenu(true)}>
          <Icon name="timer" size={15} />{' '}{t('Rest')}{' '}{we.restSec ? fmtClock(we.restSec) : t('off')}
        </button>
      )}

      <div className={'set-grid' + (showCheck ? ' with-check' : '') + (mode === 'routine' ? ' no-prev' : '')}>
        <div className="set-hd">{t('Set')}</div>
        {mode !== 'routine' && <div className="set-hd">{t('Previous')}</div>}
        {kind === 'duration' ? (
          <div className="set-hd span-2">{t('Time')}</div>
        ) : kind === 'cardio' ? (
          <>
            <div className="set-hd">{distUnit()}</div>
            <div className="set-hd">{t('Time')}</div>
          </>
        ) : (
          <>
            <div className="set-hd">{weightHeader}</div>
            <div className="set-hd">{t('Reps')}</div>
          </>
        )}
        {showCheck && (
          <div className="set-hd" aria-label={t('Done')}>
            <Icon name="check" size={16} />
          </div>
        )}

        {we.sets.map((s, i) => {
          const p = prev[i];
          const rowCls = 'set-row' + (s.done ? ' done' : '') + (flash === s.id ? ' flash' : '');
          return (
            <div className={rowCls} key={s.id} role="group" aria-label={t('Set {n}', { n: i + 1 })}>
              <label className={'set-type t-' + s.type}>
                <span aria-hidden="true">{setLabel(we.sets, i)}</span>
                <span className="set-type-cue" aria-hidden="true">
                  <Icon name="edit" size={9} />
                </span>
                <select
                  id={'type-' + s.id}
                  aria-label={t('Set type, or remove this set')}
                  value={s.type}
                  onChange={(e) => {
                    if (e.target.value === 'remove') onChange({ ...we, sets: we.sets.filter((x) => x.id !== s.id) });
                    else setSet(i, { type: e.target.value as SetType });
                  }}
                >
                  <option value="normal">{t('Normal set')}</option>
                  <option value="warmup">{t('Warm-up')}</option>
                  <option value="drop">{t('Drop set')}</option>
                  <option value="failure">{t('Failure')}</option>
                  <option value="remove">{t('Remove set')}</option>
                </select>
              </label>
              {mode !== 'routine' && (
                <button
                  className="set-prev"
                  disabled={!p}
                  onClick={() =>
                    p && setSet(i, { weight: p.weight, reps: p.reps, duration: p.duration ?? null, distance: p.distance ?? null })
                  }
                  aria-label={p ? t('Use previous: {value}', { value: prevText(p) }) : t('No previous set')}
                >
                  {prevText(p)}
                </button>
              )}
              {kind === 'duration' ? (
                <TimeInput
                  id={'t-' + s.id}
                  className="span-2"
                  plainUnit="sec"
                  value={s.duration ?? null}
                  placeholder={p?.duration ? fmtClock(p.duration) : t('sec')}
                  onChange={(v) => setSet(i, { duration: v })}
                />
              ) : kind === 'cardio' ? (
                <>
                  <NumInput
                    id={'d-' + s.id}
                    label={t('Distance in {unit}', { unit: distUnit() })}
                    value={s.distance != null ? kmToDisplay(s.distance) : null}
                    placeholder={p?.distance ? fmtNum(kmToDisplay(p.distance)) : '–'}
                    onChange={(v) => setSet(i, { distance: v == null ? null : displayToKm(v) })}
                  />
                  <TimeInput
                    id={'t-' + s.id}
                    plainUnit="min"
                    value={s.duration ?? null}
                    placeholder={p?.duration ? fmtClock(p.duration) : t('min')}
                    onChange={(v) => setSet(i, { duration: v })}
                  />
                </>
              ) : (
                <>
                  <NumInput
                    id={'w-' + s.id}
                    label={kind === 'assisted' ? t('Assistance weight') : kind === 'bodyweight' ? t('Added weight') : t('Weight')}
                    value={s.weight == null ? null : toDisplay(s.weight, unit)}
                    placeholder={p?.weight ? fmtNum(toDisplay(p.weight, unit)) : kind === 'weight' ? '–' : '0'}
                    onChange={(v) => setSet(i, { weight: v == null ? null : fromDisplay(v, unit) })}
                  />
                  {mode === 'routine' ? (
                    <RepRangeInput
                      id={'r-' + s.id}
                      reps={s.reps}
                      repsMax={s.repsMax ?? null}
                      onChange={(reps, repsMax) => setSet(i, { reps, repsMax })}
                    />
                  ) : (
                    <NumInput
                      id={'r-' + s.id}
                      label={t('Reps')}
                      decimal={false}
                      value={s.reps}
                      placeholder={
                        s.target ? fmtRepRange(s.target.reps, s.target.repsMax) || '–' : p?.reps ? String(p.reps) : '–'
                      }
                      onChange={(v) => setSet(i, { reps: v })}
                    />
                  )}
                </>
              )}
              {showCheck && (
                <button
                  className={'check' + (s.done ? ' on' : '')}
                  aria-pressed={s.done}
                  aria-label={s.done ? t('Mark set not done') : t('Complete set')}
                  onClick={() => toggleDone(i)}
                >
                  <Icon name="check" size={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn btn-ghost btn-wide" onClick={addSet}>
        <Icon name="plus" size={16} />{' '}{t('Add set')}</button>

      <Sheet open={menu} onClose={() => setMenu(false)} title={ex?.label ?? ex?.name}>
        <div className="menu">
          {mode !== 'edit' && (
            <label className="field">
              <span>{t('Rest timer')}</span>
              <select
                id={'rest-' + we.id}
                value={we.restSec}
                onChange={(e) => onChange({ ...we, restSec: Number(e.target.value) })}
              >
                {REST_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r ? fmtClock(r) : t('Off')}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="menu-item" onClick={() => { setNoteOpen(true); setMenu(false); }}>
            <Icon name="note" size={18} /> {we.note ? t('Edit note') : t('Add note')}
          </button>
          {inSuperset ? (
            <button className="menu-item" onClick={() => { onUnlink(); setMenu(false); }}>
              <Icon name="unlink" size={18} />{' '}{t('Remove from superset')}</button>
          ) : (
            <button className="menu-item" disabled={!canLink} onClick={() => { onLink(); setMenu(false); }}>
              <Icon name="link" size={18} />{' '}{t('Superset with next exercise')}</button>
          )}
          <button className="menu-item" disabled={!canUp} onClick={() => { onMove(-1); setMenu(false); }}>
            <Icon name="up" size={18} />{' '}{t('Move up')}</button>
          <button className="menu-item" disabled={!canDown} onClick={() => { onMove(1); setMenu(false); }}>
            <Icon name="down" size={18} />{' '}{t('Move down')}</button>
          <button className="menu-item" onClick={() => { setMenu(false); setReplacing(true); }}>
            <Icon name="swap" size={18} />{' '}{mode === 'live' ? t('Replace for this workout') : t('Replace exercise')}
          </button>
          <button className="menu-item danger" onClick={() => { setMenu(false); onChange(null); }}>
            <Icon name="trash" size={18} />{' '}{t('Remove exercise')}</button>
        </div>
      </Sheet>
      {replacing && ex && (
        <ExercisePicker open replacing={ex} onClose={() => setReplacing(false)} onPick={([id]) => id && onReplace(id)} />
      )}
    </section>
  );
}

/** Target reps in a routine: a number ("10") or a range ("8-12"). */
function RepRangeInput({
  id,
  reps,
  repsMax,
  onChange,
}: {
  id: string;
  reps: number | null;
  repsMax: number | null;
  onChange: (reps: number | null, repsMax: number | null) => void;
}) {
  const [text, setText] = useState(fmtRepRange(reps, repsMax));
  useEffect(() => {
    const parsed = parseRepRange(text);
    if (!parsed || parsed.reps !== reps || parsed.repsMax !== repsMax) setText(fmtRepRange(reps, repsMax));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps, repsMax]);
  return (
    <input
      id={id}
      className="num"
      aria-label={t('Target reps, a number or a range like 8-12')}
      placeholder="8-12"
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseRepRange(e.target.value);
        if (v) onChange(v.reps, v.repsMax);
      }}
    />
  );
}
