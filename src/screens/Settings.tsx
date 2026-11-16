import { useRef, useState } from 'react';
import { useCloud } from '../cloud/cloud';
import { Confirm, Header, Icon, Logo, Segmented, type IconName } from '../components/ui';
import { back, go } from '../hooks';
import { useStore } from '../store';
import type { NameLang, Settings, Unit } from '../types';
import { fmtClock } from '../utils';
import { DataPage } from './Profile';
import { sendFeedback } from '../cloud/social';
import { LegalBody } from '../components/Legal';
import { ACCENTS, DEFAULT_ACCENT } from '../theme';
import { t, detectLang, locale, type AppLang } from '../i18n';
import { previewingFree, requirePro, setPreviewFree } from '../pro';

type Page = 'profile' | 'account' | 'workouts' | 'units' | 'language' | 'theme' | 'data' | 'guide' | 'faq' | 'about' | 'privacy' | 'terms' | 'contact';

function Row({ icon, label, value, onClick }: { icon: IconName; label: string; value?: string; onClick: () => void }) {
  return (
    <li>
      <button className="settings-row" onClick={onClick}>
        <Icon name={icon} />
        <span className="settings-label">{label}</span>
        {value && <span className="muted small settings-value">{value}</span>}
        <Icon name="chevron" size={18} />
      </button>
    </li>
  );
}

function useSetting() {
  const { state, update } = useStore();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
  return { s: state.settings, set };
}

/** Settings home: grouped list, like the rest of the app's menus. */
export function SettingsHub() {
  const { state } = useStore();
  const c = useCloud();
  const { s } = useSetting();
  const [msg, setMsg] = useState('');
  const open = (p: Page) => go('settings/' + p);
  return (
    <>
      <Header title={t('Settings')} onBack={() => back('profile')} />
      <main className="page settings-page">
        <h2 className="settings-group">{t('Account')}</h2>
        <ul className="settings-list">
          <Row icon="user" label={t('Profile')} value={state.profile?.name || undefined} onClick={() => open('profile')} />
          <Row icon="lock" label={t('Account')} value={c.user?.email ?? undefined} onClick={() => open('account')} />
        </ul>
        <h2 className="settings-group">{t('Preferences')}</h2>
        <ul className="settings-list">
          <Row icon="dumbbell" label={t('Workouts')} onClick={() => open('workouts')} />
          <Row icon="ruler" label={t('Units')} value={`${s.unit} · ${s.distanceUnit ?? 'km'} · ${s.heightUnit ?? 'cm'}`} onClick={() => open('units')} />
          <Row icon="globe" label={t('Language')} value={(s.appLang ?? detectLang()) === 'fr' ? 'Français' : 'English'} onClick={() => open('language')} />
          <Row icon="moon" label={t('Theme')} value={t({ system: 'System', light: 'Light', dark: 'Dark' }[s.theme ?? 'system']) + (s.accent || s.pureBlack ? ' · ' + t('Custom') : '')} onClick={() => open('theme')} />
        </ul>
        <h2 className="settings-group">{t('Data')}</h2>
        <ul className="settings-list">
          <Row icon="download" label={t('Export & import data')} onClick={() => open('data')} />
        </ul>
        <h2 className="settings-group">{t('Help')}</h2>
        <ul className="settings-list">
          <Row icon="info" label={t('Getting started guide')} onClick={() => open('guide')} />
          <Row icon="help" label={t('Frequently asked questions')} onClick={() => open('faq')} />
          <Row icon="help" label={t('Contact us · ideas and bugs')} onClick={() => open('contact')} />
          <Row icon="logo" label={t('About Foundry')} onClick={() => open('about')} />
        </ul>
        <h2 className="settings-group">{t('Legal')}</h2>
        <ul className="settings-list">
          <Row icon="lock" label={t('Privacy policy')} onClick={() => open('privacy')} />
          <Row icon="info" label={t('Terms of use')} onClick={() => open('terms')} />
        </ul>
        {c.user && (
          <button
            className="btn btn-ghost-danger btn-wide settings-logout"
            onClick={async () => {
              const e = await c.signOut();
              if (e) setMsg(e);
            }}
          >{t('Log out')}</button>
        )}
        {msg && <p className="field-error center">{msg}</p>}
      </main>
    </>
  );
}

