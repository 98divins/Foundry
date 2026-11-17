import { useState } from 'react';
import { useCloud } from '../cloud/cloud';
import { t } from '../i18n';
import { LEGAL_DRAFT, LEGAL_VERSION, legalDoc, type LegalKind } from '../legal';
import { useStore } from '../store';
import { Sheet } from './ui';
import { LogoutButton } from './LogoutButton';

export type { LegalKind };
const doc = legalDoc;

export function LegalBody({ kind }: { kind: LegalKind }) {
  const d = doc(kind);
  return (
    <article className="legal">
      <p className="muted small">{d.updated}</p>
      {LEGAL_DRAFT && <p className="legal-draft small">{t('Draft: to be completed and reviewed before the public launch.')}</p>}
      {d.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

/** A legal text in a sheet, for screens shown before the user is signed in. */
export function LegalSheet({ kind, onClose }: { kind: LegalKind | null; onClose: () => void }) {
  return (
    <Sheet open={!!kind} onClose={onClose} title={kind ? doc(kind).title : ''} tall>
      {kind && <LegalBody kind={kind} />}
    </Sheet>
  );
}

/** The consent line under the sign-up form (and in the consent sheet): links open the texts. */
export function ConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState<LegalKind | null>(null);
  return (
    <>
      <label className="toggle-line consent">
        <input id="consent" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="small">
          {t('I am 16 or over and I accept the')}{' '}
          <button type="button" className="link-btn" onClick={() => setOpen('terms')}>
            {t('terms of use')}
          </button>
          .
        </span>
      </label>
      <p className="muted small consent-info">
        {t('How your data is used:')}{' '}
        <button type="button" className="link-btn" onClick={() => setOpen('privacy')}>
          {t('privacy policy')}
        </button>
        . {t('Your weight and what you eat are only used if you agree to it, when you first use nutrition.')}
      </p>
      <LegalSheet kind={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Asks signed-in users who have not accepted the current texts (older accounts, or after a change). */
export function ConsentGate() {
  const { state, update } = useStore();
  const c = useCloud();
  const [ok, setOk] = useState(false);
  const accepted = state.settings.consent?.version === LEGAL_VERSION;
  if (!c.configured || !c.user || !c.initialSynced || accepted) return null;
  return (
    <Sheet open onClose={() => {}} title={t('Before you continue')} noClose>
      <p className="sheet-text">{t('Foundry stores your training and nutrition data in your account. Please read and accept how it is used.')}</p>
      <ConsentCheckbox checked={ok} onChange={setOk} />
      <div className="menu">
        <button
          className="btn btn-primary btn-wide"
          disabled={!ok}
          onClick={() => update((s) => ({ ...s, settings: { ...s.settings, consent: { at: Date.now(), version: LEGAL_VERSION } } }))}
        >
          {t('Accept and continue')}
        </button>
        <LogoutButton className="btn btn-wide" />
      </div>
    </Sheet>
  );
}
