import { useEffect, useRef, useState } from 'react';
import { useFeature } from '../features';
import { useCloud } from '../cloud/cloud';
import {
  loadProfilePage,
  myProfile,
  profileLink,
  publishAvatar,
  publishGear,
  smallAvatar,
  SocialNotReady,
  type ProfilePage,
  type PublicProfile,
} from '../cloud/social';
import { Header, Icon, Sheet } from '../components/ui';
import { cleanGear, GEAR_ICON, GEAR_LABEL, GEAR_LAYOUT, gearCount, type Gear, type GearItem, type GearSlot } from '../gear';
import { back, go } from '../hooks';
import { t } from '../i18n';
import { metricValue } from '../socialStats';
import { exerciseName, useStore } from '../store';
import { fmtNum } from '../utils';
import { Avatar } from './Settings';
import { BadgeMedal, LevelChip } from '../components/Level';
import { ReportSheet, useHidden } from '../components/ReportSheet';
import { BADGES, progression } from '../levels';

/** The plain silhouette, for someone without a picture (never the viewer's own photo). */
function AnonAvatar({ size }: { size: number }) {
  return (
    <svg className="avatar avatar-anon" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="39" r="17" />
      <path d="M16 92C16 72 31 61 50 61S84 72 84 92Z" />
    </svg>
  );
}

function SlotIcon({ slot, size = 26 }: { slot: GearSlot; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={GEAR_ICON[slot]} />
    </svg>
  );
}

function Slot({ slot, item, onClick }: { slot: GearSlot; item?: GearItem; onClick?: () => void }) {
  const filled = !!(item?.brand || item?.model);
  const body = (
    <>
      <span className="gear-icon">
        <SlotIcon slot={slot} />
      </span>
      <span className="gear-text">
        <span className="gear-slot-name">{t(GEAR_LABEL[slot])}</span>
        {filled ? (
          <>
            <strong>{item!.brand || item!.model}</strong>
            {item!.brand && item!.model && <span className="muted">{item!.model}</span>}
          </>
        ) : (
          <span className="muted">{onClick ? t('Add') : '—'}</span>
        )}
      </span>
    </>
  );
  const cls = 'gear-slot' + (filled ? ' filled' : '');
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={t(GEAR_LABEL[slot])}>
      {body}
    </button>
  ) : (
    <div className={cls} title={item?.note}>
      {body}
    </div>
  );
}

/** The gear board: the person in the middle, their equipment around them. */
export function GearBoard({ gear, center, onSlot, hideEmpty }: { gear: Gear; center: React.ReactNode; onSlot?: (s: GearSlot) => void; hideEmpty?: boolean }) {
  const show = (s: GearSlot) => !hideEmpty || gear[s];
  const col = (slots: GearSlot[]) => slots.filter(show).map((s) => <Slot key={s} slot={s} item={gear[s]} onClick={onSlot && (() => onSlot(s))} />);
  return (
    <div className="gear-board">
      <div className="gear-col">{col(GEAR_LAYOUT.left)}</div>
      <div className="gear-center">{center}</div>
      <div className="gear-col">{col(GEAR_LAYOUT.right)}</div>
      <div className="gear-bottom">{col(GEAR_LAYOUT.bottom)}</div>
    </div>
  );
}