export function SettingsPage({ page }: { page?: string }) {
  switch (page as Page | undefined) {
    case 'profile':
      return <ProfilePage />;
    case 'account':
      return <AccountPage />;
    case 'workouts':
      return <WorkoutPrefs />;
    case 'units':
      return <UnitsPage />;
    case 'language':
      return <LanguagePage />;
    case 'theme':
      return <ThemePage />;
    case 'data':
      return <DataPage />;
    case 'guide':
      return <GuidePage />;
    case 'faq':
      return <FaqPage />;
    case 'contact':
      return <ContactPage />;
    case 'about':
      return <AboutPage />;
    case 'privacy':
      return (
        <Sub title={t('Privacy policy')}>
          <LegalBody kind="privacy" />
        </Sub>
      );
    case 'terms':
      return (
        <Sub title={t('Terms of use')}>
          <LegalBody kind="terms" />
        </Sub>
      );
    default:
      return <SettingsHub />;
  }
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Header title={title} onBack={() => back('settings')} />
      <main className="page">{children}</main>
    </>
  );
}

/* ---------- Profile ---------- */

/** Square-crops and shrinks a photo to a small JPEG, so it syncs quickly. */
async function avatarFrom(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Profile picture, or a neutral head-and-shoulders placeholder when there is none. */
export function Avatar({ size = 64 }: { size?: number }) {
  const { state } = useStore();
  const p = state.profile;
  return p?.avatar ? (
    <img className="avatar" src={p.avatar} alt="" width={size} height={size} />
  ) : (
    <svg className="avatar avatar-anon" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="39" r="17" />
      <path d="M16 92C16 72 31 61 50 61S84 72 84 92Z" />
    </svg>
  );
}

function ProfilePage() {
  const { state, update } = useStore();
  const p = state.profile ?? { name: '', bio: '' };
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const setP = (patch: Partial<typeof p>) => update((s) => ({ ...s, profile: { ...p, ...s.profile, ...patch } }));
  return (
    <Sub title={t('Profile')}>
      <div className="profile-photo">
        <Avatar size={112} />
        <div className="profile-photo-actions">
          <button className="link-btn" onClick={() => file.current?.click()}>
            {p.avatar ? t('Change picture') : t('Add a picture')}
          </button>
          {p.avatar && (
            <button className="link-btn muted" onClick={() => setP({ avatar: null })}>{t('Remove')}</button>
          )}
        </div>
        <input
          ref={file}
          id="avatar-file"
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              setP({ avatar: await avatarFrom(f) });
              setError('');
            } catch {
              setError(t('This picture could not be read. Try a JPEG or PNG.'));
            }
          }}
        />
        {error && <p className="field-error">{error}</p>}
      </div>
      <label className="field">
        <span>{t('Name')}</span>
        <input id="profile-name" value={p.name} placeholder={t('Your name')} onChange={(e) => setP({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('Bio')}</span>
        <textarea id="profile-bio" rows={3} value={p.bio} placeholder={t('Describe yourself')} onChange={(e) => setP({ bio: e.target.value })} />
      </label>
      <p className="muted small">{t('Sex, age, height and activity used for your calorie targets are in Nutrition → Plan. Your profile is private for now; it will be what friends see once social features arrive.')}</p>
    </Sub>
  );
}

/* ---------- Account ---------- */

