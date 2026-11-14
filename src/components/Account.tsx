import { useState } from 'react';
import { summary, useCloud } from '../cloud/cloud';
import { Sheet } from './ui';
import { locale, t } from '../i18n';

/** Shown anywhere in the app: choose a version after a conflict, or set a new password. */
export function CloudDialogs() {
  const c = useCloud();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const conflict = c.conflict;
  const line = (s: ReturnType<typeof summary>) =>
    t('{w} workouts · {r} routines · {f} foods logged · {k} weigh-ins', { w: s.workouts, r: s.routines, f: s.foods, k: s.weighIns });

  return (
    <>
      <Sheet open={!!conflict} onClose={() => {}} title={t('Which version do you keep?')} noClose>
        {conflict && (
          <div className="form">
            <p className="sheet-text">
              {conflict.reason === 'login'
                ? t('This phone and your account both hold data. Choose the one to keep; the other is replaced.')
                : t('Your data changed on this phone and on another device since the last sync. Choose the one to keep.')}
            </p>
            <div className="choice">
              <strong>{t('This phone')}</strong>
              <span className="muted small">{line(summary(conflict.local))}</span>
              <button className="btn btn-wide" onClick={() => c.resolve('local')}>{t('Keep this phone’s data')}</button>
            </div>
            <div className="choice">
              <strong>{t('Your account')}</strong>
              <span className="muted small">
                {t('{0} · saved {1}', { 0: line(summary(conflict.remote)), 1: new Date(conflict.remoteUpdatedAt).toLocaleString(locale()) })}</span>
              <button className="btn btn-wide" onClick={() => c.resolve('remote')}>{t('Use my account’s data')}</button>
            </div>
            <p className="muted small">{t('Tip: export a backup from Settings first if you want to keep both.')}</p>
          </div>
        )}
      </Sheet>
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
