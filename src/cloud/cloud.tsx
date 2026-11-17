import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultState, parseBackup, useStore } from '../store';
import type { State } from '../types';
import { appUrl, cloudConfigured, SUPABASE_KEY, SUPABASE_URL } from './config';
import { mergeStates } from './merge';
import { belongsToOtherAccount, emptyMeta, hasData, loadMeta, loginAction, refreshAction, saveMeta, type SyncMeta } from './sync';
import { t } from '../i18n';

import { prepareSignOut } from './signOut';

/** signOut() result when changes are not on the account yet. */
export const UNSAVED = 'unsaved-changes';

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

interface CloudCtx {
  configured: boolean;
  /** False until the saved session (if any) has been read: avoids flashing the welcome screen. */
  authReady: boolean;
  /** True once the first sync after sign-in has finished. */
  initialSynced: boolean;
  user: User | null;
  status: SyncStatus;
  error: string;
  lastSyncAt: number | null;
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  resendConfirmation: (email: string) => Promise<string | null>;
  changeEmail: (email: string) => Promise<string | null>;
  setNewPassword: (password: string) => Promise<string | null>;
  /** Returns an error when unsent changes cannot be uploaded (offline): signing out would lose them. */
  /** Returns an error message, UNSAVED when pending changes could not be sent (ask, then call again with force), or null. */
  signOut: (force?: boolean) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<CloudCtx | null>(null);

let client: SupabaseClient | null = null;
export async function getClient(): Promise<SupabaseClient | null> {
  if (!cloudConfigured()) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'foundry-auth' },
    });
  }
  return client;
}

