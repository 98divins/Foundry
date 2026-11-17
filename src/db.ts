/**
 * Local storage in IndexedDB (docs/SYNC_V2.md, 3.1). The state is split into one entry per item
 * (workout, food logged, weigh-in…) and a few documents (settings, profile, the nutrition plan…).
 * A change writes only what changed: the state is immutable, so an unchanged item keeps the same
 * reference and is skipped. The app itself still sees one State object.
 */
import type { State } from './types';

/* ---------- Splitting the state ---------- */

type AnyItem = Record<string, unknown> | string;

interface ListDef {
  kind: string;
  get: (s: State) => AnyItem[] | undefined;
  set: (s: State, xs: AnyItem[]) => State;
  key: (x: AnyItem) => string;
  /** Lists whose order the person chooses keep it in an "order:<kind>" document. */
  ordered?: boolean;
  sort?: (a: AnyItem, b: AnyItem) => number;
}

const byId = (x: AnyItem) => (x as { id: string }).id;
const n = (s: State) => s.nutrition;
const setN = (s: State, k: string, xs: AnyItem[]): State => ({ ...s, nutrition: { ...s.nutrition, [k]: xs } });
const num = (k: string) => (a: AnyItem, b: AnyItem) => ((a as Record<string, number>)[k] ?? 0) - ((b as Record<string, number>)[k] ?? 0);
const str = (k: string) => (a: AnyItem, b: AnyItem) => String((a as Record<string, string>)[k]).localeCompare(String((b as Record<string, string>)[k]));

export const LISTS: ListDef[] = [
  { kind: 'workout', get: (s) => s.workouts as unknown as AnyItem[], set: (s, xs) => ({ ...s, workouts: xs as never }), key: byId, sort: num('startedAt') },
  { kind: 'routine', get: (s) => s.routines as unknown as AnyItem[], set: (s, xs) => ({ ...s, routines: xs as never }), key: byId, ordered: true },
  { kind: 'folder', get: (s) => s.folders as unknown as AnyItem[], set: (s, xs) => ({ ...s, folders: xs as never }), key: byId, ordered: true },
  { kind: 'exercise', get: (s) => s.customExercises as unknown as AnyItem[], set: (s, xs) => ({ ...s, customExercises: xs as never }), key: byId, ordered: true },
  { kind: 'food', get: (s) => n(s)?.foods as unknown as AnyItem[], set: (s, xs) => setN(s, 'foods', xs), key: byId, ordered: true },
  { kind: 'meal', get: (s) => n(s)?.savedMeals as unknown as AnyItem[], set: (s, xs) => setN(s, 'savedMeals', xs), key: byId, ordered: true },
  { kind: 'log', get: (s) => n(s)?.log as unknown as AnyItem[], set: (s, xs) => setN(s, 'log', xs), key: byId, sort: num('createdAt') },
  { kind: 'weight', get: (s) => n(s)?.weights as unknown as AnyItem[], set: (s, xs) => setN(s, 'weights', xs), key: (x) => (x as { date: string }).date, sort: str('date') },
  { kind: 'checkin', get: (s) => n(s)?.checkIns as unknown as AnyItem[], set: (s, xs) => setN(s, 'checkIns', xs), key: (x) => (x as { date: string }).date, sort: str('date') },
  { kind: 'favorite', get: (s) => n(s)?.favorites as unknown as AnyItem[], set: (s, xs) => setN(s, 'favorites', xs), key: (x) => x as string, ordered: true },
  { kind: 'incomplete', get: (s) => n(s)?.incompleteDays as unknown as AnyItem[], set: (s, xs) => setN(s, 'incompleteDays', xs), key: (x) => x as string, sort: (a, b) => String(a).localeCompare(String(b)) },
];

const TOP_LISTS = new Set(['workouts', 'routines', 'folders', 'customExercises', 'nutrition']);
const NUTRITION_LISTS = new Set(['foods', 'savedMeals', 'log', 'weights', 'checkIns', 'favorites', 'incompleteDays']);

export const itemKey = (kind: string, key: string) => `${kind}|${key}`;

export interface Split {
  items: Map<string, unknown>;
  docs: Map<string, unknown>;
}

/** One entry per item, plus documents for everything else (and the order of ordered lists). */
export function splitState(s: State): Split {
  const items = new Map<string, unknown>();
  const docs = new Map<string, unknown>();
  for (const l of LISTS) {
    const xs = l.get(s) ?? [];
    for (const x of xs) items.set(itemKey(l.kind, l.key(x)), x);
    if (l.ordered) docs.set('order:' + l.kind, xs.map(l.key));
  }
  for (const [k, v] of Object.entries(s)) if (!TOP_LISTS.has(k)) docs.set('state:' + k, v);
  const plan: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s.nutrition ?? {})) if (!NUTRITION_LISTS.has(k)) plan[k] = v;
  docs.set('nutrition', plan);
  return { items, docs };
}

