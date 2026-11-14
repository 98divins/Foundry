import type { Exercise, Muscle, Routine, RoutineFolder, SetEntry, WorkoutExercise } from './types';
import { uid } from './utils';
import { t } from './i18n';

/* ---------- Supersets ---------- */

export interface SupersetSlot {
  /** Index of the superset among those in the list (drives its colour), or null. */
  group: number | null;
  first: boolean;
  last: boolean;
}

/** Consecutive exercises with the same supersetId form a group; a lone id is not a superset. */
export function supersetSlots(list: WorkoutExercise[]): SupersetSlot[] {
  const slots: SupersetSlot[] = list.map(() => ({ group: null, first: false, last: false }));
  let group = -1;
  for (let i = 0; i < list.length; i++) {
    const id = list[i].supersetId;
    if (!id) continue;
    const prevSame = i > 0 && list[i - 1].supersetId === id;
    const nextSame = i < list.length - 1 && list[i + 1].supersetId === id;
    if (!prevSame && !nextSame) continue;
    if (!prevSame) group++;
    slots[i] = { group, first: !prevSame, last: !nextSame };
  }
  return slots;
}

/** Joins exercise i with the next one, extending an existing superset if either is in one. */
export function linkWithNext(list: WorkoutExercise[], i: number): WorkoutExercise[] {
  if (i >= list.length - 1) return list;
  const id = list[i].supersetId ?? list[i + 1].supersetId ?? uid();
  const next = [...list];
  const old = list[i + 1].supersetId;
  for (let j = 0; j < next.length; j++) {
    if (j === i || j === i + 1 || (old && next[j].supersetId === old)) next[j] = { ...next[j], supersetId: id };
  }
  return next;
}

export function unlink(list: WorkoutExercise[], i: number): WorkoutExercise[] {
  return list.map((we, j) => (j === i ? { ...we, supersetId: undefined } : we));
}

/* ---------- Rep ranges ---------- */

export function fmtRepRange(reps: number | null | undefined, repsMax: number | null | undefined): string {
  if (!reps && !repsMax) return '';
  if (reps && repsMax && repsMax > reps) return `${reps}-${repsMax}`;
  return String(reps || repsMax);
}

/** "8-12" → {8, 12}; "10" → {10, null}; "" → nulls; anything else → undefined. */
export function parseRepRange(text: string): { reps: number | null; repsMax: number | null } | undefined {
  const t = text.replace(/\s/g, '').replace(/[–—]/g, '-');
  if (!t) return { reps: null, repsMax: null };
  const m = t.match(/^(\d{1,3})(?:-(\d{0,3}))?$/);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : null;
  return { reps: a, repsMax: b && b > a ? b : null };
}

/** Range across all sets of an exercise, e.g. sets 4-6 and 8-10 → "4-10". */
export function exerciseRepRange(sets: SetEntry[]): string {
  const lows = sets.map((s) => s.reps).filter((v): v is number => !!v);
  const highs = sets.map((s) => s.repsMax ?? s.reps).filter((v): v is number => !!v);
  if (!lows.length) return '';
  return fmtRepRange(Math.min(...lows), Math.max(...highs));
}

/* ---------- Summary ---------- */

/** Seconds one set takes before its rest; holds and cardio use their planned time when set. */
const WORK_SECONDS = 45;

export interface RoutineSummary {
  exercises: number;
  sets: number;
  seconds: number;
  muscles: [Muscle, number][];
}