/** My equipment: edit each slot, choose who sees the profile, share its link. */
export function GearPage() {
  const { state, update } = useStore();
  const c = useCloud();
  const gear = state.profile?.gear ?? {};
  const isPublic = !!state.profile?.isPublic;
  const [editing, setEditing] = useState<GearSlot | null>(null);
  const [draft, setDraft] = useState<GearItem>({ brand: '', model: '' });
  const [me, setMe] = useState<PublicProfile | null | undefined>(undefined);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    if (c.user) myProfile(c.user.id).then(setMe, () => setMe(null));
  }, [c.user]);

  const setProfile = (patch: Partial<NonNullable<typeof state.profile>>) => update((s) => ({ ...s, profile: { name: '', bio: '', ...s.profile, ...patch } }));
  const open = (slot: GearSlot) => {
    setDraft(gear[slot] ?? { brand: '', model: '' });
    setEditing(slot);
  };
  const save = (item: GearItem | null) => {
    if (!editing) return;
    const next = { ...gear };
    if (item) next[editing] = item;
    else delete next[editing];
    setProfile({ gear: cleanGear(next) });
    setEditing(null);
  };
  const share = async () => {
    if (!me) return;
    const url = profileLink(me.username);
    try {
      if (navigator.share) await navigator.share({ title: t('My Foundry profile'), url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(t('Link copied.'));
      }
    } catch {
      setCopied(url);
    }
  };

  return (
    <>
      <Header title={t('My gear')} onBack={() => back('profile')} />
      <main className="page">
        <p className="muted small">{t('Show what you train with. Tap a slot to add the brand and model.')}</p>
        <GearBoard
          gear={gear}
          onSlot={open}
          center={<CenterCard avatar={<Avatar size={84} />} name={state.profile?.name || t('You')} count={gearCount(gear)} level={progression(state).level} />}
        />

        <section className="panel">
          <h2 className="panel-title">{t('Who sees my profile')}</h2>
          <label className="toggle-line gear-toggle">
            <span>
              <strong>{t('Public profile')}</strong>
              <span className="muted small">
                {isPublic
                  ? t('Any member with your link sees your name, picture, gear and shared training stats. Never your workouts, nutrition or weight.')
                  : t('Only your friends see your profile and gear.')}
              </span>
            </span>
            <input id="public-profile" type="checkbox" className="switch" checked={isPublic} onChange={(e) => setProfile({ isPublic: e.target.checked })} />
          </label>
          {me ? (
            <div className="menu">
              <button className="btn btn-wide" onClick={() => go('u/' + me.username)}>
                {t('See my profile as others see it')}
              </button>
              <button className="btn btn-primary btn-wide" onClick={share}>
                <Icon name="share" size={18} /> {t('Share my profile')}
              </button>
              {copied && <p className="small ok-line">{copied}</p>}
            </div>
          ) : me === null ? (
            <p className="muted small">
              {t('Choose a username in the Friends tab to get a profile link.')}{' '}
              <button className="link-btn" onClick={() => go('friends')}>
                {t('Go to Friends')}
              </button>
            </p>
          ) : null}
        </section>
      </main>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ? t(GEAR_LABEL[editing]) : ''}>
        {editing && (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save(draft.brand.trim() || draft.model.trim() ? draft : null);
            }}
          >
            <label className="field">
              <span>{t('Brand')}</span>
              <input id="gear-brand" value={draft.brand} maxLength={40} autoFocus onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Model')}</span>
              <input id="gear-model" value={draft.model} maxLength={60} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Note (optional)')}</span>
              <input
                id="gear-note"
                value={draft.note ?? ''}
                maxLength={120}
                placeholder={t('Size, colour, why you like it…')}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </label>
            <button className="btn btn-primary btn-wide" type="submit">
              {t('Save')}
            </button>
            {gear[editing] && (
              <button className="btn btn-ghost-danger btn-wide" type="button" onClick={() => save(null)}>
                {t('Remove')}
              </button>
            )}
          </form>
        )}
      </Sheet>
    </>
  );
}

function CenterCard({ avatar, name, count, sub, level }: { avatar: React.ReactNode; name: string; count: number; sub?: string; level?: number }) {
  return (
    <div className="gear-hero">
      {avatar}
      <strong>{name}</strong>
      {sub && <span className="muted small">{sub}</span>}
      {level != null && <LevelChip level={level} />}
      <span className="gear-count small">{t('{0} / 13 slots', { 0: count })}</span>
    </div>
  );
}

