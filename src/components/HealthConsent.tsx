import { useState } from 'react';
import { go } from '../hooks';
import { giveHealthConsent } from '../healthConsent';
import { t } from '../i18n';
import { useStore } from '../store';
import { LegalSheet } from './Legal';
import { Header, Icon } from './ui';

/** Shown the first time nutrition is opened: explicit consent for health data, or nothing is stored. */
export function HealthConsentScreen() {
  const { update } = useStore();
  const [ok, setOk] = useState(false);
  const [reading, setReading] = useState(false);
  return (
    <>
      <Header title={t('Nutrition')} />
      <main className="page form health-consent">
        <Icon name="lock" size={32} />
        <h2>{t('Your health data')}</h2>
        <p>
          {t(
            'To set your targets and follow your progress, Foundry needs your weight, your measurements and what you eat. These are health data: they stay in your account, are never shown to your friends and never sold.',
          )}
        </p>
        <label className="toggle-line consent">
          <input id="health-consent" type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span className="small">
            {t(
              'I agree that Foundry processes my weight, my measurements and what I eat to compute my targets and my statistics. These are health data. I can withdraw this consent at any time in Settings → Privacy, which erases them.',
            )}
          </span>
        </label>
        <button className="link-btn small" onClick={() => setReading(true)}>
          {t('Read the privacy policy')}
        </button>
        <p className="muted small">{t('Foundry gives estimates for healthy adults, not medical advice.')}</p>
        <button className="btn btn-primary btn-wide" disabled={!ok} onClick={() => update((s) => giveHealthConsent(s))}>
          {t('Continue')}
        </button>
        <button className="btn btn-wide" onClick={() => go('', { replace: true })}>
          {t('Not now')}
        </button>
      </main>
      <LegalSheet kind={reading ? 'privacy' : null} onClose={() => setReading(false)} />
    </>
  );
}
