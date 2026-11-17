import { useCallback, useEffect, useState } from 'react';
import { useFeature } from '../features';
import { addComment, deleteComment, giveRespect, loadFeed, SocialNotReady, type FeedItem, type PublicProfile } from '../cloud/social';
import { BadgeMedal, LevelChip } from '../components/Level';
import { ReportSheet, useHidden, type ReportTarget } from '../components/ReportSheet';
import { Icon } from '../components/ui';
import { go } from '../hooks';
import { locale, t, tp } from '../i18n';
import { BADGES, rankOf } from '../levels';
import { useStore } from '../store';
import { fmtVolume } from '../utils';

function ago(iso: string): string {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.floor(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.floor(s / 3600) });
  if (s < 7 * 86400) return tp(Math.floor(s / 86400), '{n} day ago', '{n} days ago');
  return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

function Face({ p, size = 36 }: { p?: PublicProfile; size?: number }) {
  return p?.avatar ? (
    <img className="avatar" src={p.avatar} alt="" width={size} height={size} />
  ) : (
    <svg className="avatar avatar-anon" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="39" r="17" />
      <path d="M16 92C16 72 31 61 50 61S84 72 84 92Z" />
    </svg>
  );
}

/** Friends' activity: finished workouts, new levels and badges, with Respect and comments. */
export function ActivityFeed({ uid, people, levels }: { uid: string; people: Map<string, PublicProfile>; levels: Map<string, number | undefined> }) {
  const { state } = useStore();
  const unit = state.settings.unit;
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [limit, setLimit] = useState(10);
  const [notReady, setNotReady] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const hidden = useHidden();
  const levelsOn = useFeature('levels');
  const commentsOn = useFeature('comments');
  const [reporting, setReporting] = useState<ReportTarget | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await loadFeed(limit + 1));
      setErr('');
    } catch (e) {
      if (e instanceof SocialNotReady) setNotReady(true);
      else setErr((e as Error).message);
      setItems((x) => x ?? []);
    }
  }, [limit]);
  useEffect(() => {
    reload();
    const id = setInterval(() => document.visibilityState === 'visible' && reload(), 30000);
    return () => clearInterval(id);
  }, [reload]);

  const patch = (id: string, f: (x: FeedItem) => FeedItem) => setItems((xs) => xs?.map((x) => (x.id === id ? f(x) : x)) ?? xs);
  const name = (id: string) => (id === uid ? t('You') : people.get(id)?.display_name || (people.get(id) ? '@' + people.get(id)!.username : t('A member')));

  const respect = async (a: FeedItem) => {
    const on = !a.respects.includes(uid);
    patch(a.id, (x) => ({ ...x, respects: on ? [...x.respects, uid] : x.respects.filter((r) => r !== uid) }));
    try {
      await giveRespect(uid, a.id, on);
    } catch (e) {
      setErr((e as Error).message);
      reload();
    }
  };
  const send = async (a: FeedItem) => {
    if (!draft.trim()) return;
    try {
      const c = await addComment(uid, a.id, draft);
      patch(a.id, (x) => ({ ...x, comments: [...x.comments, c] }));
      setDraft('');
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const remove = async (a: FeedItem, id: string) => {
    patch(a.id, (x) => ({ ...x, comments: x.comments.filter((c) => c.id !== id) }));
    deleteComment(id).catch(() => reload());
  };

  if (notReady) return null;
  // Level and badge posts only show when levels are on (features.ts).
  const shown = (items ?? []).filter((a) => levelsOn || (a.data.kind !== 'level' && a.data.kind !== 'badge')).slice(0, limit);
  return (
    <section className="panel feed">
      <h2 className="panel-title">{t('Activity')}</h2>
      {items === null && <p className="muted small">{t('Loading…')}</p>}
      {items && !items.length && <p className="muted small">{t('Your friends’ workouts, new levels and badges show here. Finish a workout to post your first one.')}</p>}
      {err && <p className="error small">{err}</p>}
      <ul className="feed-list">
        {shown.map((a) => {
          const p = people.get(a.user_id);
          const mine = a.user_id === uid;
          const lv = levels.get(a.user_id);
          const d = a.data;
          const given = a.respects.includes(uid);
          return (
            <li key={a.id} className="feed-item">
              <div className="feed-head">
                <button className="feed-who" onClick={() => p && go('u/' + p.username)} disabled={!p}>
                  <Face p={p} />
                  <span>
                    <strong>{name(a.user_id)}</strong> {lv != null && <LevelChip level={lv} short />}
                    <span className="muted small"> · {ago(a.created_at)}</span>
                  </span>
                </button>
              </div>
              {d.kind === 'workout' && (
                <div className="feed-body">
                  <strong className="feed-title">{d.name}</strong>
                  <span className="feed-stats small">
                    <span>{t('{n} min', { n: d.minutes })}</span>
                    <span>{tp(d.sets, '{n} set', '{n} sets')}</span>
                    {d.volume > 0 && <span>{fmtVolume(d.volume, unit)}</span>}
                    {d.records > 0 && <span className="feed-pr"><Icon name="trophy" size={14} /> {tp(d.records, '{n} record', '{n} records')}</span>}
                  </span>
                  {!!d.exercises.length && (
                    <span className="muted small feed-exercises">
                      {d.exercises.map((x, k) => (
                        <span key={k}>
                          {k > 0 && ' · '}
                          {x}
                          {d.custom?.[k] && <span className="tag custom-tag">{t('Custom')}</span>}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )}
              {d.kind === 'level' && (
                <div className="feed-body feed-event">
                  <span className="level-num" style={{ '--rank': rankOf(d.level).color } as React.CSSProperties}>{d.level}</span>
                  <span>{t('reached level {n} · {rank}', { n: d.level, rank: t(rankOf(d.level).name) })}</span>
                </div>
              )}
              {d.kind === 'badge' && (
                <div className="feed-body feed-event">
                  <BadgeMedal id={d.badge} earned size={40} />
                  <span>{t('earned the badge {name}', { name: t(BADGES.find((b) => b.id === d.badge)?.name ?? '') })}</span>
                </div>
              )}
              <div className="feed-actions">
                <button className={'feed-respect' + (given ? ' on' : '')} onClick={() => respect(a)} disabled={mine} aria-pressed={given}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 11V7a2 2 0 0 1 4 0v3h5a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2H9l-2-2v-7zM4 11h3v9H4z" />
                  </svg>
                  {t('Respect')}
                  {a.respects.length > 0 && <span className="feed-count">{a.respects.length}</span>}
                </button>
                {commentsOn && (
                <button className="feed-respect" onClick={() => { setOpen(open === a.id ? null : a.id); setDraft(''); }}>
                  <Icon name="note" size={16} />
                  {a.comments.length ? tp(a.comments.length, '{n} comment', '{n} comments') : t('Comment')}
                </button>
                )}
              </div>
              {mine && a.respects.length > 0 && (
                <p className="muted small">{t('Respect from {names}', { names: a.respects.map(name).join(', ') })}</p>
              )}
              {commentsOn && open === a.id && (
                <div className="feed-comments">
                  {a.comments.filter((c) => !hidden('comment', c.id)).map((c) => (
                    <p key={c.id} className="small feed-comment">
                      <strong>{name(c.user_id)}</strong> {c.body}
                      {(c.user_id === uid || mine) && (
                        <button className="link-btn" onClick={() => remove(a, c.id)} aria-label={t('Delete')}>
                          <Icon name="x" size={14} />
                        </button>
                      )}
                      {c.user_id !== uid && (
                        <button className="link-btn" onClick={() => setReporting({ kind: 'comment', target: c.id, label: c.body.slice(0, 30) })} aria-label={t('Report')}>
                          <Icon name="flag" size={14} />
                        </button>
                      )}
                    </p>
                  ))}
                  <form className="feed-reply" onSubmit={(e) => { e.preventDefault(); send(a); }}>
                    <input id={'comment-' + a.id} value={draft} maxLength={280} placeholder={t('Write a comment…')} onChange={(e) => setDraft(e.target.value)} />
                    <button className="btn btn-primary btn-small" type="submit" disabled={!draft.trim()}>{t('Send')}</button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {items && items.length > limit && (
        <button className="btn btn-wide" onClick={() => setLimit(limit + 20)}>{t('Show more')}</button>
      )}
      <p className="muted small">{t('Only your friends see your posts. Turn off sharing in this tab to stop posting.')}</p>
      <ReportSheet item={reporting} onClose={() => setReporting(null)} />
    </section>
  );
}