/** Estimated time: every set counts its work (≈45 s) plus the exercise's rest. */
export function routineSummary(exercises: WorkoutExercise[], exMap: Map<string, Exercise>): RoutineSummary {
  let sets = 0;
  let seconds = 0;
  const muscles = new Map<Muscle, number>();
  for (const we of exercises) {
    const muscle = exMap.get(we.exerciseId)?.muscle ?? 'other';
    for (const s of we.sets) {
      sets++;
      seconds += (s.duration ?? WORK_SECONDS) + we.restSec;
      if (s.type !== 'warmup') muscles.set(muscle, (muscles.get(muscle) ?? 0) + 1);
    }
  }
  return {
    exercises: exercises.length,
    sets,
    seconds,
    muscles: [...muscles.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/* ---------- Share links ---------- */

/** Compact, versioned format for routines in a link. Unknown exercises are reported on import. */
interface PackV1 {
  v: 1;
  /** Folder name, when a whole folder is shared. */
  f?: string;
  r: {
    n: string;
    /** [exerciseId, restSec, note, supersetGroup (0 = none), sets: [type, reps, repsMax, weightKg, durationSec, distanceKm]] */
    e: [string, number, string, number, (string | number | null)[][]][];
  }[];
}

export interface SharedRoutines {
  folder?: string;
  routines: Routine[];
}

const TYPE_CODE = { normal: 'n', warmup: 'w', drop: 'd', failure: 'f' } as const;
const CODE_TYPE = { n: 'normal', w: 'warmup', d: 'drop', f: 'failure' } as const;

function toPack(folder: RoutineFolder | undefined, routines: Routine[]): PackV1 {
  return {
    v: 1,
    ...(folder ? { f: folder.name } : {}),
    r: routines.map((r) => {
      const groups = new Map<string, number>();
      return {
        n: r.name,
        e: r.exercises.map((we) => {
          let g = 0;
          if (we.supersetId) {
            if (!groups.has(we.supersetId)) groups.set(we.supersetId, groups.size + 1);
            g = groups.get(we.supersetId)!;
          }
          const sets = we.sets.map((s) => {
            const row: (string | number | null)[] = [
              TYPE_CODE[s.type], s.reps ?? null, s.repsMax ?? null, s.weight ?? null, s.duration ?? null, s.distance ?? null,
            ];
            while (row.length > 1 && row[row.length - 1] == null) row.pop();
            return row;
          });
          return [we.exerciseId, we.restSec, we.note ?? '', g, sets];
        }),
      };
    }),
  };
}

function fromPack(p: PackV1): SharedRoutines {
  if (p?.v !== 1 || !Array.isArray(p.r)) throw new Error(t('This link does not contain routines.'));
  return {
    folder: typeof p.f === 'string' ? p.f : undefined,
    routines: p.r.map((r) => {
      const groupIds = new Map<number, string>();
      return {
        id: uid(),
        name: String(r.n || 'Routine'),
        updatedAt: Date.now(),
        exercises: r.e.map(([exerciseId, restSec, note, g, sets]) => {
          if (g && !groupIds.has(g)) groupIds.set(g, uid());
          return {
            id: uid(),
            exerciseId: String(exerciseId),
            restSec: Number(restSec) || 0,
            ...(note ? { note: String(note) } : {}),
            ...(g ? { supersetId: groupIds.get(g) } : {}),
            sets: sets.map(([t, reps, repsMax, weight, duration, distance]) => ({
              id: uid(),
              type: CODE_TYPE[t as keyof typeof CODE_TYPE] ?? 'normal',
              reps: (reps as number) ?? null,
              repsMax: (repsMax as number) ?? null,
              weight: (weight as number) ?? null,
              duration: (duration as number) ?? null,
              distance: (distance as number) ?? null,
              done: false,
            })),
          };
        }),
      };
    }),
  };
}

const b64url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** "z" + deflated JSON when the browser can compress, else "j" + plain JSON; both base64url. */
export async function encodeRoutines(folder: RoutineFolder | undefined, routines: Routine[]): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toPack(folder, routines)));
  if (typeof CompressionStream !== 'undefined') {
    return 'z' + b64url(await pipe(json, new CompressionStream('deflate-raw')));
  }
  return 'j' + b64url(json);
}

export async function decodeRoutines(code: string): Promise<SharedRoutines> {
  const c = code.trim();
  try {
    const bytes = fromB64url(c.slice(1));
    let json: Uint8Array;
    if (c[0] === 'z') json = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (c[0] === 'j') json = bytes;
    else throw new Error();
    return fromPack(JSON.parse(new TextDecoder().decode(json)));
  } catch (e) {
    if (e instanceof Error && e.message === t('This link does not contain routines.')) throw e;
    throw new Error(t('This link is incomplete or damaged. Copy the whole link and try again.'));
  }
}

/** Pulls the code out of a full share link, or accepts the bare code. */
export function codeFromText(text: string): string | null {
  const t = text.trim();
  const m = t.match(/#\/import\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return /^[zj][A-Za-z0-9_-]{8,}$/.test(t) ? t : null;
}

export function shareUrl(code: string): string {
  return `${location.origin}${location.pathname}#/import/${code}`;
}

/** A live set from a routine set: the routine's numbers become hints, not entries. */
export function liveSetFromRoutine(s: SetEntry): SetEntry {
  return {
    ...s,
    id: uid(),
    done: false,
    reps: null,
    repsMax: null,
    target: s.reps || s.repsMax ? { reps: s.reps ?? null, repsMax: s.repsMax ?? null } : null,
  };
}
