import { useEffect, useState } from 'react';
import { useCloud } from '../cloud/cloud';
import { go } from '../hooks';
import { useStore } from '../store';
import type { NameLang, Unit } from '../types';
import { Icon, Logo, Segmented, type IconName } from './ui';
import { ConsentCheckbox } from './Legal';
import { LEGAL_VERSION } from '../legal';
import { t, tk, detectLang, type AppLang } from '../i18n';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'dumbbell', title: tk('Log every set'), text: tk('450 exercises, routines, supersets and a rest timer built for the gym floor.') },
  { icon: 'apple', title: tk('Eat to your goal'), text: tk('Food log with barcode scan, and targets that adapt to how your body really responds.') },
  { icon: 'chart', title: tk('See what works'), text: tk('Strength trends, records, and how your diet moves your lifts.') },
];

/** Shown to anyone not signed in: accounts are required. */
export function Welcome() {
  const [screen, setScreen] = useState<'welcome' | 'signup' | 'login' | 'reset' | 'check'>('welcome');
  const [email, setEmail] = useState('');

  if (screen === 'welcome') {
    return (
      <main className="welcome">
        <div className="welcome-hero">
          <Logo size={72} />
          <h1 className="welcome-word">{t('Foundry')}</h1>
          <p className="welcome-tag">{t('Training and nutrition, forged in one place.')}</p>
        </div>
        <ul className="welcome-features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="welcome-icon">
                <Icon name={f.icon} />
              </span>
              <span>
                <strong>{t(f.title)}</strong>
                <span className="muted small">{t(f.text)}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="welcome-actions">
          <button className="btn btn-primary btn-wide welcome-cta" onClick={() => setScreen('signup')}>{t('Create my account')}</button>
          <button className="btn btn-ghost btn-wide" onClick={() => setScreen('login')}>{t('I already have an account')}</button>
        </div>
      </main>
    );
  }

  if (screen === 'check') return <CheckEmail email={email} onBack={() => setScreen('login')} />;

  return (
    <main className="welcome auth">
      <button className="icon-btn auth-back" aria-label={t('Back')} onClick={() => setScreen(screen === 'reset' ? 'login' : 'welcome')}>
        <Icon name="back" />
      </button>
      <div className="auth-head">
        <Logo size={44} />
        <h1>{screen === 'signup' ? t('Create your account') : screen === 'login' ? t('Welcome back') : t('Reset your password')}</h1>
      </div>
      <AuthForm
        mode={screen}
        email={email}
        onEmail={setEmail}
        onMode={setScreen}
        onCheckEmail={() => setScreen('check')}
      />
    </main>
  );
}

function AuthForm({
  mode,
  email,
  onEmail,
  onMode,
  onCheckEmail,
}: {
  mode: 'signup' | 'login' | 'reset';
  email: string;
  onEmail: (e: string) => void;
  onMode: (m: 'signup' | 'login' | 'reset') => void;
  onCheckEmail: () => void;
}) {
  const c = useCloud();
  const { update } = useStore();
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const valid = email.includes('@') && (mode === 'reset' || password.length >= 8) && (mode !== 'signup' || consent);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const e = email.trim();
    // Consent is recorded with the data, so it reaches the account with the first upload.
    if (mode === 'signup') update((s) => ({ ...s, settings: { ...s.settings, consent: { at: Date.now(), version: LEGAL_VERSION } } }));
    const r = mode === 'login' ? await c.signIn(e, password) : mode === 'signup' ? await c.signUp(e, password) : await c.resetPassword(e);
    setBusy(false);
    if (r === 'CHECK_EMAIL') onCheckEmail();
    else if (r) setMsg({ text: r, error: true });
    else if (mode === 'reset') setMsg({ text: t('If an account exists for {email}, a reset link is on its way. Open it on this phone.', { email: e }) });
  };

  return (
    <form
      className="form auth-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (valid) submit();
      }}
    >
      <label className="field">
        <span>{t('Email')}</span>
        <input id="auth-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(ev) => onEmail(ev.target.value)} />
      </label>
      {mode !== 'reset' && (
        <label className="field">
          <span>{t('Password')}</span>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
          {mode === 'signup' && <span className="muted small">{t('At least 8 characters.')}</span>}
        </label>
      )}
      {mode === 'signup' && <ConsentCheckbox checked={consent} onChange={setConsent} />}
      {msg && <p className={msg.error ? 'field-error' : 'ok-line'}>{msg.text}</p>}
      <button className="btn btn-primary btn-wide" type="submit" disabled={busy || !valid}>
        {busy ? t('Please wait…') : mode === 'signup' ? t('Create account') : mode === 'login' ? t('Log in') : t('Send reset link')}
      </button>
      <div className="account-links">
        {mode === 'signup' && (
          <button type="button" className="link-btn" onClick={() => onMode('login')}>{t('I already have an account')}</button>
        )}
        {mode === 'login' && (
          <>
            <button type="button" className="link-btn" onClick={() => onMode('reset')}>{t('Forgot password?')}</button>
            <button type="button" className="link-btn" onClick={() => onMode('signup')}>{t('Create an account')}</button>
          </>
        )}
      </div>
    </form>
  );
}