function AccountPage() {
  const c = useCloud();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status: Record<string, string> = {
    syncing: t('Syncing…'),
    synced: t('All changes saved to your account'),
    offline: t('Offline: changes are kept and sent when you are back online'),
    error: t('Sync problem'),
  };
  return (
    <Sub title={t('Account')}>
      <section className="panel">
        <p>{t('Signed in as')}{' '}<strong>{c.user?.email}</strong>
        </p>
        <p className={'sync-status ' + c.status}>
          <span className="sync-dot" aria-hidden="true" /> {status[c.status] ?? ''}
        </p>
        {c.error && <p className="field-error">{c.error}</p>}
        <button className="btn btn-small" onClick={() => c.syncNow()} disabled={c.status === 'syncing'}>{t('Sync now')}</button>
      </section>
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await c.changeEmail(email.trim());
          setMsg(err ? { text: err, error: true } : { text: t('Open the link sent to {email} to confirm the change.', { email: email.trim() }) });
          if (!err) setEmail('');
        }}
      >
        <h2 className="panel-title">{t('Change email')}</h2>
        <label className="field">
          <span>{t('New email')}</span>
          <input id="acc-new-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={!email.includes('@')}>{t('Change email')}</button>
      </form>
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await c.setNewPassword(password);
          setMsg(err ? { text: err, error: true } : { text: t('Password updated.') });
          if (!err) setPassword('');
        }}
      >
        <h2 className="panel-title">{t('Update password')}</h2>
        <label className="field">
          <span>{t('New password')}</span>
          <input id="acc-new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="muted small">{t('At least 8 characters.')}</span>
        </label>
        <button className="btn" type="submit" disabled={password.length < 8}>{t('Update password')}</button>
      </form>
      {msg && <p className={msg.error ? 'field-error' : 'ok-line'}>{msg.text}</p>}
      <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmDelete(true)}>{t('Delete account')}</button>
      <Confirm
        open={confirmDelete}
        title={t('Delete your account?')}
        message={t('Your account and all its data (workouts, routines, nutrition) are deleted for good, here and in the cloud.')}
        confirmLabel={t('Delete account')}
        danger
        onConfirm={async () => {
          const e = await c.deleteAccount();
          if (e) setMsg({ text: e, error: true });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </Sub>
  );
}

/* ---------- Preferences ---------- */

function WorkoutPrefs() {
  const { s, set } = useSetting();
  return (
    <Sub title={t('Workouts')}>
      <section className="panel">
        <label className="setting">
          <span>{t('Default rest timer')}</span>
          <select id="default-rest" value={s.defaultRest} onChange={(e) => set('defaultRest', Number(e.target.value))}>
            {[0, 30, 45, 60, 90, 120, 150, 180, 240].map((r) => (
              <option key={r} value={r}>
                {r ? fmtClock(r) : t('Off')}
              </option>
            ))}
          </select>
        </label>
        <label className="setting">
          <span>{t('Beep when rest is over')}</span>
          <input id="sound" type="checkbox" className="switch" checked={s.sound} onChange={(e) => set('sound', e.target.checked)} />
        </label>
        <label className="setting">
          <span>{t('Keep the screen on during a workout')}</span>
          <input
            id="keep-awake"
            type="checkbox"
            className="switch"
            checked={s.keepAwake ?? true}
            onChange={(e) => set('keepAwake', e.target.checked)}
          />
        </label>
        <label className="setting">
          <span>{t('First day of the week')}</span>
          <select id="week-start" value={s.weekStartsOn ?? 1} onChange={(e) => set('weekStartsOn', Number(e.target.value) as 0 | 1)}>
            <option value={1}>{t('Monday')}</option>
            <option value={0}>{t('Sunday')}</option>
          </select>
        </label>
      </section>
      <p className="muted small">{t('The first day of the week sets where weekly stats and streaks start.')}</p>
    </Sub>
  );
}

