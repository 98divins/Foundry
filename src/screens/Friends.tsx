import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCloud } from '../cloud/cloud';
import {
  acceptFriend,
  addFriend,
  findProfile,
  inviteLink,
  loadFriends,
  myProfile,
  removeFriend,
  saveProfile,
  SocialNotReady,
  suggestUsername,
  type Friend,
  type PublicProfile,
} from '../cloud/social';
import { Confirm, Header, Icon } from '../components/ui';
import { back, go } from '../hooks';
import { locale, t, tk, tp } from '../i18n';
import { exerciseName, useStore } from '../store';
import { BIG_LIFTS, buildPublicStats, metricValue, rankBoard, type BoardMetric, type PublicStats } from '../socialStats';
import { fmtDuration, fmtEstimate, fmtNum, fmtVolume } from '../utils';

const METRICS: { id: BoardMetric; label: string; hint: string }[] = [
  { id: 'weekDays', label: tk('Training days'), hint: tk('Days with a workout this week. Three routines on one day count once.') },
  { id: 'weekSets', label: tk('Sets'), hint: tk('Working sets this week.') },
  { id: 'weekVolume', label: tk('Volume'), hint: tk('Weight × reps lifted this week.') },
  { id: 'streak', label: tk('Streak'), hint: tk('Weeks in a row with at least one workout.') },
  { id: 'prs30', label: tk('Records'), hint: tk('New personal records in the last 30 days.') },
  { id: 'strength4w', label: tk('Progress'), hint: tk('Strength index change over 4 weeks: fair between beginners and experienced lifters.') },
];

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
  if (m === 'weekVolume') return fmtVolume(v, unit);
  if (m === 'strength4w') return t('{v} pts', { v: (v > 0 ? '+' : '') + fmtNum(v) });
  return String(v);
}

