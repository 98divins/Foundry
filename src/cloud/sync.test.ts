import { describe, expect, it } from 'vitest';
import { defaultState } from '../store';
import type { State } from '../types';
import { emptyMeta, hasData, loginAction, refreshAction, sameTime } from './sync';

const empty = defaultState();
const withData: State = { ...defaultState(), routines: [{ id: 'r', name: 'Push', exercises: [], updatedAt: 0 }] };
const remote = { updatedAt: '2026-11-14T10:00:00Z' };

describe('sync decisions', () => {
  it('knows when there is nothing to protect', () => {
    expect(hasData(empty)).toBe(false);
    expect(hasData(withData)).toBe(true);
  });

  it('a fresh phone takes the account data', () => {
    expect(loginAction(emptyMeta(), 'u1', empty, remote)).toBe('download');
  });

  it('merges when both a used phone and the account hold data for the first time', () => {
    expect(loginAction(emptyMeta(), 'u1', withData, remote)).toBe('merge');
    // Same phone, other account: also merge.
    expect(loginAction({ ...emptyMeta(), userId: 'u2', remoteUpdatedAt: remote.updatedAt }, 'u1', withData, remote)).toBe('merge');
  });

  it('same account again: uploads its own changes, takes the cloud when only the cloud moved', () => {
    const synced = { userId: 'u1', remoteUpdatedAt: remote.updatedAt, dirty: false, lastSyncAt: 1 };
    expect(loginAction(synced, 'u1', withData, remote)).toBe('none');
    expect(loginAction({ ...synced, dirty: true }, 'u1', withData, remote)).toBe('upload');
    expect(loginAction(synced, 'u1', withData, { updatedAt: '2026-11-15T08:00:00Z' })).toBe('download');
    expect(loginAction({ ...synced, dirty: true }, 'u1', withData, { updatedAt: '2026-11-15T08:00:00Z' })).toBe('merge');
  });

  it('on return to the app: upload, download, or merge if both moved', () => {
    const m = { userId: 'u1', remoteUpdatedAt: 'A', dirty: false, lastSyncAt: 1 };
    expect(refreshAction(m, 'A')).toBe('none');
    expect(refreshAction(m, 'B')).toBe('download');
    expect(refreshAction({ ...m, dirty: true }, 'A')).toBe('upload');
    expect(refreshAction({ ...m, dirty: true }, 'B')).toBe('merge');
  });
});

describe('timestamps from Postgres', () => {
  it('treats "…Z" and "…+00:00" for the same instant as unchanged', () => {
    const meta = { userId: 'u', remoteUpdatedAt: '2026-11-14T17:15:16.123Z', dirty: true, lastSyncAt: 1 };
    expect(sameTime('2026-11-14T17:15:16.123+00:00', meta.remoteUpdatedAt)).toBe(true);
    expect(refreshAction(meta, '2026-11-14T17:15:16.123+00:00')).toBe('upload');
    expect(refreshAction(meta, '2026-11-14T17:20:00+00:00')).toBe('merge');
  });
});
