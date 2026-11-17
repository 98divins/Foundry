import { describe, expect, it } from 'vitest';
import { prepareSignOut } from './signOut';

describe('sign-out', () => {
  it('goes ahead when everything is on the account', async () => {
    let synced = false;
    expect(
      await prepareSignOut(
        () => false,
        async () => void (synced = true),
      ),
    ).toBe('clean');
    expect(synced).toBe(false);
  });
  it('syncs pending changes first (merging with another device) and goes ahead once sent', async () => {
    let dirty = true;
    expect(
      await prepareSignOut(
        () => dirty,
        async () => void (dirty = false),
      ),
    ).toBe('clean');
  });
  it('stops when the changes could not be sent (refused upload or no connection)', async () => {
    expect(
      await prepareSignOut(
        () => true,
        async () => {},
      ),
    ).toBe('unsaved');
    expect(
      await prepareSignOut(
        () => true,
        async () => {
          throw new Error('offline');
        },
      ),
    ).toBe('unsaved');
  });
});