function UnitsPage() {
  const { s, set } = useSetting();
  return (
    <Sub title={t('Units')}>
      <section className="panel">
        <div className="setting">
          <span>{t('Weight')}</span>
          <Segmented<Unit>
            label={t('Weight unit')}
            value={s.unit}
            onChange={(v) => set('unit', v)}
            options={[
              { value: 'kg', label: t('kg') },
              { value: 'lb', label: t('lb') },
            ]}
          />
        </div>
        <div className="setting">
          <span>{t('Distance')}</span>
          <Segmented<'km' | 'mi'>
            label={t('Distance unit')}
            value={s.distanceUnit ?? 'km'}
            onChange={(v) => set('distanceUnit', v)}
            options={[
              { value: 'km', label: t('km') },
              { value: 'mi', label: t('miles') },
            ]}
          />
        </div>
        <div className="setting">
          <span>{t('Body measurements')}</span>
          <Segmented<'cm' | 'in'>
            label={t('Body measurement unit')}
            value={s.heightUnit ?? 'cm'}
            onChange={(v) => set('heightUnit', v)}
            options={[
              { value: 'cm', label: t('cm') },
              { value: 'in', label: t('ft / in') },
            ]}
          />
        </div>
      </section>
      <p className="muted small">{t('Values are stored in metric, so switching units never changes your data.')}</p>
    </Sub>
  );
}

function LanguagePage() {
  const { s, set } = useSetting();
  return (
    <Sub title={t('Language')}>
      <section className="panel">
        <div className="setting">
          <span>{t('App language')}</span>
          <Segmented<AppLang>
            label={t('App language')}
            value={s.appLang ?? detectLang()}
            onChange={(v) => set('appLang', v)}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        <div className="setting">
          <span>{t('Exercise names')}</span>
          <Segmented<NameLang>
            label={t('Exercise names')}
            value={s.exerciseLang}
            onChange={(v) => set('exerciseLang', v)}
            options={[
              { value: 'fr', label: t('Français') },
              { value: 'en', label: t('English') },
            ]}
          />
        </div>
      </section>
      <p className="muted small">{t('Exercise names can stay in another language than the app.')}</p>
    </Sub>
  );
}

function ThemePage() {
  const { s, set } = useSetting();
  const options: { value: NonNullable<Settings['theme']>; label: string; text: string }[] = [
    { value: 'system', label: t('System'), text: t('Follows your phone: light by day, dark at night if you set it so.') },
    { value: 'light', label: t('Light'), text: t('Always light.') },
    { value: 'dark', label: t('Dark'), text: t('Always dark. Easier on the eyes in a dim gym.') },
  ];
  const accent = (s.accent ?? DEFAULT_ACCENT).toLowerCase();
  const isPreset = ACCENTS.some((a) => a.hex === accent);
  return (
    <Sub title={t('Theme')}>
      <h2 className="settings-group">{t('Mode')}</h2>
      <ul className="settings-list">
        {options.map((o) => (
          <li key={o.value}>
            <button className="settings-row" aria-pressed={(s.theme ?? 'system') === o.value} onClick={() => set('theme', o.value)}>
              <span className="settings-label">
                {o.label}
                <span className="muted small">{o.text}</span>
              </span>
              {(s.theme ?? t('system')) === o.value && <Icon name="check" />}
            </button>
          </li>
        ))}
      </ul>

      <h2 className="settings-group">{t('Accent colour')}</h2>
      <div className="swatches">
        {ACCENTS.map((a) => (
          <button key={a.hex} className="swatch" aria-pressed={accent === a.hex} onClick={() => (a.hex === DEFAULT_ACCENT || requirePro('customTheme')) && set('accent', a.hex === DEFAULT_ACCENT ? undefined : a.hex)}>
            <span className="swatch-dot" style={{ background: a.hex }}>
              {accent === a.hex && <Icon name="check" size={18} />}
            </span>
            {t(a.name)}
          </button>
        ))}
        <label className="swatch" data-on={!isPreset}>
          <span className="swatch-dot swatch-custom" style={!isPreset ? { background: accent } : undefined}>
            {!isPreset && <Icon name="check" size={18} />}
          </span>{t('Custom')}<input type="color" value={accent} aria-label={t('Custom colour')} onChange={(e) => requirePro('customTheme') && set('accent', e.target.value)} />
        </label>
      </div>
      <div className="theme-preview">
        <Avatar size={40} />
        <span className="small">{t('Preview')}<br />
          <span className="muted">{t('Colours adjust a little in light and dark mode to stay readable.')}</span>
        </span>
        <span className="btn btn-primary">{t('Start')}</span>
      </div>

      <h2 className="settings-group">{t('Background')}</h2>
      <section className="panel">
        <label className="setting">
          <span>{t('Pure black')}<br />
            <span className="muted small">{t('Dark mode only. Saves battery on OLED screens.')}</span>
          </span>
          <input type="checkbox" className="switch" checked={!!s.pureBlack} onChange={(e) => (!e.target.checked || requirePro('customTheme')) && set('pureBlack', e.target.checked)} />
        </label>
      </section>
      {(s.accent || s.pureBlack) && (
        <button
          className="btn btn-wide"
          onClick={() => {
            set('accent', undefined);
            set('pureBlack', undefined);
          }}
        >{t('Reset to Foundry colours')}</button>
      )}
    </Sub>
  );
}

