import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultState, parseBackup, useStore } from '../store';
import type { State } from '../types';
import { appUrl, cloudConfigured, SUPABASE_KEY, SUPABASE_URL } from './config';
import { emptyMeta, loadMeta, loginAction, refreshAction, saveMeta, summary, type SyncMeta } from './sync';

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';

interface Conflict {
  reason: 'login' | 'both-changed';
  local: State;
  remote: State;
  remoteUpdatedAt: string;
}

interface CloudCtx {
  configured: boolean;
  /** False until the saved session (if any) has been read: avoids flashing the welcome screen. */
  authReady: boolean;
  /** True once the first sync after sign-in has finished (or is waiting on a conflict choice). */
  initialSynced: boolean;
  user: User | null;
  status: SyncStatus;
  error: string;
  lastSyncAt: number | null;
  conflict: Conflict | null;
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  resendConfirmation: (email: string) => Promise<string | null>;
  setNewPassword: (password: string) => Promise<string | null>;
  /** Returns an error when unsent changes cannot be uploaded (offline): signing out would lose them. */
  signOut: () => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
  syncNow: () => Promise<void>;
  resolve: (keep: 'local' | 'remote') => Promise<void>;
}

const Ctx = createContext<CloudCtx | null>(null);

let client: SupabaseClient | null = null;
async function getClient(): Promise<SupabaseClient | null> {
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
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Confirm your email first: open the link we sent you.';
  if (m.includes('already registered')) return 'An account already exists with this email. Log in instead.';
  if (m.includes('password should be')) return 'Choose a password of at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a few minutes and try again.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No connection. Check your internet and try again.';
  return message;
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const { state, update } = useStore();
  const configured = cloudConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SyncStatus>(configured ? 'signed-out' : 'off');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<Conflict | null>(null);
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

  const upload = useCallback(
    async (uid: string) => {
      const sb = (await getClient())!;
      const updatedAt = new Date().toISOString();
      const { error: e } = await sb.from('user_state').upsert({ user_id: uid, data: stateRef.current, updated_at: updatedAt });
      if (e) throw e;
      setMeta({ userId: uid, remoteUpdatedAt: updatedAt, dirty: false, lastSyncAt: Date.now() });
    },
    [setMeta],
  );

  const applyRemote = useCallback(
    (uid: string, data: State, updatedAt: string) => {
      applyingRemote.current = true;
      update(() => parseBackup(JSON.stringify(data)));
      setMeta({ userId: uid, remoteUpdatedAt: updatedAt, dirty: false, lastSyncAt: Date.now() });
    },
    [update, setMeta],
  );

  const fail = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    const offline = !navigator.onLine || /fetch|network/i.test(msg);
    setStatus(offline ? 'offline' : 'error');
    setError(offline ? '' : explain(msg));
  }, []);

  /** First sync after signing in. */
  const onLogin = useCallback(
    async (u: User) => {
      setStatus('syncing');
      try {
        const remote = await fetchRemote(u.id, true);
        const action = loginAction(metaRef.current, u.id, stateRef.current, remote ? { updatedAt: remote.updated_at } : null);
        if (action === 'upload') await upload(u.id);
        else if (action === 'download' && remote?.data) applyRemote(u.id, remote.data, remote.updated_at);
        else if (action === 'ask' && remote?.data) {
          setConflict({ reason: 'login', local: stateRef.current, remote: remote.data, remoteUpdatedAt: remote.updated_at });
          setStatus('conflict');
          return;
        } else setMeta({ ...metaRef.current, userId: u.id, lastSyncAt: Date.now() });
        ready.current = true;
        setStatus('synced');
        setError('');
      } catch (e) {
        fail(e);
      } finally {
        setInitialSynced(true);
      }
    },
    [fetchRemote, upload, applyRemote, setMeta, fail],
  );

  /** Later syncs: on return to the app, when back online, or on demand. */
  const refresh = useCallback(async () => {
    if (!user || conflict) return;
    setStatus('syncing');
    try {
      const head = await fetchRemote(user.id, false);
      const action = refreshAction(metaRef.current, head?.updated_at ?? null);
      if (action === 'upload') await upload(user.id);
      else if (action === 'download' || action === 'ask') {
        const remote = await fetchRemote(user.id, true);
        if (remote?.data) {
          if (action === 'download') applyRemote(user.id, remote.data, remote.updated_at);
          else {
            setConflict({ reason: 'both-changed', local: stateRef.current, remote: remote.data, remoteUpdatedAt: remote.updated_at });
            setStatus('conflict');
            return;
          }
        }
      }
      setStatus('synced');
      setError('');
    } catch (e) {
      fail(e);
    }
  }, [user, conflict, fetchRemote, upload, applyRemote, fail]);

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
    setMeta({ ...metaRef.current, dirty: true });
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
    update(() => defaultState());
  };

  const value: CloudCtx = {
    configured,
    authReady,
    initialSynced,
    user,
    status,
    error,
    lastSyncAt: meta.lastSyncAt,
    conflict,
    recovering,
    signIn: async (email, password) => {
      const sb = await getClient();
      if (!sb) return 'Cloud sync is not set up.';
      const { error: e } = await sb.auth.signInWithPassword({ email, password });
      return e ? explain(e.message) : null;
    },
    signUp: async (email, password) => {
      const sb = await getClient();
      if (!sb) return 'Cloud sync is not set up.';
      const { data, error: e } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
      if (e) return explain(e.message);
      return data.session ? null : 'CHECK_EMAIL';
    },
    resendConfirmation: async (email) => {
      const sb = await getClient();
      if (!sb) return 'Cloud sync is not set up.';
      const { error: e } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl() } });
      return e ? explain(e.message) : null;
    },
    resetPassword: async (email) => {
      const sb = await getClient();
      if (!sb) return 'Cloud sync is not set up.';
      const { error: e } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
      return e ? explain(e.message) : null;
    },
    setNewPassword: async (password) => {
      const sb = await getClient();
      if (!sb) return 'Cloud sync is not set up.';
      const { error: e } = await sb.auth.updateUser({ password });
      if (!e) setRecovering(false);
      return e ? explain(e.message) : null;
    },
    signOut: async () => {
      const sb = await getClient();
      // Send anything pending first; with no connection, keep the session rather than lose changes.
      if (user && metaRef.current.dirty) {
        try {
          await upload(user.id);
        } catch {
          return 'You have changes that are not saved to your account yet. Connect to the internet, then log out.';
        }
      }
      await sb?.auth.signOut();
      clearDevice();
      return null;
    },
    deleteAccount: async () => {
      const sb = await getClient();
      if (!sb || !user) return 'Not signed in.';
      const { error: e } = await sb.rpc('delete_my_account');
      if (e) return explain(e.message);
      await sb.auth.signOut();
      clearDevice();
      return null;
    },
    syncNow: refresh,
    resolve: async (keep) => {
      if (!conflict || !user) return;
      setStatus('syncing');
      try {
        if (keep === 'remote') applyRemote(user.id, conflict.remote, conflict.remoteUpdatedAt);
        else await upload(user.id);
        setConflict(null);
        ready.current = true;
        setStatus('synced');
      } catch (e) {
        fail(e);
      }
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloud(): CloudCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloud outside CloudProvider');
  return c;
}

export { summary };