/** Supabase answers in English with technical wording; say what to do instead. */
function explain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return t('Wrong email or password.');
  if (m.includes('email not confirmed')) return t('Confirm your email first: open the link we sent you.');
  if (m.includes('already registered')) return t('An account already exists with this email. Log in instead.');
  if (m.includes('password should be')) return t('Choose a password of at least 8 characters.');
  if (m.includes('rate limit') || m.includes('too many')) return t('Too many attempts. Wait a few minutes and try again.');
  if (m.includes('failed to fetch') || m.includes('network')) return t('No connection. Check your internet and try again.');
  return message;
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const { state, replace } = useStore();
  const configured = cloudConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SyncStatus>(configured ? 'signed-out' : 'off');
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [authReady, setAuthReady] = useState(!configured);
  const [initialSynced, setInitialSynced] = useState(false);
  const [meta, setMetaState] = useState<SyncMeta>(loadMeta);
  const metaRef = useRef(meta);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Set while the cloud copy is being written into the app, so it is not uploaded straight back. */
  const applyingRemote = useRef(false);
  const ready = useRef(false);

  const setMeta = useCallback((m: SyncMeta) => {
    metaRef.current = m;
    saveMeta(m);
    setMetaState(m);
  }, []);

  const fetchRemote = useCallback(async (uid: string, withData: boolean) => {
    const sb = (await getClient())!;
    const { data, error: e } = await sb
      .from('user_state')
      .select(withData ? 'data, updated_at' : 'updated_at')
      .eq('user_id', uid)
      .maybeSingle();
    if (e) throw e;
    return data as { data?: State; updated_at: string } | null;
  }, []);

  /** Bumped on every local change: an upload only clears "dirty" if nothing changed meanwhile. */
  const changeSeq = useRef(0);
  /** One sync at a time; a request during a sync runs once more right after. */
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  /**
   * Write this device's state to the account. The write only succeeds if the account copy is still
   * the one this device last saw; otherwise another device wrote first and the caller merges again.
   */
  const upload = useCallback(
    async (uid: string): Promise<boolean> => {
      const sb = (await getClient())!;
      const updatedAt = new Date().toISOString();
      const seq = changeSeq.current;
      const data = stateRef.current;
      const known = metaRef.current.userId === uid ? metaRef.current.remoteUpdatedAt : null;
      if (known) {
        const { data: rows, error: e } = await sb
          .from('user_state')
          .update({ data, updated_at: updatedAt })
          .eq('user_id', uid)
          .eq('updated_at', known)
          .select('updated_at');
        if (e) throw e;
        if (!rows?.length) return false;
      } else {
        const { error: e } = await sb.from('user_state').insert({ user_id: uid, data, updated_at: updatedAt });
        if (e) {
          if (e.code === '23505') return false; // a copy appeared meanwhile: merge with it
          throw e;
        }
      }
      setMeta({
        ...metaRef.current,
        userId: uid,
        remoteUpdatedAt: updatedAt,
        dirty: changeSeq.current !== seq,
        lastSyncAt: Date.now(),
      });
      return true;
    },
    [setMeta],
  );

  /** Put a state from the account (or a merge) into the app without it counting as a local edit. */
  const applyRemote = useCallback(
    (uid: string, data: State, updatedAt: string, dirty = false) => {
      const next = parseBackup(JSON.stringify(data));
      applyingRemote.current = true;
      stateRef.current = next;
      replace(next);
      setMeta({ ...metaRef.current, userId: uid, remoteUpdatedAt: updatedAt, dirty, lastSyncAt: Date.now() });
    },
    [replace, setMeta],
  );

  const fail = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    const offline = !navigator.onLine || /fetch|network/i.test(msg);
    setStatus(offline ? 'offline' : 'error');
    setError(offline ? '' : explain(msg));
  }, []);

  /**
   * Bring this device and the account to the same state: upload, download or merge both, never ask.
   * Retries when another device wrote in between.
   */
  const syncWith = useCallback(
    async (uid: string, first: boolean) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const head = await fetchRemote(uid, false);
        const meta = metaRef.current;
        if (!head) {
          // No copy in the account yet (new account). Another account's data on this device stays out
          // of it; data from before accounts existed becomes the new account's.
          if (belongsToOtherAccount(meta, uid)) {
            applyingRemote.current = true;
            stateRef.current = defaultState();
            replace(stateRef.current);
            setMeta({ ...emptyMeta(), userId: uid, lastSyncAt: Date.now() });
            return;
          }
          if (!hasData(stateRef.current) && !meta.dirty) {
            setMeta({ ...meta, userId: uid, remoteUpdatedAt: null, lastSyncAt: Date.now() });
            return;
          }
          setMeta({ ...meta, userId: uid, remoteUpdatedAt: null });
          if (await upload(uid)) return;
          continue;
        }
        const action =
          first && attempt === 0
            ? loginAction(meta, uid, stateRef.current, { updatedAt: head.updated_at })
            : refreshAction(meta, head.updated_at);
        if (action === 'none') {
          setMeta({ ...meta, userId: uid, lastSyncAt: Date.now() });
          return;
        }
        if (action === 'upload') {
          if (await upload(uid)) return;
          continue;
        }
        const remote = await fetchRemote(uid, true);
        if (!remote?.data) continue;
        if (action === 'download') {
          applyRemote(uid, remote.data, remote.updated_at);
          return;
        }
        // Both changed: keep everything from both, then save the result to the account.
        const localNewer = (meta.lastChangeAt ?? 0) > Date.parse(remote.updated_at);
        const merged = mergeStates(stateRef.current, parseBackup(JSON.stringify(remote.data)), localNewer);
        applyRemote(uid, merged, remote.updated_at, true);
        if (await upload(uid)) return;
      }
    },
    [fetchRemote, upload, applyRemote, setMeta],
  );

  const runSync = useCallback(
    async (uid: string, first: boolean) => {
      if (running.current) {
        again.current = true;
        return running.current;
      }
      const job = (async () => {
        setStatus('syncing');
        try {
          do {
            again.current = false;
            await syncWith(uid, first);
            first = false;
          } while (again.current);
          ready.current = true;
          setStatus('synced');
          setError('');
        } catch (e) {
          fail(e);
        } finally {
          running.current = null;
        }
      })();
      running.current = job;
      return job;
    },
    [syncWith, fail],
  );

  /** First sync after signing in. */
  const onLogin = useCallback(
    async (u: User) => {
      await runSync(u.id, true);
      ready.current = true;
      setInitialSynced(true);
    },
    [runSync],
  );

  /** Later syncs: after changes, on return to the app, when back online, or on demand. */
  const refresh = useCallback(async () => {
    if (!user) return;
    await runSync(user.id, false);
  }, [user, runSync]);

  // Session: restore on start, follow sign-in / sign-out / password recovery.
  useEffect(() => {
    if (!configured) return;
    let unsub = () => {};
    getClient().then(async (sb) => {
      if (!sb) return setAuthReady(true);
      const { data } = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
      // The email links come back with ?code=…; drop it from the address once used.
      if (location.search.includes('code=')) history.replaceState(history.state, '', location.pathname + location.hash);
      if (data.session?.user) {
        setUser(data.session.user);
        onLogin(data.session.user);
      }
      setAuthReady(true);
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') setRecovering(true);
        if (event === 'SIGNED_IN' && session?.user) {
          setUser((prev) => {
            if (prev?.id !== session.user.id) onLogin(session.user);
            return session.user;
          });
        }
        if (event === 'SIGNED_OUT') {
          setUser(null);
          ready.current = false;
          setInitialSynced(false);
          setStatus('signed-out');
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  // Every change: mark it unsent at once, upload 2 s after the last one.
  useEffect(() => {
    if (!user || !ready.current) return;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    changeSeq.current++;
    setMeta({ ...metaRef.current, dirty: true, lastChangeAt: Date.now() });
    const t = setTimeout(() => {
      if (!navigator.onLine) return setStatus('offline');
      refresh();
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, user]);

  // Back to the app or back online: catch up both ways.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refresh]);

  /** Accounts are required: once signed out, this device keeps no one's data. */
  const clearDevice = () => {
    setMeta(emptyMeta());
    replace(defaultState());
  };

  const value: CloudCtx = {
    configured,
    authReady,
    initialSynced,
    user,
    status,
    error,
    lastSyncAt: meta.lastSyncAt,
    recovering,
    signIn: async (email, password) => {
      const sb = await getClient();
      if (!sb) return t('Cloud sync is not set up.');
      const { error: e } = await sb.auth.signInWithPassword({ email, password });
      return e ? explain(e.message) : null;
    },
    signUp: async (email, password) => {
      const sb = await getClient();
      if (!sb) return t('Cloud sync is not set up.');
      const { data, error: e } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
      if (e) return explain(e.message);
      return data.session ? null : 'CHECK_EMAIL';
    },
    changeEmail: async (email) => {
      const sb = await getClient();
      if (!sb) return t('Cloud sync is not set up.');
      const { error: e } = await sb.auth.updateUser({ email }, { emailRedirectTo: appUrl() });
      return e ? explain(e.message) : null;
    },
    resendConfirmation: async (email) => {
      const sb = await getClient();
      if (!sb) return t('Cloud sync is not set up.');
      const { error: e } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl() } });
      return e ? explain(e.message) : null;
    },
    resetPassword: async (email) => {
      const sb = await getClient();
      if (!sb) return t('Cloud sync is not set up.');
      const { error: e } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
      return e ? explain(e.message) : null;
    },
    setNewPassword: async (password) => {
      const sb = await getClient();
      if (!sb) return t('Cloud sync is not set up.');
      const { error: e } = await sb.auth.updateUser({ password });
      if (!e) setRecovering(false);
      return e ? explain(e.message) : null;
    },
    signOut: async (force = false) => {
      const sb = await getClient();
      // Merge and send anything pending first; if it still is not on the account, ask before losing it.
      if (user && !force && (await prepareSignOut(() => metaRef.current.dirty, () => runSync(user.id, false))) === 'unsaved') {
        return UNSAVED;
      }
      await sb?.auth.signOut();
      clearDevice();
      return null;
    },
    deleteAccount: async () => {
      const sb = await getClient();
      if (!sb || !user) return t('Not signed in.');
      const { error: e } = await sb.rpc('delete_my_account');
      if (e) return explain(e.message);
      await sb.auth.signOut();
      clearDevice();
      return null;
    },
    syncNow: refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloud(): CloudCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloud outside CloudProvider');
  return c;
}