function CheckEmail({ email, onBack }: { email: string; onBack: () => void }) {
  const c = useCloud();
  const [wait, setWait] = useState(60);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  return (
    <main className="welcome auth">
      <div className="auth-head">
        <span className="welcome-icon big">
          <Icon name="note" size={30} />
        </span>
        <h1>{t('Check your inbox')}</h1>
      </div>
      <p className="center">{t('We sent a confirmation link to {email}. Open it on this phone to activate your account.', { email })}</p>
      <ol className="how">
        <li>{t('Open the email from Foundry (check spam if it is not there within a few minutes).')}</li>
        <li>{t('Tap the confirmation link.')}</li>
        <li>{t('Come back here and log in.')}</li>
      </ol>
      {msg && <p className={msg.error ? 'field-error' : 'ok-line'}>{msg.text}</p>}
      <button className="btn btn-primary btn-wide" onClick={onBack}>{t('I confirmed, log in')}</button>
      <button
        className="btn btn-ghost btn-wide"
        disabled={wait > 0}
        onClick={async () => {
          const e = await c.resendConfirmation(email);
          setMsg(e ? { text: e, error: true } : { text: t('Sent again. It can take a few minutes.') });
          setWait(60);
        }}
      >
        {wait > 0 ? t('Resend the email ({n} s)', { n: wait }) : t('Resend the email')}
      </button>
    </main>
  );
}

/** First steps for a new, empty account: preferences, then where to start. */
export function QuickStart() {
  const { state, update } = useStore();
  const [step, setStep] = useState<1 | 2>(1);
  const done = (route: string) => {
    update((s) => ({ ...s, settings: { ...s.settings, onboarded: true }, goals: s.goals ?? { trainingDays: 3, dietDays: null, setAt: Date.now() } }));
    go(route, { replace: true });
  };

  if (step === 1) {
    return (
      <main className="welcome auth">
        <div className="auth-head">
          <span className="eyebrow">{t('Step 1 of 2')}</span>
          <h1>{t('Your preferences')}</h1>
        </div>
        <div className="panel">
          <div className="setting setting-stack">
            <span>{t('Training days per week you aim for')}</span>
            <Segmented<string>
              label={t('Training days per week you aim for')}
              value={String(state.goals?.trainingDays ?? 3)}
              onChange={(v) => update((s) => ({ ...s, goals: { trainingDays: Number(v), dietDays: s.goals?.dietDays ?? null, setAt: s.goals?.setAt ?? Date.now() } }))}
              options={[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
            />
            <span className="muted small">{t('Your weekly goal. You can add a diet goal later in Progress.')}</span>
          </div>
        </div>
        <div className="panel">
          <div className="setting">
            <span>{t('Weight unit')}</span>
            <Segmented<Unit>
              label={t('Weight unit')}
              value={state.settings.unit}
              onChange={(unit) => update((s) => ({ ...s, settings: { ...s.settings, unit } }))}
              options={[
                { value: 'kg', label: t('kg') },
                { value: 'lb', label: t('lb') },
              ]}
            />
          </div>
          <div className="setting">
            <span>{t('Height')}</span>
            <Segmented<'cm' | 'in'>
              label={t('Height unit')}
              value={state.settings.heightUnit ?? 'cm'}
              onChange={(heightUnit) => update((s) => ({ ...s, settings: { ...s.settings, heightUnit } }))}
              options={[
                { value: 'cm', label: t('cm') },
                { value: 'in', label: t('ft / in') },
              ]}
            />
          </div>
          <div className="setting">
            <span>{t('App language')}</span>
            <Segmented<AppLang>
              label={t('App language')}
              value={state.settings.appLang ?? detectLang()}
              onChange={(appLang) => update((s) => ({ ...s, settings: { ...s.settings, appLang } }))}
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
              value={state.settings.exerciseLang}
              onChange={(exerciseLang) => update((s) => ({ ...s, settings: { ...s.settings, exerciseLang } }))}
              options={[
                { value: 'fr', label: t('Français') },
                { value: 'en', label: t('English') },
              ]}
            />
          </div>
        </div>
        <button className="btn btn-primary btn-wide" onClick={() => setStep(2)}>{t('Continue')}</button>
      </main>
    );
  }

  const choices: { icon: IconName; title: string; text: string; route: string }[] = [
    { icon: 'search', title: t('Pick a program'), text: t('Full Body, Upper / Lower or Push / Pull / Legs, ready to start.'), route: 'explore' },
    { icon: 'plus', title: t('Build my own routine'), text: t('Choose your exercises, sets and rep ranges.'), route: 'r/new' },
    { icon: 'apple', title: t('Set up my nutrition'), text: t('Your calorie and macro targets, adjusted every week.'), route: 'n/setup' },
  ];
  return (
    <main className="welcome auth">
      <div className="auth-head">
        <span className="eyebrow">{t('Step 2 of 2')}</span>
        <h1>{t('Where do you start?')}</h1>
      </div>
      <ul className="start-choices">
        {choices.map((c) => (
          <li key={c.route}>
            <button className="start-choice" onClick={() => done(c.route)}>
              <span className="welcome-icon">
                <Icon name={c.icon} />
              </span>
              <span>
                <strong>{c.title}</strong>
                <span className="muted small">{c.text}</span>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost btn-wide" onClick={() => done('')}>{t('Skip, take me to the app')}</button>
    </main>
  );
}

/** Brief screen while the saved session is read. */
export function Splash() {
  return (
    <main className="splash" aria-label={t('Loading')}>
      <Logo size={64} />
    </main>
  );
}
