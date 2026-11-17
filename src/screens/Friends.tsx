import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCloud } from '../cloud/cloud';
import {
  acceptFriend,
  addFriend,
  findProfile,
  inviteLink,
  profileLink,
  loadFriends,
  myProfile,
  removeFriend,
  saveProfile,
  SocialNotReady,
  watchFriendships,
  suggestUsername,
  type Friend,
  type PublicProfile,
  smallAvatar,
} from '../cloud/social';
import { Confirm, Header, Icon, Segmented, Logo } from '../components/ui';
import { back, go } from '../hooks';
import { locale, t, tk, tp } from '../i18n';
import { requirePro } from '../pro';
import { LevelChip } from '../components/Level';
import { ActivityFeed } from './Feed';
import { ChallengesPanel } from './Challenges';
import { exerciseName, useStore } from '../store';
import { daysPerWeek, liftsFor, rangeTotals } from '../socialStats';
import { dayKey } from '../nutrition';
import { BIG_LIFTS, BOARD_PERIODS, buildPublicStats, metricValue, rankBoard, type BoardMetric, type BoardPeriod, type PublicStats } from '../socialStats';
import { fmtDuration, fmtEstimate, fmtKm, fmtNum, fmtVolume } from '../utils';

const METRICS: { id: BoardMetric; label: string; hint: string; weekHint?: string }[] = [
  { id: 'days', label: tk('Training days'), hint: tk('Days with a workout. Three routines on one day count once.') },
  { id: 'goals', label: tk('Goals'), hint: tk('Share of weeks where each person met their own goals: fair whatever the level.'), weekHint: tk('How far along each person is with their own goals this week.') },
  { id: 'sets', label: tk('Sets'), hint: tk('Working sets.') },
  { id: 'volume', label: tk('Volume'), hint: tk('Weight × reps lifted.') },
  { id: 'streak', label: tk('Streak'), hint: tk('Weeks in a row with at least one workout.') },
  { id: 'prs', label: tk('Records'), hint: tk('New personal records.'), weekHint: tk('New personal records in the last 30 days.') },
  { id: 'cardio', label: tk('Cardio'), hint: tk('Minutes of cardio: running, cycling, rowing, walking…'), weekHint: tk('Minutes of cardio this week: running, cycling, rowing, walking…') },
  { id: 'strength', label: tk('Progress'), hint: tk('Strength index change: fair between beginners and experienced lifters.'), weekHint: tk('Strength index change over 4 weeks: fair between beginners and experienced lifters.') },
];

const PERIOD_LABEL: Record<BoardPeriod, string> = { week: tk('This week'), '30': tk('1 month'), '182': tk('6 months'), '365': tk('1 year') };


/** Loads my profile and friends; shared by the Friends screens. */
function useSocial() {
  const c = useCloud();
  const uid = c.user?.id ?? null;
  const [me, setMe] = useState<PublicProfile | null | undefined>(undefined);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const reload = useCallback(async () => {
    if (!uid) return;
    try {
      const [p, f] = await Promise.all([myProfile(uid), loadFriends(uid)]);
      setMe(p);
      setFriends(f);
      setError('');
    } catch (e) {
      if (e instanceof SocialNotReady) setNotReady(true);
      else setError((e as Error).message);
      setMe((m) => (m === undefined ? null : m));
    }
  }, [uid]);
  useEffect(() => {
    reload();
  }, [reload]);
  // Live: a new request or an accepted invitation shows without leaving the screen.
  useEffect(() => {
    if (!uid) return;
    let stop = () => {};
    let alive = true;
    watchFriendships(uid, () => reload()).then((s) => (alive ? (stop = s) : s()));
    const id = setInterval(() => document.visibilityState === 'visible' && reload(), 20000);
    const onVisible = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      stop();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid, reload]);
  return { uid, me, setMe, friends, reload, error, notReady };
}

function Avatar({ p, size = 40 }: { p: Pick<PublicProfile, 'avatar' | 'display_name' | 'username'>; size?: number }) {
  return p.avatar ? (
    <img className="avatar" src={p.avatar} alt="" width={size} height={size} />
  ) : (
    <svg className="avatar avatar-anon" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="39" r="17" />
      <path d="M16 92C16 72 31 61 50 61S84 72 84 92Z" />
    </svg>
  );
}

const nameOf = (p: PublicProfile) => p.display_name || '@' + p.username;

