import { useMemo } from 'react';
import { monthBounds, monthChallenges, monthKey } from '../challenges';
import type { PublicProfile } from '../cloud/social';
import { Icon } from '../components/ui';
import { go } from '../hooks';
import { locale, t, tp } from '../i18n';
import type { PublicStats } from '../socialStats';
import { useStore } from '../store';
import { fmtNum } from '../utils';

export interface ChallengeFriend {
  p: PublicProfile;
  stats: PublicStats | null;
}

/** This month's three challenges: my progress and, when given, my friends'. */
export function ChallengesPanel({ friends, compact }: { friends?: ChallengeFriend[]; compact?: boolean }) {
  const { state } = useStore();
  const key = monthKey();
  const list = useMemo(() => monthChallenges(state, key), [state, key]);
  const [, end] = monthBounds(key);
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const month = new Date().toLocaleDateString(locale(), { month: 'long' });
  const doneCount = list.filter((c) => c.done).length;

  if (compact)
    return (
      <button className="panel challenge-mini" onClick={() => go('friends/challenges')}>
        <span className="challenge-mini-head">
          <strong>{t('Challenges of {month}', { month })}</strong>
          <span className="muted small">{t('{a} / 3 done · {n} days left', { a: doneCount, n: daysLeft })}</span>
          <Icon name="chevron" size={18} />
        </span>
        {list.map((c) => (
          <span key={c.def.id} className="challenge-bar-line">
            <span className="small">{t(c.def.name)}</span>
            <Bar value={c.value} target={c.def.target} />
          </span>
        ))}
      </button>
    );

  return (
    <section className="challenges">
      <p className="muted small">
        {t('Three challenges, the same for every member. {n} days left in {month}. Each one completed counts towards your badges.', { n: daysLeft, month })}
      </p>
      {list.map((c) => {
        const rows = [
          { name: t('You'), value: c.value, me: true },
          ...(friends ?? []).map((f) => ({
            name: f.p.display_name || '@' + f.p.username,
            value: f.stats?.challenges?.month === key ? (f.stats.challenges.progress[c.def.id] ?? 0) : 0,
            me: false,
          })),
        ].sort((a, b) => b.value - a.value);
        return (
          <section key={c.def.id} className={'panel challenge' + (c.done ? ' done' : '')}>
            <div className="challenge-head">
              <strong>{t(c.def.name)}</strong>
              {c.done && <span className="tag challenge-done"><Icon name="check" size={14} /> {t('Challenge completed')}</span>}
            </div>
            <p className="muted small">{t(c.def.goal, { target: c.def.target })}</p>
            <Bar value={c.value} target={c.def.target} unit={c.def.unit} />
            {rows.length > 1 && (
              <ol className="challenge-board">
                {rows.map((r, i) => (
                  <li key={r.name + i} className={r.me ? 'me' : ''}>
                    <span className="muted">{i + 1}</span>
                    <span className="challenge-name">{r.name}</span>
                    <span className={r.value >= c.def.target ? 'ok' : ''}>
                      {fmtNum(r.value)} / {c.def.target}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
      {friends && !friends.length && <p className="muted small">{t('Add friends to see how they are doing on the same challenges.')}</p>}
    </section>
  );
}

function Bar({ value, target, unit }: { value: number; target: number; unit?: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <span className="challenge-bar">
      <span className="xp-bar" style={{ '--rank': value >= target ? 'var(--good)' : 'var(--accent)' } as React.CSSProperties}>
        <span style={{ width: pct + '%' }} />
      </span>
      <span className="small">
        {unit ? `${fmtNum(value)} / ${target} ${unit}` : `${fmtNum(value)} / ${target}`}
        {value < target && <span className="muted"> · {tp(target - value, '{n} to go', '{n} to go')}</span>}
      </span>
    </span>
  );
}
