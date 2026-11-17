import { useEffect, useMemo, useRef, useState } from 'react';
import { go } from '../hooks';
import { t } from '../i18n';
import { BADGES, progression } from '../levels';
import { useStore } from '../store';
import { useFeature } from '../features';

const KEY = 'foundry:seen-level';

/**
 * Celebrates a new level or badge once (remembered on this device). The first time it runs it only
 * records where the account is, so existing users are not flooded with old badges.
 */
export function LevelUpToast() {
  const { state } = useStore();
  const p = useMemo(() => progression(state), [state]);
  const [msg, setMsg] = useState<string | null>(null);
  const on = useFeature('levels');
  const timer = useRef<number>();
  useEffect(() => {
    let seen: { level: number; badges: string[] } | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    } catch {
      /* ignore */
    }
    const now = { level: p.level, badges: p.badges };
    if (seen) {
      const fresh = p.badges.filter((b) => !seen!.badges.includes(b));
      const text =
        p.level > seen.level
          ? t('Level {n} reached: {rank}!', { n: p.level, rank: t(p.rank.name) })
          : fresh.length
            ? t('New badge: {name}', { name: t(BADGES.find((b) => b.id === fresh[0])?.name ?? '') })
            : null;
      if (text) {
        setMsg(text);
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setMsg(null), 6000);
      }
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(now));
    } catch {
      /* ignore */
    }
  }, [p.level, p.badges.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!msg || !on) return null;
  return (
    <button className="streak-toast lit level-toast" onClick={() => { setMsg(null); go('levels'); }}>
      <span className="level-num" style={{ '--rank': p.rank.color, width: 28, height: 28, fontSize: 13 } as React.CSSProperties}>{p.level}</span>
      <span>{msg}</span>
    </button>
  );
}
