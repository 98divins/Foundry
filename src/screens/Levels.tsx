import { useMemo } from 'react';
import { BadgeMedal, LevelChip } from '../components/Level';
import { Header, Icon } from '../components/ui';
import { back, go } from '../hooks';
import { t } from '../i18n';
import { BADGES, MAX_LEVEL, progression, RANKS, XP, type Progression } from '../levels';
import { useStore } from '../store';
import { fmtNum } from '../utils';

export function useProgression(): Progression {
  const { state } = useStore();
  return useMemo(() => progression(state), [state]);
}

function XpBar({ p }: { p: Progression }) {
  const pct = p.level >= MAX_LEVEL ? 100 : Math.round((p.intoLevel / p.levelSize) * 100);
  return (
    <div className="xp">
      <div className="xp-bar" style={{ '--rank': p.rank.color } as React.CSSProperties}>
        <span style={{ width: pct + '%' }} />
      </div>
      <span className="muted small">
        {p.level >= MAX_LEVEL ? t('Maximum level') : t('{a} / {b} XP to level {n}', { a: fmtNum(p.intoLevel), b: fmtNum(p.levelSize), n: p.level + 1 })}
      </span>
    </div>
  );
}

/** On the Profile tab: level, rank, progress bar and the latest badges. */
export function LevelCard() {
  const p = useProgression();
  const latest = BADGES.filter((b) => p.badges.includes(b.id)).slice(-4);
  return (
    <button className="panel level-card" onClick={() => go('levels')}>
      <span className="level-card-head">
        <span className="level-num" style={{ '--rank': p.rank.color } as React.CSSProperties}>{p.level}</span>
        <span className="level-card-text">
          <strong>{t('Level {n}', { n: p.level })} · {t(p.rank.name)}</strong>
          <XpBar p={p} />
        </span>
        <Icon name="chevron" size={18} />
      </span>
      <span className="level-card-badges">
        {latest.map((b) => <BadgeMedal key={b.id} id={b.id} earned size={30} />)}
        <span className="muted small">{t('{a} / {b} badges', { a: p.badges.length, b: BADGES.length })}</span>
      </span>
    </button>
  );
}

const GROUPS = [
  ['training', 'Training'],
  ['streak', 'Consistency'],
  ['strength', 'Strength'],
  ['nutrition', 'Nutrition'],
  ['gear', 'Gear'],
] as const;

export function LevelsPage() {
  const p = useProgression();
  return (
    <>
      <Header title={t('Level and badges')} onBack={() => back('profile')} />
      <main className="page">
        <section className="panel level-hero">
          <span className="level-num big" style={{ '--rank': p.rank.color } as React.CSSProperties}>{p.level}</span>
          <LevelChip level={p.level} />
          <strong>{t('{n} XP', { n: fmtNum(p.xp) })}</strong>
          <XpBar p={p} />
        </section>

        <section className="panel">
          <h2 className="panel-title">{t('Where your XP comes from')}</h2>
          <ul className="lift-list">
            {p.parts.map((x) => (
              <li key={x.id} className="lift-row">
                <span>{t(x.label)} <span className="muted small">× {x.count}</span></span>
                <strong>{fmtNum(x.xp)}</strong>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {t('Workout (20 min or 6 sets, 2 a day max) {a} XP · record {b} XP (3 per workout max) · week on your goal {c} XP · each week in a row +{d} XP more · day on nutrition target {e} XP · weekly weigh-in {f} XP.', {
              a: XP.workout, b: XP.record, c: XP.weekGoal, d: XP.streakStep, e: XP.dietDay, f: XP.weighInWeek,
            })}
          </p>
          <p className="muted small">{t('XP rewards showing up, not the weight on the bar: a beginner levels up as fast as anyone.')}</p>
        </section>

        {GROUPS.map(([g, label]) => (
          <section className="panel" key={g}>
            <h2 className="panel-title">{t(label)}</h2>
            <ul className="badge-grid">
              {BADGES.filter((b) => b.group === g).map((b) => {
                const on = p.badges.includes(b.id);
                return (
                  <li key={b.id} className={on ? 'on' : ''}>
                    <BadgeMedal id={b.id} earned={on} />
                    <strong className="small">{t(b.name)}</strong>
                    <span className="muted small">{t(b.text)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="panel">
          <h2 className="panel-title">{t('Ranks')}</h2>
          <ul className="lift-list">
            {RANKS.map((r, i) => (
              <li key={r.id} className="lift-row">
                <span><span className="rank-dot" style={{ background: r.color }} /> {t(r.name)}</span>
                <span className="muted">{r.from === MAX_LEVEL ? t('Level {n}', { n: r.from }) : t('Levels {a}–{b}', { a: r.from, b: RANKS[i + 1].from - 1 })}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