/* ---------- Help ---------- */

function GuidePage() {
  const steps: [string, string][] = [
    [t('Set up your routines'), t('Workout tab → New routine, or Explore programs for a ready-made plan. Group routines in folders, pair exercises as supersets from their ⋯ menu, and set target reps like 8-12.')],
    [t('Train'), t('Start a routine and tick each set as you go. The rest timer starts by itself. Empty sets reuse last time’s numbers when you tick them. Change a set’s type (warm-up, drop, failure) by tapping its number.')],
    [t('Finish'), t('Tap Finish at any time: sets you filled in are saved, empty ones are dropped. Records are marked with a trophy.')],
    [t('Eat to your goal'), t('Nutrition tab → set up your plan, weigh in most mornings and log your meals. Save meals you eat often and star your favourite foods.')],
    [t('Weekly check-in'), t('Once a week Foundry compares what you ate with how your weight moved, and adjusts your calorie and macro targets.')],
    [t('Track progress'), t('Progress tab: strength trends per lift, weekly volume per muscle, records, and how your diet lines up with your strength.')],
  ];
  return (
    <Sub title={t('Getting started')}>
      <ol className="guide">
        {steps.map(([t, d]) => (
          <li key={t}>
            <strong>{t}</strong>
            <span className="muted">{d}</span>
          </li>
        ))}
      </ol>
    </Sub>
  );
}

function FaqPage() {
  const qa: [string, string][] = [
    [t('Where is my data stored?'), t('In your Foundry account, and on your phone for offline use. Each person can only read their own data.')],
    [t('Can I use Foundry on several devices?'), t('Yes: log in with the same account and your data follows. If two devices changed things at the same time, Foundry asks which version to keep.')],
    [t('Does it work without internet?'), t('Yes. Log workouts and meals offline; changes are sent to your account when you are back online. Brand search and barcode lookup need a connection.')],
    [t('How is my expenditure estimated?'), t('It starts from your age, height, weight, sex and activity, then learns from your data: what you ate over the last 3 weeks against how your weight moved (about 7 700 kcal per kg). Days you mark as not fully logged are left out.')],
    [t('Why didn’t the rest timer ring with the app closed?'), t('Phones pause web apps in the background. When you come back, Foundry shows when the rest ended. On iPhone, Guided Access keeps you in the app during a workout.')],
    [t('How do I bring my Hevy history?'), t('In Hevy: Settings → Export & Import Data → Export workouts. Then in Foundry: Settings → Export & import data → Import CSV.')],
    [t('How do I share a routine?'), t('Open the routine → Copy link, or a folder’s ⋯ menu → Copy share link. Whoever opens it can add the routines to their Foundry.')],
  ];
  return (
    <Sub title={t('FAQ')}>
      <div className="faq">
        {qa.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p className="muted">{a}</p>
          </details>
        ))}
      </div>
    </Sub>
  );
}

