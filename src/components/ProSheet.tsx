import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { PRO_COPY, PRO_FREE_DURING_BETA, type ProFeature } from '../pro';
import { Icon, Sheet } from './ui';

/** The one upgrade sheet, opened by requirePro() anywhere in the app. */
export function ProSheet() {
  const [feature, setFeature] = useState<ProFeature | null>(null);
  useEffect(() => {
    const on = (e: Event) => setFeature((e as CustomEvent<ProFeature>).detail);
    addEventListener('foundry:pro', on);
    return () => removeEventListener('foundry:pro', on);
  }, []);
  return (
    <Sheet open={!!feature} onClose={() => setFeature(null)} title={t('Foundry Pro')}>
      {feature && (
        <div className="form pro-sheet">
          <p>{t(PRO_COPY[feature])}</p>
          <ul className="pro-perks small">
            <li><Icon name="check" size={16} /> {t('Adaptive nutrition coach and weekly check-ins')}</li>
            <li><Icon name="check" size={16} /> {t('Unlimited workouts, folders and saved meals')}</li>
            <li><Icon name="check" size={16} /> {t('Full history, advanced statistics, diet × strength')}</li>
            <li><Icon name="check" size={16} /> {t('Head-to-head with friends, long leaderboards')}</li>
            <li><Icon name="check" size={16} /> {t('Plan meals a month ahead, Excel export, custom colours')}</li>
          </ul>
          {PRO_FREE_DURING_BETA ? (
            <p className="muted small">{t('Subscriptions are not open yet. You are previewing the free version: turn it off in Settings → Subscription to get everything back.')}</p>
          ) : null}
          <button className="btn btn-primary btn-wide" onClick={() => setFeature(null)}>
            {t('Got it')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
