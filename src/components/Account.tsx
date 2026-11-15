import { useState } from 'react';
import { useCloud } from '../cloud/cloud';
import { Sheet } from './ui';
import { t } from '../i18n';

/** Shown anywhere in the app: set a new password after following a reset link. */
export function CloudDialogs() {
  const c = useCloud();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  return (
    <>
      <Sheet open={c.recovering} onClose={() => {}} title={t('Choose a new password')} noClose>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            const err = await c.setNewPassword(password);
            setMsg(err ?? '');
          }}
        >
          <label className="field">
            <span>{t('New password')}</span>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {msg && <p className="field-error">{msg}</p>}
          <button className="btn btn-primary btn-wide" type="submit" disabled={password.length < 8}>{t('Save password')}</button>
        </form>
      </Sheet>
    </>
  );
}