/** The inverse of splitState. Ordered lists follow their order document; the others are sorted. */
export function joinState(items: Iterable<[string, unknown]>, docs: Map<string, unknown>, base: State): State {
  const byKind = new Map<string, Map<string, AnyItem>>();
  for (const [k, v] of items) {
    const i = k.indexOf('|');
    const kind = k.slice(0, i);
    if (!byKind.has(kind)) byKind.set(kind, new Map());
    byKind.get(kind)!.set(k.slice(i + 1), v as AnyItem);
  }
  let s: State = { ...base };
  for (const [k, v] of docs) if (k.startsWith('state:')) (s as unknown as Record<string, unknown>)[k.slice(6)] = v;
  s = { ...s, settings: { ...base.settings, ...s.settings }, nutrition: { ...base.nutrition, ...((docs.get('nutrition') as object) ?? {}) } };
  for (const l of LISTS) {
    const m = byKind.get(l.kind) ?? new Map<string, AnyItem>();
    let xs: AnyItem[];
    if (l.ordered) {
      const order = (docs.get('order:' + l.kind) as string[] | undefined) ?? [];
      const seen = new Set<string>();
      xs = [];
      for (const key of order) if (m.has(key) && !seen.has(key)) (seen.add(key), xs.push(m.get(key)!));
      for (const [key, x] of m) if (!seen.has(key)) xs.push(x); // not in the order document: at the end
    } else {
      xs = [...m.values()];
      if (l.sort) xs.sort(l.sort);
    }
    s = l.set(s, xs);
  }
  return s;
}

export interface Diff {
  put: [string, unknown][];
  del: string[];
  docs: [string, unknown][];
}

/** What changed between two states, by reference: only those entries need writing. */
export function diffState(prev: Split, next: Split): Diff {
  const put: [string, unknown][] = [];
  const del: string[] = [];
  const docs: [string, unknown][] = [];
  for (const [k, v] of next.items) if (prev.items.get(k) !== v) put.push([k, v]);
  for (const k of prev.items.keys()) if (!next.items.has(k)) del.push(k);
  for (const [k, v] of next.docs) {
    const p = prev.docs.get(k);
    if (p === v) continue;
    // Order documents and the nutrition plan are rebuilt each time: compare their contents.
    if ((k.startsWith('order:') || k === 'nutrition') && shallowEqual(p, v)) continue;
    docs.push([k, v]);
  }
  for (const k of prev.docs.keys()) if (!next.docs.has(k)) docs.push([k, undefined]);
  return { put, del, docs };
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

/** Documents only (settings, plan, order of lists…): small, rebuilt on each change. */
export function splitDocs(s: State): Map<string, unknown> {
  const docs = new Map<string, unknown>();
  for (const l of LISTS) if (l.ordered) docs.set('order:' + l.kind, (l.get(s) ?? []).map(l.key));
  for (const [k, v] of Object.entries(s)) if (!TOP_LISTS.has(k)) docs.set('state:' + k, v);
  const plan: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s.nutrition ?? {})) if (!NUTRITION_LISTS.has(k)) plan[k] = v;
  docs.set('nutrition', plan);
  return docs;
}

/**
 * What changed between two states, looking only at the lists that changed (same array = skipped):
 * ticking a set compares workouts only, not five years of food logs.
 */
export function diffStates(prev: State, next: State): Diff {
  const put: [string, unknown][] = [];
  const del: string[] = [];
  for (const l of LISTS) {
    const a = l.get(prev) ?? [];
    const b = l.get(next) ?? [];
    if (a === b) continue;
    const before = new Map(a.map((x) => [l.key(x), x] as const));
    for (const x of b) {
      const k = l.key(x);
      if (before.get(k) !== x) put.push([itemKey(l.kind, k), x]);
      before.delete(k);
    }
    for (const k of before.keys()) del.push(itemKey(l.kind, k));
  }
  const docs = diffState({ items: new Map(), docs: splitDocs(prev) }, { items: new Map(), docs: splitDocs(next) }).docs;
  return { put, del, docs };
}

export const diffSize = (d: Diff) => d.put.length + d.del.length + d.docs.length;

/* ---------- IndexedDB ---------- */

const DB_NAME = 'foundry';
const DB_VERSION = 2;

const req = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const done = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error('aborted'));
  });

