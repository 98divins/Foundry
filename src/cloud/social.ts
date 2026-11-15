/** Friends, profiles and shared stats, on top of the Supabase tables in supabase/social.sql. */
import { t } from '../i18n';
import type { PublicStats } from '../socialStats';
import { getClient } from './cloud';

export interface PublicProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface Friend {
  profile: PublicProfile;
  status: 'accepted' | 'incoming' | 'outgoing';
  stats: PublicStats | null;
  statsAt: string | null;
}

/** Thrown when the social tables were not created yet on the server. */
export class SocialNotReady extends Error {}

function check(e: { code?: string; message: string } | null) {
  if (!e) return;
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /does not exist|could not find/i.test(e.message)) {
    throw new SocialNotReady(t('Friends are not switched on on the server yet.'));
  }
  if (/failed to fetch|network/i.test(e.message)) throw new Error(t('No connection. Check your internet and try again.'));
  throw new Error(e.message);
}

async function sb() {
  const c = await getClient();
  if (!c) throw new Error(t('Cloud sync is not set up.'));
  return c;
}

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

/** A username suggestion from a name: lowercase letters, digits, dots and underscores. */
export function suggestUsername(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 16);
  return base.length >= 3 ? base : '';
}

export async function myProfile(uid: string): Promise<PublicProfile | null> {
  const { data, error } = await (await sb()).from('profiles').select('user_id, username, display_name, avatar').eq('user_id', uid).maybeSingle();
  check(error);
  return data as PublicProfile | null;
}

/** Create or update the public profile. Returns an error message for a taken or invalid username. */
export async function saveProfile(p: PublicProfile): Promise<string | null> {
  if (!USERNAME_RE.test(p.username)) return t('3 to 20 characters: lowercase letters, digits, dots and underscores.');
  const { error } = await (await sb()).from('profiles').upsert({ ...p, updated_at: new Date().toISOString() });
  if (error?.code === '23505') return t('This username is taken. Try another one.');
  check(error);
  return null;
}

export async function findProfile(username: string): Promise<PublicProfile | null> {
  const { data, error } = await (await sb()).rpc('find_profile', { name: username });
  check(error);
  return ((data as PublicProfile[] | null) ?? [])[0] ?? null;
}

/** Friends, requests both ways, and friends' shared stats. */
export async function loadFriends(uid: string): Promise<Friend[]> {
  const c = await sb();
  const { data: rows, error } = await c.from('friendships').select('requester, addressee, status');
  check(error);
  const links = (rows ?? []) as { requester: string; addressee: string; status: string }[];
  const other = (r: (typeof links)[number]) => (r.requester === uid ? r.addressee : r.requester);
  const ids = links.map(other);
  if (!ids.length) return [];
  const [{ data: profiles, error: e1 }, { data: stats, error: e2 }] = await Promise.all([
    c.from('profiles').select('user_id, username, display_name, avatar').in('user_id', ids),
    c.from('public_stats').select('user_id, stats, updated_at').in('user_id', ids),
  ]);
  check(e1);
  check(e2);
  const pm = new Map(((profiles ?? []) as PublicProfile[]).map((p) => [p.user_id, p]));
  const sm = new Map(((stats ?? []) as { user_id: string; stats: PublicStats; updated_at: string }[]).map((s) => [s.user_id, s]));
  return links
    .filter((r) => pm.has(other(r)))
    .map((r) => ({
      profile: pm.get(other(r))!,
      status: r.status === 'accepted' ? 'accepted' : r.requester === uid ? 'outgoing' : 'incoming',
      stats: sm.get(other(r))?.stats ?? null,
      statsAt: sm.get(other(r))?.updated_at ?? null,
    }));
}

/** Ask someone to be friends; if they already asked you, accept instead. */
export async function addFriend(uid: string, other: string): Promise<'sent' | 'accepted' | 'already'> {
  if (other === uid) return 'already';
  const c = await sb();
  const { data: existing, error: e0 } = await c
    .from('friendships')
    .select('requester, addressee, status')
    .or(`and(requester.eq.${uid},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${uid})`);
  check(e0);
  const row = (existing ?? [])[0] as { requester: string; status: string } | undefined;
  if (row?.status === 'accepted' || row?.requester === uid) return 'already';
  if (row) {
    await acceptFriend(uid, other);
    return 'accepted';
  }
  const { error } = await c.from('friendships').insert({ requester: uid, addressee: other, status: 'pending' });
  if (error?.code === '23505') return 'already';
  check(error);
  return 'sent';
}

export async function acceptFriend(uid: string, requester: string) {
  const { error } = await (await sb()).from('friendships').update({ status: 'accepted' }).eq('requester', requester).eq('addressee', uid);
  check(error);
}

/** Decline a request, cancel yours, or remove a friend. */
export async function removeFriend(uid: string, other: string) {
  const c = await sb();
  const { error } = await c
    .from('friendships')
    .delete()
    .or(`and(requester.eq.${uid},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${uid})`);
  check(error);
}

export async function publishStats(uid: string, stats: PublicStats) {
  const { error } = await (await sb()).from('public_stats').upsert({ user_id: uid, stats, updated_at: new Date().toISOString() });
  check(error);
}

export async function unpublishStats(uid: string) {
  const { error } = await (await sb()).from('public_stats').delete().eq('user_id', uid);
  check(error);
}

export const inviteLink = (username: string) => `${location.origin}${location.pathname}#/invite/${encodeURIComponent(username)}`;
