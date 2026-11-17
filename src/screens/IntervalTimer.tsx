import { useEffect, useMemo, useRef, useState } from 'react';
import { Header, Icon, Sheet } from '../components/ui';
import { back, go } from '../hooks';
import { t } from '../i18n';
import { DEFAULT_PLAN, fmtSec, PHASE_LABEL, phasesOf, PRESETS, totalSeconds, type IntervalPlan, type Phase } from '../intervals';
import { canAdd } from '../pro';
import { useStore } from '../store';
import type { Routine, Workout } from '../types';
import { uid } from '../utils';

/* ---------- Editor ---------- */

function Stepper({ id, label, value, onChange, kind }: { id: string; label: string; value: number; onChange: (v: number) => void; kind: 'time' | 'count' }) {
  const step = kind === 'count' ? 1 : value < 60 ? 5 : 15;
  const min = kind === 'count' ? 1 : 0;
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <span className="stepper-ctl">
        <button type="button" className="icon-btn" aria-label={t('Less: {name}', { name: label })} onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <output id={id} className="stepper-val">{kind === 'time' ? (value ? fmtSec(value) : t('Off')) : value}</output>
        <button type="button" className="icon-btn" aria-label={t('More: {name}', { name: label })} onClick={() => onChange(Math.min(kind === 'count' ? 99 : 3600, value + step))}>+</button>
      </span>
    </div>
  );
}

/** Create or edit an interval routine. `id` "new" creates one (in `folderId` when given). */
export function IntervalEditor({ id, folderId }: { id: string; folderId?: string }) {
  const { state, update } = useStore();
  const existing = state.routines.find((r) => r.id === id);
  const [name, setName] = useState(existing?.name ?? t('Interval workout'));
  const [plan, setPlan] = useState<IntervalPlan>(existing?.interval ?? DEFAULT_PLAN);
  const [moves, setMoves] = useState((existing?.interval?.moves ?? []).join('\n'));
  const set = (k: keyof IntervalPlan) => (v: number) => setPlan({ ...plan, [k]: v });
  const full = { ...plan, moves: moves.split('\n').map((m) => m.trim()).filter(Boolean).slice(0, 30) };

  const save = (): string | null => {
    if (!existing && !canAdd('routines', state.routines.length)) return null;
    const rid = existing?.id ?? uid();
    const r: Routine = { id: rid, name: name.trim() || t('Interval workout'), exercises: [], interval: full, updatedAt: Date.now(), folderId: existing?.folderId ?? folderId };
    update((s) => ({ ...s, routines: existing ? s.routines.map((x) => (x.id === rid ? r : x)) : [...s.routines, r] }));
    return rid;
  };

  return (
    <>
      <Header
        title={existing ? t('Edit intervals') : t('New interval workout')}
        onBack={() => back('')}
        right={<button className="btn btn-primary btn-small" onClick={() => save() && back('')}>{t('Save')}</button>}
      />
      <main className="page form">
        <label className="field">
          <span>{t('Name')}</span>
          <input id="interval-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        {!existing && (
          <div className="chips wrap">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="chip" onClick={() => { setPlan({ ...p.plan, moves: full.moves }); if (!existing) setName(t(p.name)); }}>
                {t(p.name)}
              </button>
            ))}
          </div>
        )}
        <section className="panel stepper-list">
          <Stepper id="iv-prepare" label={t('Get ready')} value={plan.prepare} onChange={set('prepare')} kind="time" />
          <Stepper id="iv-work" label={t('Work')} value={plan.work} onChange={(v) => set('work')(Math.max(5, v))} kind="time" />
          <Stepper id="iv-rest" label={t('Rest')} value={plan.rest} onChange={set('rest')} kind="time" />
          <Stepper id="iv-rounds" label={t('Rounds')} value={plan.rounds} onChange={set('rounds')} kind="count" />
          <Stepper id="iv-cycles" label={t('Cycles')} value={plan.cycles} onChange={set('cycles')} kind="count" />
          {plan.cycles > 1 && <Stepper id="iv-cyclerest" label={t('Rest between cycles')} value={plan.cycleRest} onChange={set('cycleRest')} kind="time" />}
          <Stepper id="iv-cooldown" label={t('Cool-down')} value={plan.cooldown} onChange={set('cooldown')} kind="time" />
        </section>
        <label className="field">
          <span>{t('Exercises (optional, one per line)')}</span>
          <textarea id="interval-moves" rows={4} value={moves} placeholder={t('Burpees\nJump squats\nMountain climbers')} onChange={(e) => setMoves(e.target.value)} />
          <span className="muted small">{t('Shown during work rounds, in turn.')}</span>
        </label>
        <p className="interval-total">
          <strong>{t('Total: {t}', { t: fmtSec(totalSeconds(full)) })}</strong>{' '}
          <span className="muted">· {t('{n} work rounds', { n: plan.rounds * plan.cycles })}</span>
        </p>
        <button className="btn btn-primary btn-wide" onClick={() => { const rid = save(); if (rid) go('timer/' + rid, { replace: true }); }}>
          <Icon name="play" size={18} /> {t('Save and start')}
        </button>
      </main>
    </>
  );
}

