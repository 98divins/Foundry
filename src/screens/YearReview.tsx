import { useEffect, useMemo, useState } from 'react';
import { BadgeMedal } from '../components/Level';
import { Header, Icon, Segmented, Sheet } from '../components/ui';
import { back, go } from '../hooks';
import { locale, t, tp } from '../i18n';
import { BADGES, rankOf } from '../levels';
import { drawYearCard } from '../shareCard';
import { exerciseName, useStore } from '../store';
import { DEFAULT_ACCENT } from '../theme';
import { fmtEstimate, fmtNum, toDisplay } from '../utils';
import { periodRange, periodReview, yearsWithData, type RecapKind } from '../yearReview';

/** Shown in December (this year) and January (last year). */
export function reviewYear(years: number[], now = new Date()): number | null {
  const y = now.getFullYear();
  if (now.getMonth() === 11 && years.includes(y)) return y;
  if (now.getMonth() === 0 && years.includes(y - 1)) return y - 1;
  return null;
}

/** Card on the Profile tab announcing the review. */
export function YearReviewCard() {
  const { state } = useStore();
  const year = reviewYear(yearsWithData(state));
  if (year == null) return null;
  return (
    <button className="panel year-card" onClick={() => go('recap/year/' + year)}>
      <span className="year-num">{year}</span>
      <span>
        <strong>{t('Your {year} in review is ready', { year })}</strong>
        <span className="muted small">{t('Workouts, records, favourite exercise, level… and an image to share.')}</span>
      </span>
      <Icon name="chevron" size={18} />
    </button>
  );
}

export const recapKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const parseKey = (k: string) => {
  const [y, m = 1, d = 1] = k.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** Title of a period: "2026", "novembre 2026", "Semaine du 9 nov." */
export function recapTitle(kind: RecapKind, from: number): string {
  if (kind === 'year') return String(new Date(from).getFullYear());
  if (kind === 'month') return new Date(from).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  return t('Week of {date}', { date: new Date(from).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) });
}

export function YearReviewPage({ year }: { year: number }) {
  return <RecapPage kind="year" start={new Date(year, 0, 1).getTime()} />;
}

