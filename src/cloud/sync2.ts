/**
 * Sync v2 (docs/SYNC_V2.md, 3.2–3.3): one row per item in `user_items`, the server sets the time.
 * Pure helpers here (tested); the network calls take a Supabase client so they can be faked.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { diffState, itemKey, joinState, splitState, type Split } from '../db';
import type { State } from '../types';

export interface Row {
  kind: string;
  id: string;
  data: unknown;
  deleted?: boolean;
  updated_at?: string;
}

/** Documents that stay on this device: v1 tombstones (v2 keeps deletions as rows). */
const LOCAL_ONLY = new Set(['state:deleted']);

/** Local key ("workout|abc", "state:settings", "order:routine", "nutrition") ↔ row (kind, id). */
export function toRowKey(key: string): { kind: string; id: string } | null {
  if (LOCAL_ONLY.has(key)) return null;
  const bar = key.indexOf('|');
  if (bar > 0) return { kind: key.slice(0, bar), id: key.slice(bar + 1) };
  return { kind: 'doc', id: key };
}
export const fromRowKey = (r: { kind: string; id: string }) => (r.kind === 'doc' ? r.id : itemKey(r.kind, r.id));

/** The v1 tombstone name of a local item key (cloud/merge.ts), to respect deletions made before v2. */
const TOMB: Record<string, string> = { workout: 'w', routine: 'r', folder: 'f', exercise: 'x', food: 'food', log: 'log', meal: 'meal', weight: 'kg', checkin: 'ci', favorite: 'fav', incomplete: 'inc' };
export function tombstoneKey(key: string): string {
  const bar = key.indexOf('|');
  return `${TOMB[key.slice(0, bar)] ?? key.slice(0, bar)}:${key.slice(bar + 1)}`;
}

/** Every row describing a state (for the first upload of an account). */
export function rowsOf(sp: Split): Row[] {
  const rows: Row[] = [];
  for (const [k, v] of sp.items) rows.push({ ...toRowKey(k)!, data: v });
  for (const [k, v] of sp.docs) {
    const rk = toRowKey(k);
    if (rk) rows.push({ ...rk, data: v ?? null });
  }
  return rows;
}

/** The keys a change touched (what must be sent). */
export function changedKeys(before: Split, after: Split): string[] {
  const d = diffState(before, after);
  return [...d.put.map(([k]) => k), ...d.del, ...d.docs.map(([k]) => k)].filter((k) => toRowKey(k));
}

/** The rows to send for these keys, read from the current state (a missing item is a deletion). */
export function rowsFor(keys: Iterable<string>, sp: Split): Row[] {
  const out: Row[] = [];
  for (const k of keys) {
    const rk = toRowKey(k);
    if (!rk) continue;
    const isDoc = rk.kind === 'doc';
    const has = isDoc ? sp.docs.has(k) : sp.items.has(k);
    const v = isDoc ? sp.docs.get(k) : sp.items.get(k);
    out.push(has && v !== undefined ? { ...rk, data: v } : { ...rk, data: null, deleted: true });
  }
  return out;
}

/**
 * Apply rows received from the server to the local state. Keys still waiting to be sent from this
 * device are skipped: they will be sent next and the server will then have them. Returns null when
 * nothing changes.
 */
export function applyRows(state: State, rows: Row[], pending: Set<string>, base: State): State | null {
  const sp = splitState(state);
  let changed = false;
  for (const r of rows) {
    const k = fromRowKey(r);
    if (pending.has(k) || r.kind === 'meta') continue;
    const isDoc = r.kind === 'doc';
    const map = isDoc ? sp.docs : sp.items;
    if (r.deleted) {
      if (map.has(k)) {
        map.delete(k);
        changed = true;
      }
    } else if (JSON.stringify(map.get(k)) !== JSON.stringify(r.data)) {
      map.set(k, r.data);
      changed = true;
    }
  }
  return changed ? joinState(sp.items, sp.docs, base) : null;
}

/** A state built from all of an account's rows (first sync of a new device). */
export function stateFromRows(rows: Row[], base: State): State {
  const items = new Map<string, unknown>();
  const docs = new Map<string, unknown>();
  for (const r of rows) {
    if (r.deleted || r.kind === 'meta') continue;
    (r.kind === 'doc' ? docs : items).set(fromRowKey(r), r.data);
  }
  return joinState(items, docs, base);
}

/** The latest server time in a list of rows (the next "changed since" cursor). */
export const maxTime = (rows: Row[], cursor: string | null) =>
  rows.reduce<string | null>((m, r) => (r.updated_at && (!m || Date.parse(r.updated_at) > Date.parse(m)) ? r.updated_at : m), cursor);

/* ---------- Network ---------- */

const BATCH = 200;
const PAGE = 1000;

/** Send rows in batches; returns the server times written. */
export async function pushRows(sb: SupabaseClient, uid: string, rows: Row[]): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({ user_id: uid, kind: r.kind, id: r.id, data: r.deleted ? null : r.data, deleted: !!r.deleted }));
    const { data, error } = await sb.from('user_items').upsert(batch, { onConflict: 'user_id,kind,id' }).select('kind, id, updated_at');
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
  }
  return out;
}

/** Every row changed after the cursor (all rows when there is none), page by page. */
export async function pullRows(sb: SupabaseClient, uid: string, cursor: string | null): Promise<Row[]> {
  const out: Row[] = [];
  let since = cursor;
  for (;;) {
    let q = sb.from('user_items').select('kind, id, data, deleted, updated_at').eq('user_id', uid).order('updated_at').limit(PAGE);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
    since = maxTime(rows, since);
  }
}

/** Whether the account moved to v2 ('migrated') or was switched on for it ('v2_enabled'). */
export async function accountMode(sb: SupabaseClient, uid: string): Promise<{ migrated: boolean; enabled: boolean }> {
  const { data, error } = await sb.from('user_items').select('id').eq('user_id', uid).eq('kind', 'meta');
  if (error) {
    // Table not created yet on the server: stay on v1.
    if (error.code === '42P01' || error.code === 'PGRST205') return { migrated: false, enabled: false };
    throw error;
  }
  const ids = new Set((Array.isArray(data) ? (data as { id: string }[]) : []).map((r) => r.id));
  return { migrated: ids.has('migrated'), enabled: ids.has('v2_enabled') };
}