function fmtMetric(m: BoardMetric, v: number | null, unit: 'kg' | 'lb'): string {
  if (v == null) return '–';
  if (m === 'volume') return fmtVolume(v, unit);
  if (m === 'strength') return t('{v} pts', { v: (v > 0 ? '+' : '') + fmtNum(v) });
  if (m === 'goals') return `${v} %`;
  if (m === 'cardio') return fmtDuration(v * 60000);
  return String(v);
}

/** Pick a username (and name) so friends can find you. */
function ProfileSetup({ uid, onSaved, initial, bare }: { uid: string; onSaved: (p: PublicProfile) => void; initial?: PublicProfile | null; bare?: boolean }) {
  const { state } = useStore();
  const [username, setUsername] = useState(initial?.username ?? suggestUsername(state.profile?.name ?? ''));
  const [name, setName] = useState(initial?.display_name ?? state.profile?.name ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const pic = state.profile?.avatar ? await smallAvatar(state.profile.avatar).catch(() => '') : '';
    const p = { user_id: uid, username: username.trim().toLowerCase(), display_name: name.trim(), avatar: pic || null };
    try {
      const err = await saveProfile(p);
      if (err) setMsg(err);
      else onSaved(p);
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <section className="panel form">
      {!bare && <h2 className="panel-title">{initial ? t('Your public profile') : t('Choose your username')}</h2>}
      {!initial && !bare && <p className="muted small">{t('Friends find and invite you with it. Only your name, picture and a summary of your training stats are shared, and only with friends you accept.')}</p>}
      <label className="field">
        <span>{t('Username')}</span>
        <input id="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} placeholder="alex.lifts" onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} />
      </label>
      <label className="field">
        <span>{t('Name shown to friends')}</span>
        <input id="display-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      {msg && <p className="field-error">{msg}</p>}
      <button className="btn btn-primary btn-wide" disabled={busy || username.length < 3} onClick={save}>
        {busy ? t('Please wait…') : t('Save')}
      </button>
    </section>
  );
}

function NotReady() {
  return (
    <div className="empty-card">
      <Icon name="users" size={28} />
      <p>{t('Friends are not switched on on the server yet.')}</p>
    </div>
  );
}

async function share(url: string, setMsg: (s: string) => void) {
  const text = t('Train with me on Foundry: add me as a friend.');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Foundry', text, url });
      return;
    }
  } catch {
    return; // the person closed the share sheet
  }
  await navigator.clipboard?.writeText(url).catch(() => {});
  setMsg(t('Link copied. Send it to your friends.'));
}

