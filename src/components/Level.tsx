import { BADGES, rankOf, type BadgeDef } from '../levels';
import { t } from '../i18n';
import { useFeature } from '../features';

/** "Lv 12 · Cast iron", in the rank's colour. */
export function LevelChip({ level, short }: { level: number; short?: boolean }) {
  const r = rankOf(level);
  if (!useFeature('levels')) return null;
  return (
    <span className="level-chip" style={{ '--rank': r.color } as React.CSSProperties} title={t(r.name)}>
      {t('Lv {n}', { n: level })}
      {!short && <> · {t(r.name)}</>}
    </span>
  );
}

const GLYPH: Record<BadgeDef['group'], string> = {
  training: 'M7 10v4M17 10v4M4 11v2M20 11v2M7 12h10',
  streak: 'M12 6c2 3 4 4 4 7a4 4 0 0 1-8 0c0-1.5 1-2.5 1.5-3.5.5 1 1 1.5 1.5 1.5 0-2 0-3.5 1-5z',
  strength: 'M6 16l6-9 6 9M9 12h6',
  nutrition: 'M12 7c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5zM12 7V5M12 7c1-2 3-2 3-2',
  gear: 'M5 10h14v4H5zM10 10v4M14 10v4',
  challenge: 'M8 6h8v4a4 4 0 0 1-8 0zM8 7H6a2 2 0 0 0 2 3M16 7h2a2 2 0 0 1-2 3M12 14v3M9 18h6',
};

/** A medal: a hexagon with the badge group's glyph; greyed out until earned. */
export function BadgeMedal({ id, earned, size = 48 }: { id: string; earned: boolean; size?: number }) {
  const b = BADGES.find((x) => x.id === id);
  if (!b) return null;
  return (
    <svg className={'badge-medal' + (earned ? ' on' : '')} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path className="badge-hex" d="M12 1.5l9 5.2v10.6l-9 5.2-9-5.2V6.7z" />
      <path className="badge-glyph" d={GLYPH[b.group]} />
    </svg>
  );
}