/* ---------- Runner ---------- */

/**
 * Beeps as small WAV files played by <audio> elements: on iPhone they play even with the silent
 * switch on (like a video), which Web Audio does not. They are unlocked by the Start tap.
 */
function wav(freq: number, ms: number): string {
  const rate = 22050;
  const n = Math.floor((rate * ms) / 1000);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, k) => v.setUint8(o + k, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let k = 0; k < n; k++) {
    const fade = Math.min(1, k / 200, (n - k) / 400);
    v.setInt16(44 + k * 2, Math.sin((2 * Math.PI * freq * k) / rate) * 0.6 * fade * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
type Sound = 'tick' | 'work' | 'rest' | 'end';
const SOUND_SPEC: Record<Sound, [number, number]> = { tick: [660, 140], work: [990, 450], rest: [520, 450], end: [880, 900] };
let sounds: Partial<Record<Sound, HTMLAudioElement>> = {};
let soundOn = true;
function unlockSounds() {
  for (const k of Object.keys(SOUND_SPEC) as Sound[]) {
    if (!sounds[k]) {
      const a = new Audio(wav(...SOUND_SPEC[k]));
      a.preload = 'auto';
      sounds[k] = a;
    }
    const a = sounds[k]!;
    a.muted = true;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }, () => { a.muted = false; });
  }
}
function play(k: Sound) {
  if (!soundOn) return;
  const a = sounds[k];
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}
const buzz = (p: number | number[]) => navigator.vibrate?.(p);

