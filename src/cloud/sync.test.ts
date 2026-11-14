import { describe, expect, it } from 'vitest';
import { defaultState } from '../store';
import type { State } from '../types';
import { emptyMeta, hasData, loginAction, refreshAction } from './sync';

const empty = defaultState();
const withData: State = { ...defaultState(), routines: [{ id: 'r', name: 'Push', exercises: [], updatedAt: 0 }] };
const remote = { updatedAt: '2026-11-14T10:00:00Z' };

describe('sync decisions', () => {
  it('knows when there is nothing to protect', () => {
    expect(hasData(empty)).toBe(false);
    expect(hasData(withData)).toBe(true);
  });

  it('first login on a phone with data and an empty account uploads it', () => {
    expect(loginAction(emptyMeta(), 'u1', withData, null)).toBe('upload');
    expect(loginAction(emptyMeta(), 'u1', empty, null)).toBe('none');
  });

  it('a fresh phone takes the account data', () => {
    expect(loginAction(emptyMeta(), 'u1', empty, remote)).toBe('download');
  });

  it('asks when both a used phone and the account hold data for the first time', () => {
    expect(loginAction(emptyMeta(), 'u1', withData, remote)).toBe('ask');
    // Same phone, other account: also ask.
    expect(loginAction({ ...emptyMeta(), userId: 'u2', remoteUpdatedAt: remote.updatedAt }, 'u1', withData, remote)).toBe('ask');
  });

  it('same account again: uploads its own changes, takes the cloud when only the cloud moved', () => {
    const synced = { userId: 'u1', remoteUpdatedAt: remote.updatedAt, dirty: false, lastSyncAt: 1 };
    expect(loginAction(synced, 'u1', withData, remote)).toBe('none');
    expect(loginAction({ ...synced, dirty: true }, 'u1', withData, remote)).toBe('upload');
    expect(loginAction(synced, 'u1', withData, { updatedAt: '2026-11-15T08:00:00Z' })).toBe('download');
    expect(loginAction({ ...synced, dirty: true }, 'u1', withData, { updatedAt: '2026-11-15T08:00:00Z' })).toBe('ask');
  });

  it('on return to the app: upload, download, or ask if both moved', () => {
    const m = { userId: 'u1', remoteUpdatedAt: 'A', dirty: false, lastSyncAt: 1 };
    expect(refreshAction(m, 'A')).toBe('none');
    expect(refreshAction(m, 'B')).toBe('download');
    expect(refreshAction({ ...m, dirty: true }, 'A')).toBe('upload');
    expect(refreshAction({ ...m, dirty: true }, 'B')).toBe('ask');
    expect(refreshAction({ ...m, dirty: true, remoteUpdatedAt: null }, null)).toBe('upload');
  });
});
