/**
 * Signing out empties this device, so nothing not yet on the account may be left behind.
 * Pending changes are first merged and sent with a full sync (an upload alone can be refused when
 * another device wrote in between); if they still are not on the account, the caller must ask the
 * person before going further.
 */
export type SignOutCheck = 'clean' | 'unsaved';

export async function prepareSignOut(isDirty: () => boolean, fullSync: () => Promise<void>): Promise<SignOutCheck> {
  if (!isDirty()) return 'clean';
  try {
    await fullSync();
  } catch {
    /* offline or server error: checked below */
  }
  return isDirty() ? 'unsaved' : 'clean';
}
