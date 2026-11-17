import { useEffect, useState } from 'react';
import { useCloud } from '../cloud/cloud';
import { addFriend, friendsOf, friendSuggestions, mutualFriends, type Link, type PublicProfile, type Suggestion } from '../cloud/social';
import { go } from '../hooks';
import { t, tp } from '../i18n';

const nameOf = (p: PublicProfile) => p.display_name || '@' + p.username;

function Face({ p, size = 36 }: { p: PublicProfile; size?: number }) {
  return p.avatar ? (
    <img className="avatar" src={p.avatar} alt="" width={size} height={size} />
  ) : (
    <svg className="avatar avatar-anon" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="39" r="17" />
      <path d="M16 92C16 72 31 61 50 61S84 72 84 92Z" />
    </svg>
  );
}

/** "Sam, Léa and 2 others" from a list of people. */
export function namesLine(people: PublicProfile[]): string {
  const names = people.slice(0, 2).map(nameOf);
  const rest = people.length - names.length;
  if (!rest) return names.join(t(' and '));
  return names.join(', ') + ' ' + tp(rest, 'and {n} other', 'and {n} others');
}

/** "3 friends in common" with their faces; tap to see them all. Shows nothing when there are none. */
export function MutualLine({ userId }: { userId: string }) {
  const [people, setPeople] = useState<PublicProfile[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    mutualFriends(userId).then(setPeople, () => setPeople([]));
  }, [userId]);
  if (!people?.length) return null;
  return (
    <section className="mutual">
      <button className="mutual-line" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="mutual-faces" aria-hidden="true">
          {people.slice(0, 3).map((p) => (
            <Face key={p.user_id} p={p} size={26} />
          ))}
        </span>
        <span className="small">
          <strong>{tp(people.length, '{n} friend in common', '{n} friends in common')}</strong> · {namesLine(people)}
        </span>
      </button>
      {open && <PeopleList people={people.map((p) => ({ ...p, link: 'friend' as Link }))} />}
    </section>
  );
}

/** People with an action each: open their page, or add them. */
function PeopleList({
  people,
  note,
}: {
  people: (PublicProfile & { link: Link; mutual?: number })[];
  note?: (p: PublicProfile & { mutual?: number }) => string | null;
}) {
  const uid = useCloud().user?.id;
  const [links, setLinks] = useState<Record<string, Link>>({});
  const [err, setErr] = useState('');
  const add = async (p: PublicProfile) => {
    if (!uid) return;
    setErr('');
    try {
      const r = await addFriend(uid, p.user_id);
      setLinks((l) => ({ ...l, [p.user_id]: r === 'accepted' ? 'friend' : 'sent' }));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <>
      <ul className="people-list">
        {people.map((p) => {
          const link = links[p.user_id] ?? p.link;
          const sub = note?.(p);
          return (
            <li key={p.user_id}>
              <button className="people-who" onClick={() => go('u/' + p.username)}>
                <Face p={p} />
                <span>
                  <strong>{nameOf(p)}</strong>
                  <span className="muted small">
                    {' '}
                    @{p.username}
                    {sub ? ` · ${sub}` : ''}
                  </span>
                </span>
              </button>
              {link === 'none' || link === 'received' ? (
                <button className="btn btn-small btn-primary" onClick={() => add(p)} aria-label={t('Add {name}', { name: nameOf(p) })}>
                  {link === 'received' ? t('Accept') : t('Add')}
                </button>
              ) : (
                <span className="muted small">{link === 'sent' ? t('Request sent') : link === 'me' ? t('You') : t('Friend')}</span>
              )}
            </li>
          );
        })}
      </ul>
      {err && <p className="field-error">{err}</p>}
    </>
  );
}

/** A friend's friends, for their page (nothing when they hide their list). */
export function FriendsOfFriend({ userId, name }: { userId: string; name: string }) {
  const [people, setPeople] = useState<(PublicProfile & { link: Link })[] | null>(null);
  useEffect(() => {
    friendsOf(userId).then(setPeople, () => setPeople([]));
  }, [userId]);
  if (!people?.length) return null;
  return (
    <section className="panel">
      <h2 className="panel-title">{t('Friends of {name}', { name })}</h2>
      <PeopleList people={people} />
    </section>
  );
}

/** "People you may know": friends of your friends. */
export function Suggestions({ limit = 10 }: { limit?: number }) {
  const [people, setPeople] = useState<Suggestion[] | null>(null);
  useEffect(() => {
    friendSuggestions(limit).then(setPeople, () => setPeople([]));
  }, [limit]);
  if (!people?.length) return null;
  return (
    <section className="panel">
      <h2 className="panel-title">{t('People you may know')}</h2>
      <PeopleList
        people={people.map((p) => ({ ...p, link: 'none' as Link }))}
        note={(p) => (p.mutual ? tp(p.mutual, '{n} friend in common', '{n} friends in common') : null)}
      />
    </section>
  );
}