export function RecapPage({ kind, start }: { kind: RecapKind; start: number }) {
  const { state, exMap } = useStore();
  const [from, to] = periodRange(kind, start);
  const year = new Date(from).getFullYear();
  const r = useMemo(() => periodReview(state, from, to), [state, from, to]);
  const title = recapTitle(kind, from);
  const unit = state.settings.unit;
  const [i, setI] = useState(0);
  const [sharing, setSharing] = useState(false);
  const tonnes = Math.round(toDisplay(r.volume, unit) / 100) / 10;
  const volumeText = unit === 'kg' ? t('{n} t', { n: fmtNum(tonnes) }) : t('{n}k lb', { n: fmtNum(tonnes) });
  const weekday = r.favouriteWeekday == null ? '' : new Date(2024, 0, 1 + r.favouriteWeekday).toLocaleDateString(locale(), { weekday: 'long' });
  const month = r.busiestMonth ? new Date(year, r.busiestMonth.month, 1).toLocaleDateString(locale(), { month: 'long' }) : '';
  const fav = r.favourite ? exerciseName(exMap, r.favourite.exerciseId) : null;

  const slides: { key: string; body: React.ReactNode }[] = [
    {
      key: 'intro',
      body: (
        <>
          <p className="yr-kicker">{kind === 'year' ? t('Your year {year}', { year }) : kind === 'month' ? t('Your month: {name}', { name: title }) : title}</p>
          <p className="yr-big">{r.workouts}</p>
          <p className="yr-text">{tp(r.workouts, 'workout finished. Every one counts.', 'workouts finished. Every one counts.')}</p>
        </>
      ),
    },
    {
      key: 'time',
      body: (
        <>
          <p className="yr-kicker">{t('Showing up')}</p>
          <p className="yr-big">{r.days}</p>
          <p className="yr-text">{t('days at the gym, {h} hours under the bar.', { h: fmtNum(r.hours) })}</p>
          {kind !== 'week' && <p className="yr-sub">{t('Longest run: {n} weeks in a row.', { n: r.bestStreak })}</p>}
        </>
      ),
    },
    {
      key: 'volume',
      body: (
        <>
          <p className="yr-kicker">{t('Total lifted')}</p>
          <p className="yr-big">{volumeText}</p>
          <p className="yr-text">
            {t('in {sets} sets. That is about {n} elephants.', { sets: fmtNum(r.sets), n: fmtNum(Math.max(1, Math.round(r.volume / 6000))) })}
          </p>
          {r.cardioMin > 0 && <p className="yr-sub">{t('Plus {m} minutes of cardio ({km} km).', { m: fmtNum(r.cardioMin), km: fmtNum(r.cardioKm) })}</p>}
        </>
      ),
    },
    {
      key: 'records',
      body: (
        <>
          <p className="yr-kicker">{t('Records')}</p>
          <p className="yr-big gold">{r.records}</p>
          <p className="yr-text">{t('times you did better than ever before.')}</p>
          {r.lifts.map((l) => (
            <p key={l.exerciseId} className="yr-lift">
              <span>{exerciseName(exMap, l.exerciseId)}</span>
              <strong>
                {fmtEstimate(l.from, unit)} → {fmtEstimate(l.to, unit)}
              </strong>
            </p>
          ))}
          {!!r.lifts.length && (
            <p className="yr-sub">
              {kind === 'year' ? t('Estimated 1RM, start of the year → end of the year.') : t('Best estimated 1RM before → during this period.')}
            </p>
          )}
        </>
      ),
    },
    {
      key: 'habits',
      body: (
        <>
          <p className="yr-kicker">{t('Your habits')}</p>
          {fav && (
            <>
              <p className="yr-mid">{fav}</p>
              <p className="yr-text">{t('your favourite exercise, with {n} sets.', { n: r.favourite!.sets })}</p>
            </>
          )}
          {weekday && (
            <p className="yr-sub">{t('Your gym day: {day}. Busiest month: {month} ({n} workouts).', { day: weekday, month, n: r.busiestMonth!.workouts })}</p>
          )}
        </>
      ),
    },
    {
      key: 'level',
      body: (
        <>
          <p className="yr-kicker">{t('Level')}</p>
          <p className="yr-big" style={{ color: rankOf(r.levelTo).color }}>
            {r.levelFrom === r.levelTo ? r.levelTo : `${r.levelFrom} → ${r.levelTo}`}
          </p>
          <p className="yr-text">
            {t(kind === 'year' ? '{rank} at the end of the year.' : '{rank} at the end of the period.', { rank: t(rankOf(r.levelTo).name) })}
          </p>
          {!!r.newBadges.length && (
            <ul className="badge-row yr-badges">
              {BADGES.filter((b) => r.newBadges.includes(b.id)).map((b) => (
                <li key={b.id}>
                  <BadgeMedal id={b.id} earned size={44} />
                  <span className="small">{t(b.name)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    ...(r.loggedDays || r.weightFrom != null
      ? [
          {
            key: 'nutrition',
            body: (
              <>
                <p className="yr-kicker">{t('Nutrition')}</p>
                <p className="yr-big">{r.loggedDays}</p>
                <p className="yr-text">{t('days of meals logged.')}</p>
                {r.weightFrom != null && r.weightTo != null && (
                  <p className="yr-sub">
                    {t('Weight: {a} → {b}.', {
                      a: `${fmtNum(Math.round(toDisplay(r.weightFrom, unit) * 10) / 10)} ${unit}`,
                      b: `${fmtNum(Math.round(toDisplay(r.weightTo, unit) * 10) / 10)} ${unit}`,
                    })}
                  </p>
                )}
              </>
            ),
          },
        ]
      : []),
    {
      key: 'end',
      body: (
        <>
          <p className="yr-kicker">
            {kind === 'year' ? t('See you in {year}', { year: year + 1 }) : kind === 'month' ? t('See you next month') : t('See you next week')}
          </p>
          <p className="yr-text">{t('Share it with your friends, and keep the streak going.')}</p>
          <button
            className="btn btn-primary btn-wide"
            onClick={(e) => {
              e.stopPropagation();
              setSharing(true);
            }}
          >
            <Icon name="share" size={18} /> {t('Share as an image')}
          </button>
        </>
      ),
    },
  ];
  const last = slides.length - 1;

  if (!r.workouts)
    return (
      <main className="page">
        <p className="muted">{t('No workouts in this period.')}</p>
        <button className="btn btn-wide" onClick={() => back('recap')}>
          {t('Back')}
        </button>
      </main>
    );

  return (
    <div
      className="yr"
      onClick={(e) => {
        const x = e.clientX / window.innerWidth;
        if (x < 0.3) setI(Math.max(0, i - 1));
        else setI(Math.min(last, i + 1));
      }}
    >
      <div className="yr-dots">
        {slides.map((s, k) => (
          <span key={s.key} className={k <= i ? 'on' : ''} />
        ))}
      </div>
      <button
        className="icon-btn yr-close"
        aria-label={t('Close')}
        onClick={(e) => {
          e.stopPropagation();
          back('recap');
        }}
      >
        <Icon name="x" />
      </button>
      <section className="yr-slide" key={slides[i].key}>
        {slides[i].body}
      </section>
      {i < last && <p className="yr-hint muted small">{t('Tap to continue')}</p>}
      <YearShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        title={title}
        kind={kind}
        lines={[
          [String(r.workouts), t('Workouts')],
          [String(r.days), t('Training days')],
          [volumeText, t('Total lifted')],
          [String(r.records), t('Records')],
          [fmtNum(r.hours) + ' h', t('Time training')],
          kind === 'week' ? [String(r.sets), t('Sets')] : [String(r.bestStreak), t('Weeks in a row (best)')],
        ]}
        favourite={fav}
        level={r.levelTo}
        accent={state.settings.accent ?? DEFAULT_ACCENT}
        author={state.profile?.name?.trim() || 'Foundry'}
      />
    </div>
  );
}

function YearShareSheet(p: {
  open: boolean;
  onClose: () => void;
  title: string;
  kind: RecapKind;
  lines: [string, string][];
  favourite: string | null;
  level: number;
  accent: string;
  author: string;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob]);
  useEffect(() => {
    if (p.open && !blob)
      drawYearCard({
        title: p.title,
        kind: p.kind,
        author: p.author,
        accent: p.accent,
        lines: p.lines,
        level: p.level,
        rank: rankOf(p.level),
        favourite: p.favourite,
      }).then(setBlob, () => {});
  }, [p.open]); // eslint-disable-line react-hooks/exhaustive-deps
  const file = () => new File([blob!], `foundry-${p.title.replace(/[^\w-]+/g, '-').toLowerCase()}.png`, { type: 'image/png' });
  const save = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = file().name;
    a.click();
  };
  const share = async () => {
    if (!blob) return;
    const f = file();
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: 'Foundry · ' + p.title }).catch(() => {});
    else save();
  };
  return (
    <Sheet open={p.open} onClose={p.onClose} title={t('Share as an image')} tall>
      <div className="share-card" onClick={(e) => e.stopPropagation()}>
        {url ? <img src={url} alt={p.title} /> : <div className="share-card-wait muted">{t('Preparing the image…')}</div>}
        <div className="sheet-actions">
          <button className="btn" onClick={save} disabled={!blob}>
            <Icon name="download" size={18} /> {t('Save')}
          </button>
          <button className="btn btn-primary" onClick={share} disabled={!blob}>
            <Icon name="share" size={18} /> {t('Share')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Pick a week, month or year and open its review. */
export function RecapHub() {
  const { state } = useStore();
  const [kind, setKind] = useState<RecapKind>('week');
  const [offset, setOffset] = useState(0);
  const [from, to] = periodRange(kind, Date.now(), offset);
  const r = useMemo(() => periodReview(state, from, to), [state, from, to]);
  const unit = state.settings.unit;
  return (
    <>
      <Header title={t('My recaps')} onBack={() => back('profile')} />
      <main className="page">
        <Segmented<RecapKind>
          label={t('Period')}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setOffset(0);
          }}
          options={[
            { value: 'week', label: t('Week') },
            { value: 'month', label: t('Month') },
            { value: 'year', label: t('Year') },
          ]}
        />
        <div className="recap-nav">
          <button className="icon-btn" aria-label={t('Previous')} onClick={() => setOffset(offset - 1)}>
            <Icon name="back" />
          </button>
          <strong>{recapTitle(kind, from)}</strong>
          <button className="icon-btn recap-next" aria-label={t('Next')} disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
            <Icon name="back" />
          </button>
        </div>
        <ul className="stat-grid panel">
          <li>
            <strong>{r.workouts}</strong>
            <span className="muted small">{t('Workouts')}</span>
          </li>
          <li>
            <strong>{r.days}</strong>
            <span className="muted small">{t('Training days')}</span>
          </li>
          <li>
            <strong>
              {fmtNum(Math.round(toDisplay(r.volume, unit) / 100) / 10)} {unit === 'kg' ? 't' : 'k lb'}
            </strong>
            <span className="muted small">{t('Total lifted')}</span>
          </li>
          <li>
            <strong>{r.records}</strong>
            <span className="muted small">{t('Records')}</span>
          </li>
        </ul>
        <button className="btn btn-primary btn-wide" disabled={!r.workouts} onClick={() => go(`recap/${kind}/${recapKey(from)}`)}>
          {t('Open the recap')}
        </button>
        {!r.workouts && <p className="muted small center">{t('No workouts in this period.')}</p>}
        <p className="muted small">{t('Each recap ends with an image to share. To share a single workout, open it from your history.')}</p>
      </main>
    </>
  );
}