export function FriendsHome({ initialView, manage }: { initialView?: 'feed' | 'challenges' | 'board'; manage?: boolean } = {}) {
  const { state } = useStore();
  const unit = state.settings.unit;
  const { uid, me: meServer, setMe, friends, reload, error, notReady } = useSocial();
  const me = meServer && state.profile?.avatar !== undefined ? { ...meServer, avatar: state.profile?.avatar ?? null } : meServer;
  const [metric, setMetric] = useState<BoardMetric>('days');
  const [period, setPeriod] = useState<BoardPeriod>('week');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const mine = useMemo(() => buildPublicStats(state), [state]);
  const [view, setView] = useState<'feed' | 'challenges' | 'board'>(initialView ?? 'feed');

  const accepted = friends.filter((f) => f.status === 'accepted');
  const incoming = friends.filter((f) => f.status === 'incoming');
  const outgoing = friends.filter((f) => f.status === 'outgoing');
  const board = me
    ? rankBoard<{ p: PublicProfile; me: boolean; level?: number }>(
        [{ person: { p: me, me: true, level: mine.level }, stats: mine }, ...accepted.map((f) => ({ person: { p: f.profile, me: false, level: f.stats?.level }, stats: f.stats }))],
        metric,
        period,
      )
    : [];

  const addByName = async () => {
    if (!uid) return;
    setMsg('');
    try {
      const p = await findProfile(search);
      if (!p) return setMsg(t('No one with this username.'));
      const r = await addFriend(uid, p.user_id);
      setMsg(r === 'sent' ? t('Request sent to {name}.', { name: nameOf(p) }) : r === 'accepted' ? t('You are now friends with {name}.', { name: nameOf(p) }) : t('Already in your friends or requests.'));
      setSearch('');
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <>
      <Header
        title={manage ? t('My friends') : t('Friends')}
        onBack={manage ? () => back('friends') : undefined}
        right={
          me ? (
            manage ? (
              <button className="icon-btn" aria-label={t('Invite friends')} onClick={() => share(inviteLink(me.username), setMsg)}>
                <Icon name="share" />
              </button>
            ) : (
              <button className="btn btn-small friends-manage" aria-label={t('My friends')} onClick={() => go('friends/list')}>
                <Icon name="users" size={18} /> {t('My friends')}
                {incoming.length > 0 && <span className="tab-badge">{incoming.length}</span>}
              </button>
            )
          ) : undefined
        }
      />
      <main className="page">
        {notReady ? (
          <NotReady />
        ) : me === undefined ? (
          <p className="muted">{t('Loading…')}</p>
        ) : !me && !editing ? (
          <section className="panel invite-card">
            <Icon name="users" size={36} />
            <h2>{t('Train with your friends')}</h2>
            <p className="muted small">{t('Invite friends, see a weekly leaderboard (training days, sets, volume, streak, records, progress) and compare yourselves head to head. Only a summary of your training is shared, never your meals or your weight.')}</p>
            <button className="btn btn-primary btn-wide" onClick={() => setEditing(true)}>
              {t('Choose my username')}
            </button>
          </section>
        ) : !me || editing ? (
          uid && (
            <ProfileSetup
              uid={uid}
              initial={me}
              onSaved={(p) => {
                setMe(p);
                setEditing(false);
              }}
            />
          )
        ) : (
          <>
            {error && <p className="field-error">{error}</p>}

            {manage ? (
              <>
            <section className="panel form">
              <h2 className="panel-title">{t('Add a friend')}</h2>
              <div className="inline-form">
                <input id="friend-search" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t('Their username')} value={search} onChange={(e) => setSearch(e.target.value.trim().toLowerCase())} onKeyDown={(e) => e.key === 'Enter' && search && addByName()} />
                <button className="btn" disabled={search.length < 3} onClick={addByName}>
                  {t('Add')}
                </button>
              </div>
              {msg && <p className="ok-line small">{msg}</p>}
            </section>

            {incoming.length > 0 && (
              <section className="panel">
                <h2 className="panel-title">{tp(incoming.length, '{n} friend request', '{n} friend requests')}</h2>
                <ul className="friend-list">
                  {incoming.map((f) => (
                    <li key={f.profile.user_id} className="friend-row">
                      <Avatar p={f.profile} />
                      <span className="friend-name">
                        <strong>{nameOf(f.profile)}</strong>
                        <span className="muted small">@{f.profile.username}</span>
                      </span>
                      <button className="btn btn-small btn-primary" onClick={async () => { await acceptFriend(uid!, f.profile.user_id).catch(() => {}); reload(); }}>
                        {t('Accept')}
                      </button>
                      <button className="icon-btn" aria-label={t('Decline')} onClick={async () => { await removeFriend(uid!, f.profile.user_id).catch(() => {}); reload(); }}>
                        <Icon name="close" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(accepted.length > 0 || outgoing.length > 0) && (
              <section className="panel">
                <h2 className="panel-title">{tp(accepted.length, '{n} friend', '{n} friends')}</h2>
                <ul className="friend-list">
                  {accepted.map((f) => (
                    <li key={f.profile.user_id}>
                      <button className="friend-row" onClick={() => (f.status !== 'accepted' || requirePro('compare')) && go('friends/' + f.profile.user_id)}>
                        <Avatar p={f.profile} />
                        <span className="friend-name">
                          <strong>{nameOf(f.profile)}</strong>
                          <span className="muted small">
                            {f.stats?.lastWorkoutAt ? t('Last workout {date}', { date: new Date(f.stats.lastWorkoutAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) }) : '@' + f.profile.username}
                          </span>
                        </span>
                        <span className="muted small">{t('Compare')}</span>
                        <Icon name="chevron" size={18} />
                      </button>
                    </li>
                  ))}
                  {outgoing.map((f) => (
                    <li key={f.profile.user_id} className="friend-row">
                      <Avatar p={f.profile} />
                      <span className="friend-name">
                        <strong>{nameOf(f.profile)}</strong>
                        <span className="muted small">{t('Request sent')}</span>
                      </span>
                      <button className="link-btn small" onClick={async () => { await removeFriend(uid!, f.profile.user_id).catch(() => {}); reload(); }}>
                        {t('Cancel')}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

              </>
            ) : (
              <>
            {incoming.length > 0 && (
              <section className="panel">
                <h2 className="panel-title">{tp(incoming.length, '{n} friend request', '{n} friend requests')}</h2>
                <ul className="friend-list">
                  {incoming.map((f) => (
                    <li key={f.profile.user_id} className="friend-row">
                      <Avatar p={f.profile} />
                      <span className="friend-name">
                        <strong>{nameOf(f.profile)}</strong>
                        <span className="muted small">@{f.profile.username}</span>
                      </span>
                      <button className="btn btn-small btn-primary" onClick={async () => { await acceptFriend(uid!, f.profile.user_id).catch(() => {}); reload(); }}>
                        {t('Accept')}
                      </button>
                      <button className="icon-btn" aria-label={t('Decline')} onClick={async () => { await removeFriend(uid!, f.profile.user_id).catch(() => {}); reload(); }}>
                        <Icon name="close" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Segmented<'feed' | 'challenges' | 'board'>
              label={t('View')}
              value={view}
              onChange={setView}
              options={[
                { value: 'feed', label: t('Activity') },
                { value: 'challenges', label: t('Challenges') },
                { value: 'board', label: t('Leaderboard') },
              ]}
            />
            {view === 'feed' && uid && (
              <ActivityFeed
                uid={uid}
                people={new Map([[me.user_id, me], ...accepted.map((f) => [f.profile.user_id, f.profile] as const)])}
                levels={new Map([[me.user_id, mine.level], ...accepted.map((f) => [f.profile.user_id, f.stats?.level] as const)])}
              />
            )}
            {view === 'challenges' && <ChallengesPanel friends={accepted.map((f) => ({ p: f.profile, stats: f.stats }))} />}
            {view === 'board' && (
            <section className="panel">
              <h2 className="panel-title">{t('Leaderboard')}</h2>
              <Segmented<BoardPeriod> label={t('Period')} value={period} onChange={(p) => (p === 'week' || p === '30' || requirePro('longLeaderboard')) && setPeriod(p)} options={BOARD_PERIODS.map((p) => ({ value: p, label: t(PERIOD_LABEL[p]) }))} />
              <div className="chips" role="tablist" aria-label={t('Leaderboard')}>
                {METRICS.map((m) => (
                  <button key={m.id} role="tab" aria-selected={metric === m.id} className={'chip' + (metric === m.id ? ' on' : '')} onClick={() => setMetric(m.id)}>
                    {t(m.label)}
                  </button>
                ))}
              </div>
              <p className="muted small">{(() => {
                const m = METRICS.find((x) => x.id === metric)!;
                return t(period === 'week' && m.weekHint ? m.weekHint : m.hint);
              })()}</p>
              <ol className="board">
                {board.map((r) => (
                  <li key={r.person.p.user_id} className={r.person.me ? 'me' : ''}>
                    <button className="board-row" onClick={() => !r.person.me && requirePro('compare') && go('friends/' + r.person.p.user_id)} disabled={r.person.me}>
                      <span className={'rank r' + r.rank}>{r.value == null ? '–' : r.rank}</span>
                      <Avatar p={r.person.p} size={36} />
                      <span className="friend-name">
                        <strong>{r.person.me ? t('You') : nameOf(r.person.p)} {r.person.level != null && <LevelChip level={r.person.level} short />}</strong>
                        {!r.person.me && <span className="muted small">@{r.person.p.username}</span>}
                      </span>
                      <span className="board-value">{fmtMetric(metric, r.value, unit)}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {metric === 'goals' && board.every((r) => r.value == null) && (
                <p className="muted small">{period === 'week' ? t('Nobody has set goals yet: set yours in Progress.') : t('Goals count from the first full week after they are set. Come back next week!')}</p>
              )}
              {!accepted.length && <p className="muted small">{t('Invite friends to see how you compare. Weekly rankings start again every week.')}</p>}
              <button className="btn btn-primary btn-wide" onClick={() => share(inviteLink(me.username), setMsg)}>
                <Icon name="share" size={18} /> {t('Invite friends')}
              </button>
            </section>
            )}

              </>
            )}
          </>
        )}
      </main>
    </>
  );
}

const Row = ({ label, a, b, fmt = (v: number) => String(v), higher = true }: { label: string; a: number | null | undefined; b: number | null | undefined; fmt?: (v: number) => string; higher?: boolean }) => {
  const max = Math.max(a ?? 0, b ?? 0, 1e-9);
  const win = a != null && b != null && a !== b ? ((a > b) === higher ? 'a' : 'b') : null;
  return (
    <li className="cmp-row">
      <span className={'cmp-val' + (win === 'a' ? ' win' : '')}>{a == null ? '–' : fmt(a)}</span>
      <span className="cmp-mid">
        <span className="cmp-label">{label}</span>
        <span className="cmp-bars">
          <span className="cmp-bar a" style={{ width: `${((a ?? 0) / max) * 100}%` }} />
          <span className="cmp-bar b" style={{ width: `${((b ?? 0) / max) * 100}%` }} />
        </span>
      </span>
      <span className={'cmp-val' + (win === 'b' ? ' win' : '')}>{b == null ? '–' : fmt(b)}</span>
    </li>
  );
};

export function FriendCompare({ id }: { id: string }) {
  const { state, exMap } = useStore();
  const unit = state.settings.unit;
  const { uid, me: meServer, friends, notReady } = useSocial();
  const me = meServer ? { ...meServer, avatar: state.profile?.avatar ?? null } : meServer;
  const [confirm, setConfirm] = useState(false);
  const mine = useMemo(() => buildPublicStats(state), [state]);
  const f = friends.find((x) => x.profile.user_id === id);
  const theirs: PublicStats | null = f?.stats ?? null;
  const [period, setPeriod] = useState<BoardPeriod>('week');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const v = (s: PublicStats | null, m: BoardMetric) => metricValue(s, m, period);
  const periodName = custom
    ? `${new Date(custom.from + 'T12:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} – ${new Date(custom.to + 'T12:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`
    : t(PERIOD_LABEL[period]);
  // Chosen dates: totals from the shared per-day summary.
  const rangeOf = (s: PublicStats | null) =>
    custom ? rangeTotals(s?.days, new Date(custom.from + 'T12:00').getTime(), new Date(custom.to + 'T12:00').getTime()) : null;
  const mineRange = rangeOf(mine);
  const theirRange = rangeOf(theirs);
  const perWeek = (s: PublicStats | null, r: ReturnType<typeof rangeOf>) => {
    if (!custom) return daysPerWeek(s, period);
    if (!r) return null;
    const weeks = Math.max(1, (new Date(custom.to + 'T12:00').getTime() - new Date(custom.from + 'T12:00').getTime()) / 86400000 + 1) / 7;
    return Math.round((r.days / weeks) * 10) / 10;
  };
  const score = (() => {
    const pairs: [number | null, number | null][] = (['days', 'goals', 'sets', 'volume', 'cardio', 'streak', 'prs', 'strength'] as BoardMetric[]).map((m) => [v(mine, m), v(theirs, m)]);
    let a = 0;
    let b = 0;
    for (const [x, y] of pairs) if (x != null && y != null && x !== y) x > y ? a++ : b++;
    return [a, b];
  })();

  return (
    <>
      <Header title={f ? nameOf(f.profile) : t('Friend')} onBack={() => back('friends')} />
      <main className="page">
        {notReady && <NotReady />}
        {!f && !notReady && <p className="muted">{t('Loading…')}</p>}
        {f && me && (
          <>
            <section className="cmp-head">
              <span className="cmp-person">
                <Avatar p={me} size={56} />
                <strong>{t('You')}</strong>
                {mine.level != null && <LevelChip level={mine.level} />}
              </span>
              <span className="cmp-score">
                {score[0]} <span className="muted">–</span> {score[1]}
              </span>
              <span className="cmp-person">
                <Avatar p={f.profile} size={56} />
                <strong>{nameOf(f.profile)}</strong>
                {theirs?.level != null && <LevelChip level={theirs.level} />}
              </span>
            </section>
            <button className="btn btn-wide" onClick={() => go('u/' + f.profile.username)}>
              {t('See profile and gear')}
            </button>
            {!theirs && <p className="muted small center">{t('{name} has not shared stats yet.', { name: nameOf(f.profile) })}</p>}

            <Segmented<BoardPeriod | 'custom'>
              label={t('Period')}
              value={custom ? 'custom' : period}
              onChange={(p) => {
                if (p === 'custom') return setCustom(custom ?? { from: dayKey(new Date(Date.now() - 13 * 86400000)), to: dayKey() });
                if (p === 'week' || p === '30' || requirePro('longLeaderboard')) {
                  setCustom(null);
                  setPeriod(p);
                }
              }}
              options={[...BOARD_PERIODS.map((p) => ({ value: p as BoardPeriod | 'custom', label: t(PERIOD_LABEL[p]) })), { value: 'custom', label: t('Dates') }]}
            />
            {custom ? (
              <section className="panel">
                <h2 className="panel-title">{t('Chosen dates')}</h2>
                <div className="date-range">
                  <label className="field">
                    <span>{t('From')}</span>
                    <input id="cmp-from" type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>{t('To')}</span>
                    <input id="cmp-to" type="date" value={custom.to} min={custom.from} max={dayKey()} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
                  </label>
                </div>
                {(() => {
                  const a = new Date(custom.from + 'T12:00').getTime();
                  const b = new Date(custom.to + 'T12:00').getTime();
                  const x = rangeTotals(mine.days, a, b);
                  const y = rangeTotals(theirs?.days, a, b);
                  return (
                    <>
                      <ul className="cmp-list">
                        <Row label={t('Training days')} a={x?.days} b={y?.days} />
                        <Row label={t('Sets')} a={x?.sets} b={y?.sets} />
                        <Row label={t('Volume')} a={x?.volume} b={y?.volume} fmt={(v) => fmtVolume(v, unit)} />
                        <Row label={t('Cardio')} a={x?.cardio} b={y?.cardio} fmt={(v) => fmtDuration(v * 60000)} />
                        <Row label={t('Records')} a={x?.records} b={y?.records} />
                      </ul>
                      {!y && <p className="muted small">{t('{name} needs the latest version of the app to compare over any dates.', { name: nameOf(f.profile) })}</p>}
                      <p className="muted small">{t('Any dates within the last 12 months.')}</p>
                    </>
                  );
                })()}
              </section>
            ) : (
            <section className="panel">
              <h2 className="panel-title">{t(PERIOD_LABEL[period])}</h2>
              <ul className="cmp-list">
                <Row label={t('Training days')} a={v(mine, 'days')} b={v(theirs, 'days')} />
                <Row label={t('Goals met')} a={v(mine, 'goals')} b={v(theirs, 'goals')} fmt={(x) => `${x} %`} />
                <Row label={t('Cardio')} a={v(mine, 'cardio')} b={v(theirs, 'cardio')} fmt={(x) => fmtDuration(x * 60000)} />
                <Row
                  label={t('Cardio distance')}
                  a={period === 'week' ? (mine.weekCardioKm ?? null) : (mine.periods?.[period]?.cardioKm ?? null)}
                  b={theirs ? (period === 'week' ? (theirs.week === mine.week ? (theirs.weekCardioKm ?? null) : 0) : (theirs.periods?.[period]?.cardioKm ?? null)) : null}
                  fmt={(x) => fmtKm(x)}
                />
                <Row label={t('Sets')} a={v(mine, 'sets')} b={v(theirs, 'sets')} />
                <Row label={t('Volume')} a={v(mine, 'volume')} b={v(theirs, 'volume')} fmt={(x) => fmtVolume(x, unit)} />
                <Row label={t('Records')} a={v(mine, 'prs')} b={v(theirs, 'prs')} />
                {period !== 'week' && <Row label={t('Strength progress')} a={v(mine, 'strength')} b={v(theirs, 'strength')} fmt={(x) => t('{v} pts', { v: (x > 0 ? '+' : '') + fmtNum(x) })} />}
                {period === 'week' && <Row label={t('Time')} a={mine.weekMinutes} b={theirs ? (theirs.week === mine.week ? theirs.weekMinutes : 0) : null} fmt={(x) => fmtDuration(x * 60000)} />}
              </ul>
            </section>
            )}

            <section className="panel">
              <h2 className="panel-title">{t('Consistency')} · {periodName}</h2>
              <ul className="cmp-list">
                <Row label={t('Training days per week')} a={perWeek(mine, mineRange)} b={perWeek(theirs, theirRange)} fmt={fmtNum} />
                <Row label={t('Current week streak')} a={v(mine, 'streak')} b={v(theirs, 'streak')} />
              </ul>
              <p className="muted small">{t('Since the start: {a} workouts for you, {b} for {name}.', { a: mine.totalWorkouts, b: theirs?.totalWorkouts ?? '–', name: nameOf(f.profile) })}</p>
            </section>

            <section className="panel">
              <h2 className="panel-title">{t('Big lifts (est. 1RM)')} · {periodName}</h2>
              {custom ? (
                <p className="muted small">{t('Best lifts are compared over a set period: choose this week, 1 month, 6 months or 1 year.')}</p>
              ) : (
                <ul className="cmp-list">
                  {BIG_LIFTS.map((l) => (
                    <Row key={l} label={exerciseName(exMap, l)} a={liftsFor(mine, period)?.[l] ?? null} b={liftsFor(theirs, period)?.[l] ?? null} fmt={(x) => fmtEstimate(x, unit)} />
                  ))}
                </ul>
              )}
              <p className="muted small">{t('Estimated from your best set (weight × reps). Train for yourself first: everyone starts somewhere.')}</p>
            </section>

            <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirm(true)}>
              {t('Remove from friends')}
            </button>
          </>
        )}
      </main>
      <Confirm
        open={confirm}
        title={t('Remove from friends?')}
        message={t('You will no longer see each other’s stats.')}
        confirmLabel={t('Remove')}
        danger
        onConfirm={async () => {
          if (uid) await removeFriend(uid, id).catch(() => {});
          go('friends', { replace: true });
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}

/** Opened from an invite link: add the person who shared it. */
export function InvitePage({ username }: { username: string }) {
  const { uid, me, setMe, notReady } = useSocial();
  const [other, setOther] = useState<PublicProfile | null | undefined>(undefined);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    findProfile(username).then(setOther, () => setOther(null));
  }, [username]);
  const add = async () => {
    if (!uid || !other) return;
    try {
      const r = await addFriend(uid, other.user_id);
      setMsg(r === 'sent' ? t('Request sent to {name}.', { name: nameOf(other) }) : r === 'accepted' ? t('You are now friends with {name}.', { name: nameOf(other) }) : t('Already in your friends or requests.'));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <>
      <Header title={t('Invitation')} onBack={() => go('friends', { replace: true })} />
      <main className="page">
        {notReady ? (
          <NotReady />
        ) : other === undefined || me === undefined ? (
          <p className="muted">{t('Loading…')}</p>
        ) : !other ? (
          <div className="empty-card">
            <p>{t('This invitation link does not match anyone.')}</p>
          </div>
        ) : other.user_id === uid ? (
          <div className="empty-card">
            <p>{t('This is your own invitation link. Send it to your friends.')}</p>
          </div>
        ) : !me ? (
          <>
            <p className="muted">{t('Choose your username first, so {name} can see you.', { name: nameOf(other) })}</p>
            {uid && <ProfileSetup uid={uid} onSaved={setMe} />}
          </>
        ) : (
          <section className="panel invite-card">
            <Avatar p={other} size={88} />
            <h2>{nameOf(other)}</h2>
            <p className="muted">@{other.username}</p>
            <p className="small">{t('{name} invites you to train together on Foundry and compare your progress.', { name: nameOf(other) })}</p>
            {msg ? (
              <>
                <p className="ok-line">{msg}</p>
                <button className="btn btn-primary btn-wide" onClick={() => go('friends', { replace: true })}>
                  {t('See my friends')}
                </button>
              </>
            ) : (
              <button className="btn btn-primary btn-wide" onClick={add}>
                <Icon name="plus" size={18} /> {t('Add as a friend')}
              </button>
            )}
          </section>
        )}
      </main>
    </>
  );
}

const HAS_PROFILE = (uid: string) => 'foundry:has-username:' + uid;

/**
 * Whether this account still has to choose a username. Checked once per account and remembered
 * on the device; never blocks when offline or when the social tables are not set up.
 */
export function useNeedsUsername(uid: string | null | undefined): [boolean, () => void] {
  const [need, setNeed] = useState(false);
  useEffect(() => {
    if (!uid) return;
    try {
      if (localStorage.getItem(HAS_PROFILE(uid))) return;
    } catch {
      /* ignore */
    }
    let alive = true;
    myProfile(uid).then(
      (p) => {
        if (!alive) return;
        if (p) {
          try {
            localStorage.setItem(HAS_PROFILE(uid), '1');
          } catch {
            /* ignore */
          }
        } else setNeed(true);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [uid]);
  const done = () => {
    if (uid)
      try {
        localStorage.setItem(HAS_PROFILE(uid), '1');
      } catch {
        /* ignore */
      }
    setNeed(false);
  };
  return [need, done];
}

/** Full screen shown after sign-up (and to older accounts): choosing a username is required. */
export function UsernameStep({ uid, onDone }: { uid: string; onDone: () => void }) {
  const { update } = useStore();
  const saved = (p: PublicProfile) => {
    // The name typed here also becomes the profile name when there is none yet.
    if (p.display_name) update((s) => (s.profile?.name ? s : { ...s, profile: { bio: '', ...s.profile, name: p.display_name } }));
    onDone();
  };
  return (
    <main className="page onboarding-step">
      <div className="username-step-head">
        <Logo size={48} />
        <h1>{t('Choose your username')}</h1>
        <p className="muted">{t('It is how your friends find you, invite you and see you in the leaderboard. You can change it later in the Friends tab.')}</p>
      </div>
      <ProfileSetup uid={uid} onSaved={saved} bare />
    </main>
  );
}

/** Settings → Friends: invite, share your profile, your public name, what friends see. */
export function FriendsSettings() {
  const { state, update } = useStore();
  const { uid, me, setMe, notReady } = useSocial();
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const sharing = state.settings.shareStats !== false;
  const isPublic = !!state.profile?.isPublic;
  return (
    <>
      <Header title={t('Friends')} onBack={() => back('settings')} />
      <main className="page">
        {notReady ? (
          <NotReady />
        ) : me === undefined ? (
          <p className="muted">{t('Loading…')}</p>
        ) : !me || editing ? (
          uid && <ProfileSetup uid={uid} initial={me} onSaved={(p) => { setMe(p); setEditing(false); }} />
        ) : (
          <>
            <ul className="settings-list">
              <li>
                <button className="settings-row" onClick={() => share(inviteLink(me.username), setMsg)}>
                  <Icon name="plus" />
                  <span className="settings-label">
                    {t('Invite a friend')}
                    <span className="muted small">{t('Send your invitation link: they join and become your friend in one tap.')}</span>
                  </span>
                  <Icon name="share" size={18} />
                </button>
              </li>
              <li>
                <button className="settings-row" onClick={() => share(profileLink(me.username), setMsg)}>
                  <Icon name="user" />
                  <span className="settings-label">
                    {t('Share my profile')}
                    <span className="muted small">{isPublic ? t('Your page: gear, level and shared stats.') : t('Your page is visible to your friends only.')}</span>
                  </span>
                  <Icon name="share" size={18} />
                </button>
              </li>
            </ul>
            {msg && <p className="ok-line small">{msg}</p>}

            <h2 className="settings-group">{t('My public profile')}</h2>
            <section className="panel">
              <div className="friend-row">
                <Avatar p={{ ...me, avatar: state.profile?.avatar ?? me.avatar }} />
                <span className="friend-name">
                  <strong>{nameOf(me)}</strong>
                  <span className="muted small">@{me.username}</span>
                </span>
                <button className="link-btn small" onClick={() => setEditing(true)}>{t('Edit')}</button>
              </div>
              <label className="setting">
                <span>
                  {t('Public profile')}
                  <br />
                  <span className="muted small">{isPublic ? t('Any member with your link sees your name, picture, gear and shared training stats. Never your workouts, nutrition or weight.') : t('Only your friends see your profile and gear.')}</span>
                </span>
                <input id="settings-public" type="checkbox" className="switch" checked={isPublic} onChange={(e) => update((s) => ({ ...s, profile: { name: '', bio: '', ...s.profile, isPublic: e.target.checked } }))} />
              </label>
            </section>

            <h2 className="settings-group">{t('What friends see')}</h2>
            <section className="panel">
              <label className="setting">
                <span>
                  {t('Share my stats with friends')}
                  <br />
                  <span className="muted small">{t('Training summary only: days, sets, volume, streak, records and lifts. Never your workouts in detail or your nutrition.')}</span>
                </span>
                <input type="checkbox" className="switch" checked={sharing} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, shareStats: e.target.checked } }))} />
              </label>
            </section>
          </>
        )}
      </main>
    </>
  );
}
