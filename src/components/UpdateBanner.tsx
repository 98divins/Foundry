import { useEffect, useState } from 'react';
import { t } from '../i18n';

/**
 * Phones keep installed web apps in memory and in cache, so a new deploy can go unnoticed for a while.
 * On start and each return to the app, compare this build with the one online and offer a reload.
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const check = async () => {
      try {
        const res = await fetch('./version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== __BUILD_ID__) {
          // Let the service worker pick up the new files too.
          (await navigator.serviceWorker?.getRegistration())?.update().catch(() => {});
          setReady(true);
        }
      } catch {
        /* offline: try again next time */
      }
    };
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      <span>{t('A new version of Foundry is available.')}</span>
      <button className="btn btn-small btn-primary" onClick={() => location.reload()}>
        {t('Update')}
      </button>
    </div>
  );
}
