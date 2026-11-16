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

/** Send a message from Settings → Contact us (table in supabase/feedback.sql). */
export async function sendFeedback(kind: string, message: string, email: string): Promise<void> {
  const { error } = await (await sb()).from('feedback').insert({
    kind,
    message,
    email,
    app_version: __APP_VERSION__,
    device: navigator.userAgent.slice(0, 300),
  });
  check(error);
}

/** Number of friend requests waiting for this user (for the tab badge). */
export async function incomingCount(uid: string): Promise<number> {
  const { count, error } = await (await sb()).from('friendships').select('requester', { count: 'exact', head: true }).eq('addressee', uid).eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

/**
 * Calls `onChange` when a friendship involving this user is created, accepted or removed.
 * Uses Supabase Realtime when it is switched on for the table; otherwise nothing happens and the
 * screens fall back to refreshing on their own. Returns a function that stops listening.
 */
export async function watchFriendships(uid: string, onChange: () => void): Promise<() => void> {
  const c = await getClient();
  if (!c) return () => {};
  const ch = c
    .channel('friendships-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee=eq.${uid}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester=eq.${uid}` }, onChange)
    .subscribe();
  return () => {
    c.removeChannel(ch);
  };
}

export interface SharedMeal {
  user_id: string;
  meal_id: string;
  author: string;
  name: string;
  items: import('../nutrition').MealItem[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  updated_at: string;
}

/** Publish (or update) one of the user's meals for other members. */
export async function shareMeal(uid: string, meal: { id: string; name: string; items: import('../nutrition').MealItem[] }, author: string) {
  const tot = meal.items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const { error } = await (await sb()).from('shared_meals').upsert({
    user_id: uid,
    meal_id: meal.id,
    author: author.slice(0, 40),
    name: meal.name.slice(0, 80),
    items: meal.items.slice(0, 40).map(({ foodId, name, brand, grams, kcal, protein, carbs, fat }) => ({ foodId, name, brand, grams, kcal, protein, carbs, fat })),
    kcal: Math.round(tot.kcal),
    protein: Math.round(tot.protein * 10) / 10,
    carbs: Math.round(tot.carbs * 10) / 10,
    fat: Math.round(tot.fat * 10) / 10,
    updated_at: new Date().toISOString(),
  });
  check(error);
}

export async function unshareMeal(uid: string, mealId: string) {
  const { error } = await (await sb()).from('shared_meals').delete().eq('user_id', uid).eq('meal_id', mealId);
  check(error);
}

/** The most recent meals shared by other members. */
export async function loadSharedMeals(uid: string, limit = 60): Promise<SharedMeal[]> {
  const { data, error } = await (await sb()).from('shared_meals').select('*').neq('user_id', uid).order('updated_at', { ascending: false }).limit(limit);
  check(error);
  return (data ?? []) as SharedMeal[];
}

/* ---------- Community foods (supabase/community_foods.sql) ---------- */

type FoodRow = { id: string; name: string; brand: string | null; barcode: string | null; kcal: number; protein: number; carbs: number; fat: number; serving_label: string | null; serving_grams: number | null };
const rowToFood = (r: FoodRow): import('../nutrition').Food => ({
  id: r.id,
  name: r.name,
  brand: r.brand ?? undefined,
  barcode: r.barcode ?? undefined,
  per100: { kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat },
  serving: r.serving_label && r.serving_grams ? { label: r.serving_label, grams: r.serving_grams } : null,
  source: 'custom',
});

/** Add a food the user created to the shared database. */
export async function publishFood(uid: string, f: import('../nutrition').Food) {
  const { error } = await (await sb()).from('community_foods').upsert({
    id: f.id,
    user_id: uid,
    name: f.name.slice(0, 80),
    brand: f.brand?.slice(0, 60) ?? null,
    barcode: f.barcode && /^[0-9]{8,14}$/.test(f.barcode) ? f.barcode : null,
    kcal: f.per100.kcal,
    protein: f.per100.protein,
    carbs: f.per100.carbs,
    fat: f.per100.fat,
    serving_label: f.serving?.label?.slice(0, 40) ?? null,
    serving_grams: f.serving?.grams ?? null,
  });
  check(error);
}

/** Foods from the shared database whose name contains every word typed. */
export async function searchCommunityFoods(query: string, limit = 20): Promise<import('../nutrition').Food[]> {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 2).slice(0, 4);
  if (!words.length) return [];
  let q = (await sb()).from('community_foods').select('id, name, brand, barcode, kcal, protein, carbs, fat, serving_label, serving_grams');
  for (const w of words) q = q.ilike('name', `%${w.replace(/[%_,()]/g, '')}%`);
  const { data, error } = await q.order('uses', { ascending: false }).limit(limit);
  check(error);
  return ((data ?? []) as FoodRow[]).map(rowToFood);
}

export async function communityFoodByBarcode(code: string): Promise<import('../nutrition').Food | null> {
  const { data, error } = await (await sb()).from('community_foods').select('id, name, brand, barcode, kcal, protein, carbs, fat, serving_label, serving_grams').eq('barcode', code).limit(1);
  check(error);
  const r = (data ?? [])[0] as FoodRow | undefined;
  return r ? rowToFood(r) : null;
}