/** A member's profile page: identity, gear, and the training summary they share. */
export function MemberProfile({ username }: { username: string }) {
  const gearOn = useFeature('gear');
  const levelsOn = useFeature('levels');
  const { state, exMap } = useStore();
  const [p, setP] = useState<ProfilePage | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const hidden = useHidden();
  const [reporting, setReporting] = useState(false);
  const self = useCloud().user?.id;
  useEffect(() => {
    loadProfilePage(username).then(setP, (e) => {
      setErr(e instanceof SocialNotReady ? t('Profiles are not switched on on the server yet.') : (e as Error).message);
      setP(null);
    });
  }, [username]);
  const s = p?.stats ?? null;
  const unit = state.settings.unit;
  const name = p ? p.display_name || '@' + p.username : '';
  return (
    <>
      <Header title={p ? name : t('Profile')} onBack={() => back('friends')} />
      <main className="page">
        {p === undefined && <p className="muted">{t('Loading…')}</p>}
        {p === null && (
          <div className="empty-card">
            <p>{err || t('This profile does not exist or is private.')}</p>
          </div>
        )}
        {p && hidden('profile', p.username) && (
          <div className="empty-card">
            <p>{t('You reported this profile, so it is hidden.')}</p>
          </div>
        )}
        {p && !hidden('profile', p.username) && (
          <>
            <GearBoard
              gear={gearOn ? p.gear : {}}
              hideEmpty={!gearOn}
              center={
                <CenterCard
                  avatar={p.avatar ? <img className="avatar" src={p.avatar} alt="" width={84} height={84} /> : <AnonAvatar size={84} />}
                  name={name}
                  sub={'@' + p.username}
                  count={gearCount(p.gear)}
                  level={p.stats?.level}
                />
              }
            />
            {p.bio && <p className="center">{p.bio}</p>}
            {levelsOn && !!p.stats?.badges?.length && (
              <section className="panel">
                <h2 className="panel-title">{t('Badges')}</h2>
                <ul className="badge-row">
                  {BADGES.filter((b) => p.stats!.badges!.includes(b.id)).map((b) => (
                    <li key={b.id} title={t(b.text)}>
                      <BadgeMedal id={b.id} earned size={40} />
                      <span className="small">{t(b.name)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="panel">
              <h2 className="panel-title">{t('Training')}</h2>
              {!s ? (
                <p className="muted small">{t('{name} does not share training stats.', { name })}</p>
              ) : (
                <ul className="stat-grid">
                  <li>
                    <strong>{metricValue(s, 'streak') ?? 0}</strong>
                    <span className="muted small">{t('Week streak')}</span>
                  </li>
                  <li>
                    <strong>{s.totalWorkouts}</strong>
                    <span className="muted small">{t('Workouts in total')}</span>
                  </li>
                  <li>
                    <strong>{fmtNum(s.avgDays4w)}</strong>
                    <span className="muted small">{t('Days per week (4 weeks)')}</span>
                  </li>
                  <li>
                    <strong>{s.prs30}</strong>
                    <span className="muted small">{t('Records (30 d)')}</span>
                  </li>
                </ul>
              )}
            </section>
            {s && Object.keys(s.lifts).length > 0 && (
              <section className="panel">
                <h2 className="panel-title">{t('Big lifts (est. 1RM, 90 days)')}</h2>
                <ul className="lift-list">
                  {Object.entries(s.lifts).map(([id, kg]) => (
                    <li key={id} className="lift-row">
                      <span>{exerciseName(exMap, id)}</span>
                      <strong>
                        {fmtNum(Math.round(unit === 'lb' ? kg! * 2.20462 : kg!))} {unit}
                      </strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {p.user_id !== self && (
              <button className="link-btn small report-link" onClick={() => setReporting(true)}>
                {t('Report this profile')}
              </button>
            )}
            <ReportSheet item={reporting ? { kind: 'profile', target: p.username, label: '@' + p.username } : null} onClose={() => setReporting(false)} />
          </>
        )}
      </main>
    </>
  );
}

/** Keeps the public profile's gear, bio and visibility in step with the account (silent on failure). */
export function GearPublisher() {
  const { state } = useStore();
  const c = useCloud();
  const uid = c.user?.id;
  const last = useRef('');
  const pr = state.profile;
  useEffect(() => {
    if (!uid || !c.initialSynced) return;
    const gear = pr?.gear ?? {};
    const json = JSON.stringify([gear, !!pr?.isPublic, pr?.bio ?? '']);
    if (json === last.current) return;
    const id = setTimeout(
      () =>
        publishGear(uid, gear, !!pr?.isPublic, pr?.bio ?? '').then(
          () => (last.current = json),
          () => {},
        ),
      3000,
    );
    return () => clearTimeout(id);
  }, [uid, c.initialSynced, pr]);
  // The picture: same idea, on its own (it is bigger and changes rarely).
  const lastAvatar = useRef<string | null | undefined>(undefined);
  const avatar = pr?.avatar ?? null;
  useEffect(() => {
    if (!uid || !c.initialSynced || avatar === lastAvatar.current) return;
    const id = setTimeout(async () => {
      try {
        const small = avatar ? await smallAvatar(avatar) : null;
        await publishAvatar(uid, small || null);
        lastAvatar.current = avatar;
      } catch {
        /* offline or no public profile yet: try again later */
      }
    }, 2000);
    return () => clearTimeout(id);
  }, [uid, c.initialSynced, avatar]);
  return null;
}