/** The database, or null when IndexedDB is not available (some private modes): the app then keeps localStorage. */
export function openDb(timeoutMs = 3000): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (!settled) {
        settled = true;
        resolve(db);
      }
    };
    setTimeout(() => finish(null), timeoutMs);
    try {
      if (typeof indexedDB === 'undefined') return finish(null);
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items');
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs');
        if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
      };
      r.onsuccess = () => finish(r.result);
      r.onerror = () => finish(null);
      r.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

/*
 * Items are stored in monthly chunks ("workout@2026-11": [[key, item], …]) rather than one entry
 * each: reading 5 years at startup takes half the time (fewer records), and a change rewrites only
 * the chunk it falls in. Lists without dates are one chunk per kind.
 */
const DATED: Record<string, (v: Record<string, unknown>) => string | undefined> = {
  workout: (v) => (typeof v.startedAt === 'number' ? new Date(v.startedAt).toISOString().slice(0, 7) : undefined),
  log: (v) => (v.date as string)?.slice(0, 7),
  weight: (v) => (v.date as string)?.slice(0, 7),
  checkin: (v) => (v.date as string)?.slice(0, 7),
};
export function chunkOf(key: string, value: unknown): string {
  const kind = key.slice(0, key.indexOf('|'));
  const month = DATED[kind]?.(value as Record<string, unknown>) ?? 'all';
  return `${kind}@${month}`;
}

export async function readAll(db: IDBDatabase): Promise<{ items: [string, unknown][]; docs: Map<string, unknown>; legacy: boolean }> {
  const tx = db.transaction(['chunks', 'items', 'docs'], 'readonly');
  const [chunks, legacyKeys, legacyValues, dk, dv] = await Promise.all([
    req(tx.objectStore('chunks').getAll()),
    req(tx.objectStore('items').getAllKeys()),
    req(tx.objectStore('items').getAll()),
    req(tx.objectStore('docs').getAllKeys()),
    req(tx.objectStore('docs').getAll()),
  ]);
  const items: [string, unknown][] = [];
  for (const ch of chunks as [string, unknown][][]) items.push(...ch);
  // One entry per item (the first IndexedDB format): still read, converted on the next write.
  legacyKeys.forEach((k, i) => items.push([String(k), legacyValues[i]]));
  return { items, docs: new Map(dk.map((k, i) => [String(k), dv[i]])), legacy: legacyKeys.length > 0 };
}

/**
 * Write a change in one transaction (all or nothing): the chunks holding changed items are
 * rewritten from the new state; documents are written one by one.
 */
export async function writeDiff(db: IDBDatabase, d: Diff, prev: State | null, next: State): Promise<void> {
  if (!diffSize(d) && prev) return;
  const all = !prev; // first write: every chunk
  const touched = new Set<string>();
  if (prev) {
    const prevValue = new Map<string, unknown>();
    const kinds = new Set([...d.put.map(([k]) => k), ...d.del].map((k) => k.slice(0, k.indexOf('|'))));
    for (const l of LISTS) if (kinds.has(l.kind)) for (const x of l.get(prev) ?? []) prevValue.set(itemKey(l.kind, l.key(x)), x);
    for (const [k, v] of d.put) {
      touched.add(chunkOf(k, v));
      if (prevValue.has(k)) touched.add(chunkOf(k, prevValue.get(k))); // moved to another month
    }
    for (const k of d.del) if (prevValue.has(k)) touched.add(chunkOf(k, prevValue.get(k)));
  }
  // Rebuild the touched chunks from the lists they belong to (only those lists are walked).
  const kinds = all ? null : new Set([...touched].map((ch) => ch.slice(0, ch.indexOf('@'))));
  const content = new Map<string, [string, unknown][]>();
  for (const l of LISTS) {
    if (kinds && !kinds.has(l.kind)) continue;
    for (const x of l.get(next) ?? []) {
      const k = itemKey(l.kind, l.key(x));
      const ch = chunkOf(k, x);
      if (!all && !touched.has(ch)) continue;
      if (!content.has(ch)) content.set(ch, []);
      content.get(ch)!.push([k, x]);
    }
  }
  const tx = db.transaction(['chunks', 'items', 'docs'], 'readwrite');
  const chunks = tx.objectStore('chunks');
  if (all) {
    chunks.clear();
    tx.objectStore('items').clear();
  }
  for (const ch of all ? content.keys() : touched) {
    const v = content.get(ch);
    if (v?.length) chunks.put(v, ch);
    else chunks.delete(ch);
  }
  const docs = tx.objectStore('docs');
  for (const [k, v] of all ? [...splitDocs(next)] : d.docs) (v === undefined ? docs.delete(k) : docs.put(v, k));
  await done(tx);
}

export async function writeDoc(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  const tx = db.transaction('docs', 'readwrite');
  tx.objectStore('docs').put(value, key);
  await done(tx);
}