export function IntervalRun({ id }: { id: string }) {
  const { state, update } = useStore();
  const r = state.routines.find((x) => x.id === id);
  const phases = useMemo<Phase[]>(() => (r?.interval ? phasesOf(r.interval) : []), [r?.interval]);
  const [started, setStarted] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const [endAt, setEndAt] = useState(0);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const pauseStart = useRef(0);
  const [now, setNow] = useState(Date.now());
  const [stopping, setStopping] = useState(false);
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem('foundry:timer-sound') !== 'off';
    } catch {
      return true;
    }
  });
  soundOn = sound;
  const lastBeep = useRef(-1);
  const wasRunning = useRef(false);
  const workDone = useRef<number[]>([]);

  // Keep the screen on while it runs.
  useEffect(() => {
    if (started == null) return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock?.request('screen').then((l) => (lock = l), () => {});
    return () => void lock?.release().catch(() => {});
  }, [started]);

  useEffect(() => {
    if (started == null || pausedLeft != null) return;
    const h = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(h);
  }, [started, pausedLeft]);

  const finish = (completed: number[]) => {
    if (!r) return;
    const end = Date.now();
    if (!completed.length) {
      back('');
      return;
    }
    const w: Workout = {
      id: uid(),
      name: r.name,
      startedAt: started ?? end,
      endedAt: end,
      pausedMs,
      routineId: r.id,
      exercises: [{ id: uid(), exerciseId: 'hiit', restSec: 0, sets: completed.map((sec) => ({ id: uid(), type: 'normal' as const, weight: null, reps: null, duration: sec, done: true })) }],
    };
    update((s) => ({ ...s, workouts: [...s.workouts, w] }));
    go('w/' + w.id + '/done', { replace: true });
  };

  // Advance when a phase ends (also catches up after the app was in the background).
  useEffect(() => {
    if (started == null || pausedLeft != null || idx >= phases.length) return;
    const left = Math.ceil((endAt - now) / 1000);
    if (left <= 3 && left >= 1 && lastBeep.current !== left) {
      lastBeep.current = left;
      play('tick');
    }
    if (now < endAt) return;
    let i = idx;
    let e = endAt;
    while (i < phases.length && e <= now) {
      if (phases[i].kind === 'work') workDone.current.push(phases[i].sec);
      i++;
      if (i < phases.length) e += phases[i].sec * 1000;
    }
    lastBeep.current = -1;
    if (i >= phases.length) {
      play('end');
      buzz([300, 100, 300]);
      finish(workDone.current);
      return;
    }
    play(phases[i].kind === 'work' ? 'work' : 'rest');
    buzz(phases[i].kind === 'work' ? 250 : [120, 80, 120]);
    setIdx(i);
    setEndAt(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  if (!r?.interval) {
    return (
      <>
        <Header title={t('Timer')} onBack={() => back('')} />
        <main className="page"><p className="muted">{t('This workout no longer exists.')}</p></main>
      </>
    );
  }

  const start = () => {
    unlockSounds();
    setTimeout(() => play('work'), 150);
    const t0 = Date.now();
    setStarted(t0);
    setIdx(0);
    setEndAt(t0 + phases[0].sec * 1000);
    setNow(t0);
  };
  const pause = () => {
    pauseStart.current = Date.now();
    setPausedLeft(endAt - Date.now());
  };
  const resume = () => {
    setPausedMs((m) => m + Date.now() - pauseStart.current);
    setEndAt(Date.now() + (pausedLeft ?? 0));
    setPausedLeft(null);
    setNow(Date.now());
  };
  const jump = (to: number) => {
    if (to < 0 || to >= phases.length) return;
    if (to > idx && phases[idx].kind === 'work') workDone.current.push(phases[idx].sec - Math.max(0, Math.ceil(((pausedLeft ?? endAt - Date.now())) / 1000)));
    const left = phases[to].sec * 1000;
    setIdx(to);
    lastBeep.current = -1;
    if (pausedLeft != null) setPausedLeft(left);
    else setEndAt(Date.now() + left);
  };

  const ph = phases[Math.min(idx, phases.length - 1)];
  const leftMs = started == null ? ph.sec * 1000 : pausedLeft ?? Math.max(0, endAt - now);
  const left = Math.ceil(leftMs / 1000);
  const pct = 1 - leftMs / (ph.sec * 1000);
  const next = phases[idx + 1];
  const remaining = Math.ceil(leftMs / 1000) + phases.slice(idx + 1).reduce((s, x) => s + x.sec, 0);
  const plan = r.interval;

  return (
    <div className={'timer phase-' + (started == null ? 'idle' : ph.kind)}>
      <div className="timer-top">
        <button className="icon-btn" aria-label={t('Stop')} onClick={() => {
          if (started == null) return back('');
          wasRunning.current = pausedLeft == null;
          if (wasRunning.current) pause();
          setStopping(true);
        }}><Icon name="x" /></button>
        <strong>{r.name}</strong>
        <span className="timer-right">
          <span className="muted small">{fmtSec(remaining)}</span>
          <button
            className="icon-btn"
            aria-label={sound ? t('Sound on') : t('Sound off')}
            aria-pressed={sound}
            onClick={() => {
              const v = !sound;
              setSound(v);
              try {
                localStorage.setItem('foundry:timer-sound', v ? 'on' : 'off');
              } catch {
                /* ignore */
              }
              if (v) unlockSounds();
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4z" />
              {sound ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}
            </svg>
          </button>
        </span>
      </div>
      <div className="timer-main">
        <p className="timer-phase">{started == null ? t('Ready?') : t(PHASE_LABEL[ph.kind])}</p>
        {ph.kind === 'work' && ph.move && started != null && <p className="timer-move">{ph.move}</p>}
        <div className="timer-ring" style={{ '--p': String(started == null ? 0 : pct) } as React.CSSProperties}>
          <span className="timer-count">{left >= 60 ? fmtSec(left) : left}</span>
        </div>
        <p className="timer-meta">
          {t('Round {a}/{b}', { a: ph.round, b: plan.rounds })}
          {plan.cycles > 1 && <> · {t('Cycle {a}/{b}', { a: ph.cycle, b: plan.cycles })}</>}
        </p>
        {next && started != null && <p className="timer-next muted">{t('Next: {what} · {t}', { what: next.kind === 'work' && next.move ? next.move : t(PHASE_LABEL[next.kind]), t: fmtSec(next.sec) })}</p>}
      </div>
      <div className="timer-controls">
        {started == null ? (
          <button className="btn btn-primary btn-wide timer-go" onClick={start}><Icon name="play" size={22} /> {t('Start')}</button>
        ) : (
          <>
            <button className="icon-btn timer-skip" aria-label={t('Previous step')} onClick={() => jump(idx - 1)}><Icon name="back" /></button>
            <button className="btn btn-primary timer-pause" onClick={pausedLeft == null ? pause : resume}>
              <Icon name={pausedLeft == null ? 'pause' : 'play'} size={26} />
            </button>
            <button className="icon-btn timer-skip next" aria-label={t('Next step')} onClick={() => jump(idx + 1)}><Icon name="back" /></button>
          </>
        )}
      </div>
      <Sheet open={stopping} onClose={() => { setStopping(false); if (wasRunning.current) resume(); }} title={t('Stop the timer?')}>
        <div className="menu">
          {workDone.current.length > 0 && (
            <button className="btn btn-primary btn-wide" onClick={() => finish(workDone.current)}>
              {t('Stop and save ({n} rounds)', { n: workDone.current.length })}
            </button>
          )}
          <button className="btn btn-ghost-danger btn-wide" onClick={() => { setStopping(false); back(''); }}>
            {t('Quit without saving')}
          </button>
          <button className="btn btn-wide" onClick={() => { setStopping(false); if (wasRunning.current) resume(); }}>{t('Keep going')}</button>
        </div>
      </Sheet>
    </div>
  );
}
