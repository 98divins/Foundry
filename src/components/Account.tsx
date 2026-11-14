import { useState } from 'react';
import { summary, useCloud } from '../cloud/cloud';
import { Confirm, Sheet } from './ui';

const ago = (t: number | null) => {
  if (!t) return 'never';
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

/** "Account & sync" panel of the Settings page. */
export function AccountSection() {
  const c = useCloud();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!c.configured) {
    return (
      <section className="panel">
        <h2 className="panel-title">Account & sync</h2>
        <p className="muted small">Cloud accounts are not switched on yet. Your data stays on this device.</p>
      </section>
    );
  }

  if (c.user) {
    const label: Record<string, string> = {
      syncing: 'Syncing…',
      synced: `Synced ${ago(c.lastSyncAt)}`,
      offline: 'Offline: changes are kept and sent when you are back online',
      error: 'Sync problem',
      conflict: 'Waiting for you to choose which version to keep',
    };
    return (
      <section className="panel">
        <h2 className="panel-title">Account & sync</h2>
        <p>
          Signed in as <strong>{c.user.email}</strong>
        </p>
        <p className={'sync-status ' + c.status}>
          <span className="sync-dot" aria-hidden="true" /> {label[c.status] ?? ''}
        </p>
        {c.error && <p className="field-error">{c.error}</p>}
        <p className="muted small">
          Your workouts, routines and nutrition are saved to your account and follow you on every device where you sign
          in.
        </p>
        <div className="btn-grid">
          <button className="btn" onClick={() => c.syncNow()} disabled={c.status === 'syncing'}>
            Sync now
          </button>
          <button className="btn" onClick={() => c.signOut()}>
            Log out
          </button>
        </div>
        <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmDelete(true)}>
          Delete my account
        </button>
        <Confirm
          open={confirmDelete}
          title="Delete your account?"
          message="Your account and the copy of your data in the cloud are deleted for good. The data on this device stays until you erase it."
          confirmLabel="Delete account"
          danger
          onConfirm={async () => {
            const e = await c.deleteAccount();
            setMsg(e ? { text: e, error: true } : { text: 'Your account was deleted.' });
          }}
          onClose={() => setConfirmDelete(false)}
        />
        {msg && <p className={msg.error ? 'field-error' : 'ok-line'}>{msg.text}</p>}
      </section>
    );
  }

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const e =
      mode === 'login'
        ? await c.signIn(email.trim(), password)
        : mode === 'signup'
          ? await c.signUp(email.trim(), password)
          : await c.resetPassword(email.trim());
    setBusy(false);
    if (e === 'CHECK_EMAIL') setMsg({ text: `Almost done: open the link we sent to ${email.trim()} to confirm your account.` });
    else if (e) setMsg({ text: e, error: true });
    else if (mode === 'reset') setMsg({ text: `If an account exists for ${email.trim()}, a reset link is on its way.` });
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Account & sync</h2>
      <p className="muted small">
        Create a free account to save your data in the cloud: nothing is lost if you change or lose your phone, and you
        can use Foundry on several devices.
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span>Email</span>
          <input id="acc-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'reset' && (
          <label className="field">
            <span>Password</span>
            <input
              id="acc-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {msg && <p className={msg.error ? 'field-error' : 'ok-line'}>{msg.text}</p>}
        <button
          className="btn btn-primary btn-wide"
          type="submit"
          disabled={busy || !email.includes('@') || (mode !== 'reset' && password.length < 8)}
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>
        <div className="account-links">
          {mode !== 'login' && (
            <button type="button" className="link-btn" onClick={() => { setMode('login'); setMsg(null); }}>
              I have an account
            </button>
          )}
          {mode !== 'signup' && (
            <button type="button" className="link-btn" onClick={() => { setMode('signup'); setMsg(null); }}>
              Create an account
            </button>
          )}
          {mode === 'login' && (
            <button type="button" className="link-btn" onClick={() => { setMode('reset'); setMsg(null); }}>
              Forgot password?
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

/** Shown anywhere in the app: choose a version after a conflict, or set a new password. */
export function CloudDialogs() {
  const c = useCloud();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const conflict = c.conflict;
  const line = (s: ReturnType<typeof summary>) =>
    `${s.workouts} workouts · ${s.routines} routines · ${s.foods} foods logged · ${s.weighIns} weigh-ins`;

  return (
    <>
      <Sheet open={!!conflict} onClose={() => {}} title="Which version do you keep?" noClose>
        {conflict && (
          <div className="form">
            <p className="sheet-text">
              {conflict.reason === 'login'
                ? 'This phone and your account both hold data. Choose the one to keep; the other is replaced.'
                : 'Your data changed on this phone and on another device since the last sync. Choose the one to keep.'}
            </p>
            <div className="choice">
              <strong>This phone</strong>
              <span className="muted small">{line(summary(conflict.local))}</span>
              <button className="btn btn-wide" onClick={() => c.resolve('local')}>
                Keep this phone’s data
              </button>
            </div>
            <div className="choice">
              <strong>Your account</strong>
              <span className="muted small">
                {line(summary(conflict.remote))} · saved {new Date(conflict.remoteUpdatedAt).toLocaleString()}
              </span>
              <button className="btn btn-wide" onClick={() => c.resolve('remote')}>
                Use my account’s data
              </button>
            </div>
            <p className="muted small">Tip: export a backup from Settings first if you want to keep both.</p>
          </div>
        )}
      </Sheet>
      <Sheet open={c.recovering} onClose={() => {}} title="Choose a new password" noClose>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            const err = await c.setNewPassword(password);
            setMsg(err ?? '');
          }}
        >
          <label className="field">
            <span>New password</span>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {msg && <p className="field-error">{msg}</p>}
          <button className="btn btn-primary btn-wide" type="submit" disabled={password.length < 8}>
            Save password
          </button>
        </form>
      </Sheet>
    </>
  );
}