/** Pick a username (and name) so friends can find you. */
function ProfileSetup({ uid, onSaved, initial }: { uid: string; onSaved: (p: PublicProfile) => void; initial?: PublicProfile | null }) {
  const { state } = useStore();
  const [username, setUsername] = useState(initial?.username ?? suggestUsername(state.profile?.name ?? ''));
  const [name, setName] = useState(initial?.display_name ?? state.profile?.name ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const p = { user_id: uid, username: username.trim().toLowerCase(), display_name: name.trim(), avatar: state.profile?.avatar ?? null };
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
      <h2 className="panel-title">{initial ? t('Your public profile') : t('Choose your username')}</h2>
      {!initial && <p className="muted small">{t('Friends find and invite you with it. Only your name, picture and a summary of your training stats are shared, and only with friends you accept.')}</p>}
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

export function FriendsHome() {
  const { state, update } = useStore();
  const unit = state.settings.unit;
  const { uid, me, setMe, friends, reload, error, notReady } = useSocial();
  const [metric, setMetric] = useState<BoardMetric>('weekDays');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const mine = useMemo(() => buildPublicStats(state), [state]);
  const sharing = state.settings.shareStats !== false;

  const accepted = friends.filter((f) => f.status === 'accepted');
  const incoming = friends.filter((f) => f.status === 'incoming');
  const outgoing = friends.filter((f) => f.status === 'outgoing');
  const board = me
    ? rankBoard<{ p: PublicProfile; me: boolean }>(
        [{ person: { p: me, me: true }, stats: mine }, ...accepted.map((f) => ({ person: { p: f.profile, me: false }, stats: f.stats }))],
        metric,
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
        title={t('Friends')}
        right={
          me ? (
            <button className="icon-btn" aria-label={t('Invite friends')} onClick={() => share(inviteLink(me.username), setMsg)}>
              <Icon name="share" />
            </button>
          ) : undefined
        }
      />
      <main className="page">
        {notReady ? (
          <NotReady />
        ) : me === undefined ? (
          <p className="muted">{t('Loading…')}</p>
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

            <section className="panel">
              <h2 className="panel-title">{t('Leaderboard')}</h2>
              <div className="chips" role="tablist" aria-label={t('Leaderboard')}>
                {METRICS.map((m) => (
                  <button key={m.id} role="tab" aria-selected={metric === m.id} className={'chip' + (metric === m.id ? ' on' : '')} onClick={() => setMetric(m.id)}>
                    {t(m.label)}
                  </button>
                ))}
              </div>
              <p className="muted small">{t(METRICS.find((m) => m.id === metric)!.hint)}</p>
              <ol className="board">
                {board.map((r) => (
                  <li key={r.person.p.user_id} className={r.person.me ? 'me' : ''}>
                    <button className="board-row" onClick={() => !r.person.me && go('friends/' + r.person.p.user_id)} disabled={r.person.me}>
                      <span className={'rank r' + r.rank}>{r.value == null ? '–' : r.rank}</span>
                      <Avatar p={r.person.p} size={36} />
                      <span className="friend-name">
                        <strong>{r.person.me ? t('You') : nameOf(r.person.p)}</strong>
                        {!r.person.me && <span className="muted small">@{r.person.p.username}</span>}
                      </span>
                      <span className="board-value">{fmtMetric(metric, r.value, unit)}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {!accepted.length && <p className="muted small">{t('Invite friends to see how you compare. Weekly rankings start again every week.')}</p>}
              <button className="btn btn-primary btn-wide" onClick={() => share(inviteLink(me.username), setMsg)}>
                <Icon name="share" size={18} /> {t('Invite friends')}
              </button>
            </section>

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

            {(accepted.length > 0 || outgoing.length > 0) && (
              <section className="panel">
                <h2 className="panel-title">{tp(accepted.length, '{n} friend', '{n} friends')}</h2>
                <ul className="friend-list">
                  {accepted.map((f) => (
                    <li key={f.profile.user_id}>
                      <button className="friend-row" onClick={() => go('friends/' + f.profile.user_id)}>
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

            <section className="panel">
              <div className="friend-row">
                <Avatar p={me} />
                <span className="friend-name">
                  <strong>{nameOf(me)}</strong>
                  <span className="muted small">@{me.username}</span>
                </span>
                <button className="link-btn small" onClick={() => setEditing(true)}>
                  {t('Edit')}
                </button>
              </div>
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
  const { uid, me, friends, notReady } = useSocial();
  const [confirm, setConfirm] = useState(false);
  const mine = useMemo(() => buildPublicStats(state), [state]);
  const f = friends.find((x) => x.profile.user_id === id);
  const theirs: PublicStats | null = f?.stats ?? null;
  const v = (s: PublicStats | null, m: BoardMetric) => metricValue(s, m);
  const score = (() => {
    const pairs: [number | null, number | null][] = (['weekDays', 'weekSets', 'weekVolume', 'streak', 'prs30', 'strength4w'] as BoardMetric[]).map((m) => [v(mine, m), v(theirs, m)]);
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
              </span>
              <span className="cmp-score">
                {score[0]} <span className="muted">–</span> {score[1]}
              </span>
              <span className="cmp-person">
                <Avatar p={f.profile} size={56} />
                <strong>{nameOf(f.profile)}</strong>
              </span>
            </section>
            {!theirs && <p className="muted small center">{t('{name} has not shared stats yet.', { name: nameOf(f.profile) })}</p>}

            <section className="panel">
              <h2 className="panel-title">{t('This week')}</h2>
              <ul className="cmp-list">
                <Row label={t('Training days')} a={v(mine, 'weekDays')} b={v(theirs, 'weekDays')} />
                <Row label={t('Sets')} a={v(mine, 'weekSets')} b={v(theirs, 'weekSets')} />
                <Row label={t('Volume')} a={v(mine, 'weekVolume')} b={v(theirs, 'weekVolume')} fmt={(x) => fmtVolume(x, unit)} />
                <Row label={t('Time')} a={mine.weekMinutes} b={theirs ? (theirs.week === mine.week ? theirs.weekMinutes : 0) : null} fmt={(x) => fmtDuration(x * 60000)} />
              </ul>
            </section>

            <section className="panel">
              <h2 className="panel-title">{t('Consistency and progress')}</h2>
              <ul className="cmp-list">
                <Row label={t('Week streak')} a={v(mine, 'streak')} b={v(theirs, 'streak')} />
                <Row label={t('Days per week (4 weeks)')} a={mine.avgDays4w} b={theirs?.avgDays4w} fmt={fmtNum} />
                <Row label={t('Records (30 d)')} a={mine.prs30} b={theirs?.prs30} />
                <Row label={t('Strength progress (4 weeks)')} a={mine.strength4w} b={theirs?.strength4w} fmt={(x) => t('{v} pts', { v: (x > 0 ? '+' : '') + fmtNum(x) })} />
                <Row label={t('Workouts in total')} a={mine.totalWorkouts} b={theirs?.totalWorkouts} />
              </ul>
            </section>

            <section className="panel">
              <h2 className="panel-title">{t('Big lifts (est. 1RM, 90 days)')}</h2>
              <ul className="cmp-list">
                {BIG_LIFTS.map((l) => (
                  <Row key={l} label={exerciseName(exMap, l)} a={mine.lifts[l] ?? null} b={theirs?.lifts[l] ?? null} fmt={(x) => fmtEstimate(x, unit)} />
                ))}
              </ul>
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
