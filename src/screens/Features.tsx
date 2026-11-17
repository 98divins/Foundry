import { Header } from '../components/ui';
import { FEATURES, featureOn, setFeature } from '../features';
import { back, go } from '../hooks';
import { t } from '../i18n';
import { useStore } from '../store';

/** Settings → Features in test: switch on what is still being tried out (features.ts). */
export function FeaturesPage() {
  const { state, update } = useStore();
  const s = state.settings;
  return (
    <>
      <Header title={t('Features in test')} onBack={back} />
      <main className="page">
        <p className="muted small">{t('These features are still being tried out. Turn on the ones you want; your data is kept whether they are on or off.')}</p>
        <section className="panel">
          {FEATURES.filter((f) => f.inTest).map((f) => (
            <label className="setting" key={f.id}>
              <span>
                {t(f.label)}
                <br />
                <span className="muted small">{t(f.text)}</span>
              </span>
              <input
                type="checkbox"
                className="switch"
                checked={featureOn(s, f.id)}
                onChange={(e) => update((st) => ({ ...st, settings: setFeature(st.settings, f.id, e.target.checked) }))}
              />
            </label>
          ))}
        </section>
      </main>
    </>
  );
}

/** Shown when a page belongs to a feature that is switched off. */
export function FeatureOff() {
  return (
    <>
      <Header title={t('Features in test')} onBack={back} />
      <main className="page">
        <div className="empty-card">
          <p>{t('This feature is switched off.')}</p>
          <button className="btn btn-primary" onClick={() => go('settings/features')}>
            {t('Features in test')}
          </button>
        </div>
      </main>
    </>
  );
}
