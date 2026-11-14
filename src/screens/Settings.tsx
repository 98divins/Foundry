import { useRef, useState } from 'react';
import { useCloud } from '../cloud/cloud';
import { Confirm, Header, Icon, Logo, Segmented, type IconName } from '../components/ui';
import { back, go } from '../hooks';
import { useStore } from '../store';
import type { NameLang, Settings, Unit } from '../types';
import { fmtClock } from '../utils';
import { DataPage } from './Profile';

type Page = 'profile' | 'account' | 'workouts' | 'units' | 'language' | 'theme' | 'data' | 'guide' | 'faq' | 'about';

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
      <Header title="Settings" onBack={() => back('profile')} />
      <main className="page settings-page">
        <h2 className="settings-group">Account</h2>
        <ul className="settings-list">
          <Row icon="user" label="Profile" value={state.profile?.name || undefined} onClick={() => open('profile')} />
          <Row icon="lock" label="Account" value={c.user?.email ?? undefined} onClick={() => open('account')} />
        </ul>
        <h2 className="settings-group">Preferences</h2>
        <ul className="settings-list">
          <Row icon="dumbbell" label="Workouts" onClick={() => open('workouts')} />
          <Row icon="ruler" label="Units" value={`${s.unit} · ${s.distanceUnit ?? 'km'} · ${s.heightUnit ?? 'cm'}`} onClick={() => open('units')} />
          <Row icon="globe" label="Language" value={s.exerciseLang === 'fr' ? 'Français' : 'English'} onClick={() => open('language')} />
          <Row icon="moon" label="Theme" value={{ system: 'System', light: 'Light', dark: 'Dark' }[s.theme ?? 'system']} onClick={() => open('theme')} />
        </ul>
        <h2 className="settings-group">Data</h2>
        <ul className="settings-list">
          <Row icon="download" label="Export & import data" onClick={() => open('data')} />
        </ul>
        <h2 className="settings-group">Help</h2>
        <ul className="settings-list">
          <Row icon="info" label="Getting started guide" onClick={() => open('guide')} />
          <Row icon="help" label="Frequently asked questions" onClick={() => open('faq')} />
          <Row icon="logo" label="About Foundry" onClick={() => open('about')} />
        </ul>
        {c.user && (
          <button
            className="btn btn-ghost-danger btn-wide settings-logout"
            onClick={async () => {
              const e = await c.signOut();
              if (e) setMsg(e);
            }}
          >
            Log out
          </button>
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
    case 'about':
      return <AboutPage />;
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

export function Avatar({ size = 64 }: { size?: number }) {
  const { state } = useStore();
  const p = state.profile;
  const initials = (p?.name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return p?.avatar ? (
    <img className="avatar" src={p.avatar} alt="" width={size} height={size} />
  ) : (
    <span className="avatar avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  );
}

function ProfilePage() {
  const { state, update } = useStore();
  const p = state.profile ?? { name: '', bio: '' };
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const setP = (patch: Partial<typeof p>) => update((s) => ({ ...s, profile: { ...p, ...s.profile, ...patch } }));
  return (
    <Sub title="Profile">
      <div className="profile-photo">
        <Avatar size={112} />
        <div className="profile-photo-actions">
          <button className="link-btn" onClick={() => file.current?.click()}>
            {p.avatar ? 'Change picture' : 'Add a picture'}
          </button>
          {p.avatar && (
            <button className="link-btn muted" onClick={() => setP({ avatar: null })}>
              Remove
            </button>
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
              setError('This picture could not be read. Try a JPEG or PNG.');
            }
          }}
        />
        {error && <p className="field-error">{error}</p>}
      </div>
      <label className="field">
        <span>Name</span>
        <input id="profile-name" value={p.name} placeholder="Your name" onChange={(e) => setP({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>Bio</span>
        <textarea id="profile-bio" rows={3} value={p.bio} placeholder="Describe yourself" onChange={(e) => setP({ bio: e.target.value })} />
      </label>
      <p className="muted small">
        Sex, age, height and activity used for your calorie targets are in Nutrition → Plan. Your profile is private for now;
        it will be what friends see once social features arrive.
      </p>
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
    syncing: 'Syncing…',
    synced: 'All changes saved to your account',
    offline: 'Offline: changes are kept and sent when you are back online',
    error: 'Sync problem',
    conflict: 'Waiting for you to choose which version to keep',
  };
  return (
    <Sub title="Account">
      <section className="panel">
        <p>
          Signed in as <strong>{c.user?.email}</strong>
        </p>
        <p className={'sync-status ' + c.status}>
          <span className="sync-dot" aria-hidden="true" /> {status[c.status] ?? ''}
        </p>
        {c.error && <p className="field-error">{c.error}</p>}
        <button className="btn btn-small" onClick={() => c.syncNow()} disabled={c.status === 'syncing'}>
          Sync now
        </button>
      </section>
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await c.changeEmail(email.trim());
          setMsg(err ? { text: err, error: true } : { text: `Open the link sent to ${email.trim()} to confirm the change.` });
          if (!err) setEmail('');
        }}
      >
        <h2 className="panel-title">Change email</h2>
        <label className="field">
          <span>New email</span>
          <input id="acc-new-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={!email.includes('@')}>
          Change email
        </button>
      </form>
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await c.setNewPassword(password);
          setMsg(err ? { text: err, error: true } : { text: 'Password updated.' });
          if (!err) setPassword('');
        }}
      >
        <h2 className="panel-title">Update password</h2>
        <label className="field">
          <span>New password</span>
          <input id="acc-new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="muted small">At least 8 characters.</span>
        </label>
        <button className="btn" type="submit" disabled={password.length < 8}>
          Update password
        </button>
      </form>
      {msg && <p className={msg.error ? 'field-error' : 'ok-line'}>{msg.text}</p>}
      <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmDelete(true)}>
        Delete account
      </button>
      <Confirm
        open={confirmDelete}
        title="Delete your account?"
        message="Your account and all its data (workouts, routines, nutrition) are deleted for good, here and in the cloud."
        confirmLabel="Delete account"
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
    <Sub title="Workouts">
      <section className="panel">
        <label className="setting">
          <span>Default rest timer</span>
          <select id="default-rest" value={s.defaultRest} onChange={(e) => set('defaultRest', Number(e.target.value))}>
            {[0, 30, 45, 60, 90, 120, 150, 180, 240].map((r) => (
              <option key={r} value={r}>
                {r ? fmtClock(r) : 'Off'}
              </option>
            ))}
          </select>
        </label>
        <label className="setting">
          <span>Beep when rest is over</span>
          <input id="sound" type="checkbox" className="switch" checked={s.sound} onChange={(e) => set('sound', e.target.checked)} />
        </label>
        <label className="setting">
          <span>Keep the screen on during a workout</span>
          <input
            id="keep-awake"
            type="checkbox"
            className="switch"
            checked={s.keepAwake ?? true}
            onChange={(e) => set('keepAwake', e.target.checked)}
          />
        </label>
        <label className="setting">
          <span>First day of the week</span>
          <select id="week-start" value={s.weekStartsOn ?? 1} onChange={(e) => set('weekStartsOn', Number(e.target.value) as 0 | 1)}>
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </label>
      </section>
      <p className="muted small">The first day of the week sets where weekly stats and streaks start.</p>
    </Sub>
  );
}

function UnitsPage() {
  const { s, set } = useSetting();
  return (
    <Sub title="Units">
      <section className="panel">
        <div className="setting">
          <span>Weight</span>
          <Segmented<Unit>
            label="Weight unit"
            value={s.unit}
            onChange={(v) => set('unit', v)}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </div>
        <div className="setting">
          <span>Distance</span>
          <Segmented<'km' | 'mi'>
            label="Distance unit"
            value={s.distanceUnit ?? 'km'}
            onChange={(v) => set('distanceUnit', v)}
            options={[
              { value: 'km', label: 'km' },
              { value: 'mi', label: 'miles' },
            ]}
          />
        </div>
        <div className="setting">
          <span>Body measurements</span>
          <Segmented<'cm' | 'in'>
            label="Body measurement unit"
            value={s.heightUnit ?? 'cm'}
            onChange={(v) => set('heightUnit', v)}
            options={[
              { value: 'cm', label: 'cm' },
              { value: 'in', label: 'ft / in' },
            ]}
          />
        </div>
      </section>
      <p className="muted small">Values are stored in metric, so switching units never changes your data.</p>
    </Sub>
  );
}

function LanguagePage() {
  const { s, set } = useSetting();
  return (
    <Sub title="Language">
      <section className="panel">
        <div className="setting">
          <span>Exercise names</span>
          <Segmented<NameLang>
            label="Exercise names"
            value={s.exerciseLang}
            onChange={(v) => set('exerciseLang', v)}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
      </section>
      <p className="muted small">The rest of the app is in English for now. A full French version is planned.</p>
    </Sub>
  );
}

function ThemePage() {
  const { s, set } = useSetting();
  const options: { value: NonNullable<Settings['theme']>; label: string; text: string }[] = [
    { value: 'system', label: 'System', text: 'Follows your phone: light by day, dark at night if you set it so.' },
    { value: 'light', label: 'Light', text: 'Always light.' },
    { value: 'dark', label: 'Dark', text: 'Always dark. Easier on the eyes in a dim gym.' },
  ];
  return (
    <Sub title="Theme">
      <ul className="settings-list">
        {options.map((o) => (
          <li key={o.value}>
            <button className="settings-row" aria-pressed={(s.theme ?? 'system') === o.value} onClick={() => set('theme', o.value)}>
              <span className="settings-label">
                {o.label}
                <span className="muted small">{o.text}</span>
              </span>
              {(s.theme ?? 'system') === o.value && <Icon name="check" />}
            </button>
          </li>
        ))}
      </ul>
    </Sub>
  );
}

/* ---------- Help ---------- */

function GuidePage() {
  const steps: [string, string][] = [
    ['Set up your routines', 'Workout tab → New routine, or Explore programs for a ready-made plan. Group routines in folders, pair exercises as supersets from their ⋯ menu, and set target reps like 8-12.'],
    ['Train', 'Start a routine and tick each set as you go. The rest timer starts by itself. Empty sets reuse last time’s numbers when you tick them. Change a set’s type (warm-up, drop, failure) by tapping its number.'],
    ['Finish', 'Tap Finish at any time: sets you filled in are saved, empty ones are dropped. Records are marked with a trophy.'],
    ['Eat to your goal', 'Nutrition tab → set up your plan, weigh in most mornings and log your meals. Save meals you eat often and star your favourite foods.'],
    ['Weekly check-in', 'Once a week Foundry compares what you ate with how your weight moved, and adjusts your calorie and macro targets.'],
    ['Track progress', 'Progress tab: strength trends per lift, weekly volume per muscle, records, and how your diet lines up with your strength.'],
  ];
  return (
    <Sub title="Getting started">
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
    ['Where is my data stored?', 'In your Foundry account, and on your phone for offline use. Each person can only read their own data.'],
    ['Can I use Foundry on several devices?', 'Yes: log in with the same account and your data follows. If two devices changed things at the same time, Foundry asks which version to keep.'],
    ['Does it work without internet?', 'Yes. Log workouts and meals offline; changes are sent to your account when you are back online. Brand search and barcode lookup need a connection.'],
    ['How is my expenditure estimated?', 'It starts from your age, height, weight, sex and activity, then learns from your data: what you ate over the last 3 weeks against how your weight moved (about 7 700 kcal per kg). Days you mark as not fully logged are left out.'],
    ['Why didn’t the rest timer ring with the app closed?', 'Phones pause web apps in the background. When you come back, Foundry shows when the rest ended. On iPhone, Guided Access keeps you in the app during a workout.'],
    ['How do I bring my Hevy history?', 'In Hevy: Settings → Export & Import Data → Export workouts. Then in Foundry: Settings → Export & import data → Import CSV.'],
    ['How do I share a routine?', 'Open the routine → Copy link, or a folder’s ⋯ menu → Copy share link. Whoever opens it can add the routines to their Foundry.'],
  ];
  return (
    <Sub title="FAQ">
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
  return (
    <Sub title="About">
      <div className="about-head">
        <Logo size={56} />
        <strong className="brand">Foundry</strong>
        <span className="muted small">Version {__APP_VERSION__}</span>
      </div>
      <section className="panel">
        <h2 className="panel-title">Credits</h2>
        <ul className="credits">
          <li>Exercise photos: Free Exercise DB (public domain).</li>
          <li>Basic foods: USDA FoodData Central (public domain), via the TempoLife food dataset (tempolife.app, CC-BY-4.0).</li>
          <li>Brands and barcodes: Open Food Facts, © its contributors (Open Database License).</li>
          <li>Typefaces: Archivo and IBM Plex Sans (SIL Open Font License).</li>
        </ul>
      </section>
      <p className="muted small">Foundry is an estimate tool for healthy adults, not medical advice.</p>
    </Sub>
  );
}
