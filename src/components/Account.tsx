import { useState } from 'react';
import { summary, useCloud } from '../cloud/cloud';
import { Sheet } from './ui';

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
