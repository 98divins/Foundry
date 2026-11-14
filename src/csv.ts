import type { Equipment, Exercise, SetType, Workout, WorkoutExercise } from './types';
import { uid } from './utils';
import { t } from './i18n';

/** RFC 4180-style parser: quoted fields, escaped quotes, CRLF or LF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Accepts "14 Nov 2026, 10:30" (Hevy export) or anything Date.parse understands. */
export function parseDate(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (m && MONTHS[m[2].toLowerCase()] != null) {
    return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5]).getTime();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function guessEquipment(title: string): Equipment {
  const t = title.toLowerCase();
  if (t.includes('barbell')) return 'barbell';
  if (t.includes('dumbbell')) return 'dumbbell';
  if (t.includes('machine') || t.includes('smith')) return 'machine';
  if (t.includes('cable')) return 'cable';
  if (t.includes('kettlebell')) return 'kettlebell';
  if (t.includes('band')) return 'band';
  return 'other';
}

const SET_TYPE: Record<string, SetType> = {
  warmup: 'warmup',
  dropset: 'drop',
  drop: 'drop',
  failure: 'failure',
};

export interface ImportResult {
  workouts: Workout[];
  newExercises: Exercise[];
  skippedDuplicates: number;
}

/**
 * Imports a workout CSV in the column layout used by Hevy's data export
 * (title, start_time, end_time, description, exercise_title, exercise_notes,
 * set_type, weight_kg, reps, ...). Foundry's own CSV export uses the same layout.
 */
export function importWorkoutCsv(text: string, known: Exercise[], existing: Workout[]): ImportResult {
  const rows = parseCSV(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error(t('The file has no workout rows.'));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const need = ['title', 'start_time', 'exercise_title'];
  const missing = need.filter((n) => col(n) < 0);
  if (missing.length) throw new Error(t('Missing column(s): {cols}. Is this a workout CSV export?', { cols: missing.join(', ') }));

  const get = (r: string[], name: string) => (col(name) >= 0 ? (r[col(name)] ?? '').trim() : '');
  const num = (v: string) => (v === '' || Number.isNaN(Number(v)) ? null : Number(v));

  // Match English names and, for exports made in French, French names too.
  const byName = new Map<string, Exercise>();
  for (const e of known) {
    byName.set(norm(e.name), e);
    if (e.nameFr && !byName.has(norm(e.nameFr))) byName.set(norm(e.nameFr), e);
  }
  const newExercises: Exercise[] = [];
  const workouts = new Map<string, Workout>();
  const order: string[] = [];

  for (const r of rows.slice(1)) {
    const title = get(r, 'title') || 'Workout';
    const startRaw = get(r, 'start_time');
    const startedAt = parseDate(startRaw);
    if (startedAt == null) continue;
    const key = `${title}|${startRaw}`;
    let w = workouts.get(key);
    if (!w) {
      const end = parseDate(get(r, 'end_time'));
      w = {
        id: uid(),
        name: title,
        startedAt,
        endedAt: end ?? startedAt + 60 * 60000,
        exercises: [],
        note: get(r, 'description') || undefined,
      };
      workouts.set(key, w);
      order.push(key);
    }

    const exTitle = get(r, 'exercise_title');
    if (!exTitle) continue;
    let exercise = byName.get(norm(exTitle));
    if (!exercise) {
      exercise = {
        id: 'c_' + uid(),
        name: exTitle,
        muscle: 'other',
        equipment: guessEquipment(exTitle),
        kind: 'weight',
        custom: true,
      };
      byName.set(norm(exTitle), exercise);
      newExercises.push(exercise);
    }

    // Consecutive rows of the same exercise belong to the same block.
    let we: WorkoutExercise | undefined = w.exercises[w.exercises.length - 1];
    if (!we || we.exerciseId !== exercise.id) {
      we = { id: uid(), exerciseId: exercise.id, sets: [], restSec: 90, note: get(r, 'exercise_notes') || undefined };
      w.exercises.push(we);
    }
    const weight = num(get(r, 'weight_kg'));
    const reps = num(get(r, 'reps'));
    const duration = num(get(r, 'duration_seconds'));
    const distance = num(get(r, 'distance_km'));
    if (reps == null && weight == null && !duration && !distance) continue;
    we.sets.push({
      id: uid(),
      type: SET_TYPE[get(r, 'set_type').toLowerCase()] ?? 'normal',
      weight,
      reps,
      duration: duration || null,
      distance: distance || null,
      done: true,
    });
  }

  // Guess how new exercises are tracked from what their sets hold.
  const all = [...workouts.values()];
  for (const e of newExercises) {
    const sets = all.flatMap((w) => w.exercises.filter((we) => we.exerciseId === e.id).flatMap((we) => we.sets));
    if (!sets.length) continue;
    if (sets.some((s) => s.distance)) {
      e.kind = 'cardio';
      e.muscle = 'cardio';
    } else if (sets.every((s) => !s.reps) && sets.some((s) => s.duration)) {
      e.kind = 'duration';
    } else if (sets.every((s) => !s.weight)) {
      e.kind = 'bodyweight';
      e.equipment = e.equipment === 'other' ? 'bodyweight' : e.equipment;
    }
  }

  const seen = new Set(existing.map((w) => `${w.name}|${w.startedAt}`));
  let skippedDuplicates = 0;
  const result: Workout[] = [];
  for (const k of order) {
    const w = workouts.get(k)!;
    w.exercises = w.exercises.filter((we) => we.sets.length);
    if (!w.exercises.length) continue;
    if (seen.has(`${w.name}|${w.startedAt}`)) {
      skippedDuplicates++;
      continue;
    }
    result.push(w);
  }
  const used = new Set(result.flatMap((w) => w.exercises.map((we) => we.exerciseId)));
  return { workouts: result, newExercises: newExercises.filter((e) => used.has(e.id)), skippedDuplicates };
}

const pad = (n: number) => String(n).padStart(2, '0');
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtCsvDate(ts: number) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const esc = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportWorkoutCsv(workouts: Workout[], exercises: Map<string, Exercise>): string {
  const lines = [
    'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
  ];
  const typeOut: Record<SetType, string> = { normal: 'normal', warmup: 'warmup', drop: 'dropset', failure: 'failure' };
  for (const w of [...workouts].filter((w) => w.endedAt).sort((a, b) => a.startedAt - b.startedAt)) {
    for (const we of w.exercises) {
      const name = exercises.get(we.exerciseId)?.name ?? 'Unknown exercise';
      we.sets
        .filter((s) => s.done)
        .forEach((s, i) => {
          lines.push(
            [
              w.name, fmtCsvDate(w.startedAt), fmtCsvDate(w.endedAt!), w.note ?? '', name, '', we.note ?? '',
              i, typeOut[s.type], s.weight == null ? '' : Math.round(s.weight * 1000) / 1000, s.reps ?? '',
              s.distance ?? '', s.duration ?? '', '',
            ].map(esc).join(','),
          );
        });
    }
  }
  return lines.join('\n') + '\n';
}