function AboutPage() {
  const [free, setFree] = useState(previewingFree());
  return (
    <Sub title={t('About')}>
      <div className="about-head">
        <Logo size={56} />
        <strong className="brand">{t('Foundry')}</strong>
        <span className="muted small">{t('Version {0}', { 0: `${__APP_VERSION__} · ${new Date(parseInt(__BUILD_ID__.split('-').pop() ?? '0', 36)).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}` })}</span>
      </div>
      <section className="panel">
        <h2 className="panel-title">{t('Credits')}</h2>
        <ul className="credits">
          <li>{t('Exercise photos: Free Exercise DB (public domain).')}</li>
          <li>{t('Basic foods: USDA FoodData Central (public domain), via the TempoLife food dataset (tempolife.app, CC-BY-4.0).')}</li>
          <li>{t('Brands and barcodes: Open Food Facts, © its contributors (Open Database License).')}</li>
          <li>{t('Typefaces: Archivo and IBM Plex Sans (SIL Open Font License).')}</li>
        </ul>
      </section>
      <section className="panel">
        <h2 className="panel-title">{t('Foundry Pro')}</h2>
        <label className="toggle-line">
          <span>
            <strong>{t('Preview the free version')}</strong>
            <span className="muted small">{t('Everything is unlocked during the beta. Switch this on to see the limits of a free account (on this device only).')}</span>
          </span>
          <input id="preview-free" type="checkbox" className="switch" checked={free} onChange={(e) => { setPreviewFree(e.target.checked); setFree(e.target.checked); }} />
        </label>
      </section>
      <p className="muted small">{t('Foundry is an estimate tool for healthy adults, not medical advice.')}</p>
    </Sub>
  );
}

type FeedbackKind = 'idea' | 'bug' | 'question' | 'other';

/** Send an idea, a bug or a question from inside the app; the account email is attached for replies. */
function ContactPage() {
  const c = useCloud();
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const labels: Record<FeedbackKind, string> = { idea: t('Idea'), bug: t('Bug'), question: t('Question'), other: t('Other') };
  const email = c.user?.email ?? '';
  const send = async () => {
    setState('sending');
    try {
      await sendFeedback(kind, text.trim(), email);
      setState('sent');
      setText('');
    } catch (e) {
      setErr((e as Error).message);
      setState('error');
    }
  };
  const shareApp = async () => {
    const url = location.origin + location.pathname;
    const msg = t('I train and track my nutrition with Foundry. Try it:');
    try {
      if (navigator.share) return await navigator.share({ title: 'Foundry', text: msg, url });
    } catch {
      return;
    }
    await navigator.clipboard?.writeText(`${msg} ${url}`).catch(() => {});
    setCopied(t('Link copied.'));
  };
  return (
    <Sub title={t('Contact us')}>
      <p className="muted">{t('An idea, a bug, a question? Every message is read.')}</p>
      <section className="panel form">
        <span>{t('Subject')}</span>
        <Segmented<FeedbackKind> label={t('Subject')} value={kind} onChange={setKind} options={(Object.keys(labels) as FeedbackKind[]).map((k) => ({ value: k, label: labels[k] }))} />
        <label className="field">
          <span>{t('Your message')}</span>
          <textarea id="feedback" rows={6} value={text} placeholder={kind === 'bug' ? t('What happened, on which screen, and what you expected.') : t('Tell us what you think.')} onChange={(e) => setText(e.target.value)} />
        </label>
        <button className="btn btn-primary btn-wide" disabled={!text.trim() || state === 'sending' || !c.user} onClick={send}>
          {state === 'sending' ? t('Sending…') : t('Send')}
        </button>
        {state === 'sent' && <p className="ok-line small">{t('Thanks! Your message was sent. We reply to {email}.', { email })}</p>}
        {state === 'error' && <p className="field-error small">{t('The message could not be sent: {e}', { e: err })}</p>}
        <p className="muted small">{t('Your account email, the app version and your phone model are added so we can reply and fix bugs.')}</p>
      </section>
      <section className="panel">
        <h2 className="panel-title">{t('Recommend Foundry')}</h2>
        <p className="muted small">{t('Know someone who would like it? Send them the app.')}</p>
        <button className="btn btn-wide" onClick={shareApp}>
          <Icon name="share" size={18} /> {t('Share the app')}
        </button>
        {copied && <p className="ok-line small">{copied}</p>}
      </section>
    </Sub>
  );
}
