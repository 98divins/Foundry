import { useState } from 'react';
import { UNSAVED, useCloud } from '../cloud/cloud';
import { t } from '../i18n';
import { Sheet } from './ui';

/** Log out, after sending pending changes; if they cannot be sent, the person decides. */
export function LogoutButton({ className }: { className: string }) {
  const c = useCloud();
  const [busy, setBusy] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async (force: boolean) => {
    setBusy(true);
    setMsg('');
    const e = await c.signOut(force);
    setBusy(false);
    if (e === UNSAVED) setUnsaved(true);
    else if (e) setMsg(e);
    else setUnsaved(false);
  };
  return (
    <>
      <button className={className} disabled={busy} onClick={() => run(false)}>
        {busy ? t('Saving your changes…') : t('Log out')}
      </button>
      {msg && <p className="field-error center">{msg}</p>}
      <Sheet open={unsaved} onClose={() => setUnsaved(false)} title={t('Changes not saved yet')}>
        <div className="form">
          <p>{t('Some changes on this phone are not on your account yet (no connection, or the sync failed). Logging out now erases them from this phone.')}</p>
          <div className="menu">
            <button className="btn btn-primary btn-wide" disabled={busy} onClick={() => run(false)}>{t('Try again')}</button>
            <button className="btn btn-ghost-danger btn-wide" disabled={busy} onClick={() => run(true)}>{t('Log out anyway and lose these changes')}</button>
            <button className="btn btn-wide" onClick={() => setUnsaved(false)}>{t('Stay signed in')}</button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
