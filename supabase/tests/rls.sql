-- Access-rule tests: fake accounts try to read and change each other's data.
-- Run with `npm run test:rls` (scripts/test-rls.sh), never on the real project.
-- Each check prints "ok - …" or stops the run with "FAIL: …".
\set ON_ERROR_STOP 1
\set QUIET 1

create schema if not exists t;
grant usage on schema t to anon, authenticated;

-- Sign in as someone (null = signed out) for the statements that follow.
create or replace function t.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claims',
    case when uid is null then '' else json_build_object('sub', uid, 'role', 'authenticated', 'email', uid || '@test.invalid')::text end, false);
end $$;

create or replace function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;

-- The statement must be refused (an error, e.g. a policy or a permission).
create or replace function t.fails(stmt text, label text) returns void language plpgsql as $$
declare refused boolean := false;
begin
  begin
    execute stmt;
  exception when others then
    refused := true;
  end;
  if not refused then raise exception 'FAIL: % (the statement was accepted)', label; end if;
  raise notice 'ok - %', label;
end $$;

-- The statement must run and touch exactly n rows (0 = silently filtered out by the rules).
create or replace function t.rows(stmt text, n int, label text) returns void language plpgsql as $$
declare c int;
begin
  execute stmt;
  get diagnostics c = row_count;
  if c <> n then raise exception 'FAIL: % (% rows, expected %)', label, c, n; end if;
  raise notice 'ok - %', label;
end $$;

-- How many rows a query returns for the current user (0 when access is denied outright).
create or replace function t.seen(q text) returns int language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || q || ') x' into c;
  return c;
exception when insufficient_privilege then
  return 0;
end $$;

grant execute on all functions in schema t to anon, authenticated;

-- Three members: Alice and Bob become friends, Carol is a stranger.
\set alice '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set bob   '''bbbbbbbb-0000-0000-0000-00000000000b'''
\set carol '''cccccccc-0000-0000-0000-00000000000c'''
insert into auth.users (id, email) values
  (:alice, 'alice@test.invalid'), (:bob, 'bob@test.invalid'), (:carol, 'carol@test.invalid');

/* ---------- Each member writes their own data, the way the app does ---------- */
set role authenticated;
select t.login(:alice);
insert into public.user_state (user_id, data) values (:alice, '{"workouts":[]}');
insert into public.profiles (user_id, username, display_name) values (:alice, 'alice', 'Alice');
insert into public.public_stats (user_id, stats) values (:alice, '{"v":1}');
insert into public.activities (user_id, ref, kind, data) values (:alice, 'w-1', 'workout', '{"kind":"workout"}');
insert into public.shared_meals (user_id, meal_id, author, name, items) values (:alice, 'm1', 'Alice', 'Bowl', '[{"name":"rice"}]');
insert into public.community_foods (id, user_id, name, kcal) values ('f-alice', :alice, 'Sauce', 120);
insert into public.friendships (requester, addressee) values (:alice, :bob);
insert into public.feedback (user_id, email, kind, message) values (:alice, :alice || '@test.invalid', 'idea', 'hello');

select t.login(:bob);
insert into public.user_state (user_id, data) values (:bob, '{}');
insert into public.profiles (user_id, username, display_name) values (:bob, 'bob', 'Bob');
insert into public.friendships (requester, addressee) values (:bob, :carol);
select t.rows($$update public.friendships set status = 'accepted' where requester = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 1, 'Bob accepts Alice''s request');

select t.login(:carol);
insert into public.user_state (user_id, data) values (:carol, '{}');
insert into public.profiles (user_id, username, display_name) values (:carol, 'carol', 'Carol');

/* ---------- user_state: strictly private ---------- */
select t.login(:carol);
select t.ok(t.seen($$select 1 from public.user_state where user_id <> auth.uid()$$) = 0, 'user_state: nobody reads another account');
select t.rows($$update public.user_state set data = '{}' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'user_state: nobody changes another account');
select t.rows($$delete from public.user_state where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'user_state: nobody deletes another account');
select t.fails($$insert into public.user_state (user_id, data) values ('dddddddd-0000-0000-0000-00000000000d', '{}')$$, 'user_state: nobody writes a row for someone else');
select t.fails($$update public.user_state set user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' where user_id = auth.uid()$$, 'user_state: a row cannot be handed to another account');

/* ---------- friendships ---------- */
-- Regression for finding A: Carol has a pending request from Bob; she must not be able to rewrite
-- who asked, and so become Alice's friend without Alice agreeing.
select t.fails($$update public.friendships set requester = 'aaaaaaaa-0000-0000-0000-00000000000a', status = 'accepted' where addressee = auth.uid()$$, 'friendships: accepting cannot change who asked (finding A)');
select t.fails($$insert into public.friendships (requester, addressee, status) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-00000000000a', 'accepted')$$, 'friendships: a request cannot be created already accepted');
select t.fails($$insert into public.friendships (requester, addressee) values ('aaaaaaaa-0000-0000-0000-00000000000a', auth.uid())$$, 'friendships: nobody asks on someone else''s behalf');
select t.ok(t.seen($$select 1 from public.friendships where auth.uid() not in (requester, addressee)$$) = 0, 'friendships: only your own links are visible');
select t.rows($$update public.friendships set status = 'accepted' where requester = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'friendships: nobody accepts a request addressed to someone else');
select t.rows($$delete from public.friendships where requester = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'friendships: nobody removes a link they are not part of');
select t.ok(not public.is_friend('aaaaaaaa-0000-0000-0000-00000000000a'), 'friendships: Carol is not Alice''s friend');

/* ---------- profiles ---------- */
select t.ok(t.seen($$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$) = 0, 'profiles: a stranger does not read your profile');
select t.ok((select count(*) from public.find_profile('alice')) = 1, 'profiles: a stranger finds you by exact username only');
select t.ok(t.seen($$select 1 from public.profile_page('alice')$$) = 0, 'profiles: a private profile page is hidden from strangers');
select t.rows($$update public.profiles set display_name = 'x' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'profiles: nobody changes another profile');
select t.fails($$update public.profiles set user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' where user_id = auth.uid()$$, 'profiles: a profile cannot be handed to another account');
select t.login(:bob);
select t.ok(t.seen($$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$) = 1, 'profiles: a friend reads your profile');
select t.ok(t.seen($$select 1 from public.profile_page('alice')$$) = 1, 'profiles: a friend sees your profile page');

/* ---------- public_stats ---------- */
select t.ok(t.seen($$select 1 from public.public_stats where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$) = 1, 'stats: a friend reads your stats');
select t.rows($$update public.public_stats set stats = '{"v":1,"streak":99}' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'stats: a friend cannot change your stats');
select t.login(:carol);
select t.ok(t.seen($$select 1 from public.public_stats where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$) = 0, 'stats: a stranger does not read your stats');
select t.fails($$insert into public.public_stats (user_id, stats) values ('aaaaaaaa-0000-0000-0000-00000000000a', '{}') on conflict (user_id) do update set stats = excluded.stats$$, 'stats: nobody writes stats for someone else');

/* ---------- activity feed ---------- */
select t.ok(t.seen($$select 1 from public.activities where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$) = 0, 'feed: a stranger does not see your posts');
reset role;
select id as act from public.activities where ref = 'w-1' \gset
set role authenticated;
select t.login(:carol);
select t.fails(format($$insert into public.respects (activity_id, user_id) values (%L, auth.uid())$$, :'act'), 'feed: a stranger cannot react to your posts');
select t.fails(format($$insert into public.activity_comments (activity_id, user_id, body) values (%L, auth.uid(), 'hi')$$, :'act'), 'feed: a stranger cannot comment on your posts');
select t.fails($$insert into public.activities (user_id, ref, kind, data) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'fake', 'workout', '{}')$$, 'feed: nobody posts in someone else''s name');
select t.login(:bob);
select t.ok(t.seen($$select 1 from public.activities where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$) = 1, 'feed: a friend sees your posts');
select t.rows(format($$insert into public.respects (activity_id, user_id) values (%L, auth.uid())$$, :'act'), 1, 'feed: a friend gives Respect');
select t.rows(format($$insert into public.activity_comments (activity_id, user_id, body) values (%L, auth.uid(), 'nice')$$, :'act'), 1, 'feed: a friend comments');
select t.rows($$update public.activities set data = '{}' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'feed: a friend cannot edit your posts');
select t.rows($$delete from public.activities where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'feed: a friend cannot delete your posts');
select t.login(:alice);
select t.rows($$delete from public.activity_comments where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$, 1, 'feed: you can remove a comment left on your post');

/* ---------- photos: exercises and foods private, meals for friends (and everyone once shared) ---------- */
set role authenticated;
select t.login(:alice);
select t.rows($$insert into storage.objects (bucket_id, name) values
  ('photos', 'aaaaaaaa-0000-0000-0000-00000000000a/exercise/x1.jpg'),
  ('photos', 'aaaaaaaa-0000-0000-0000-00000000000a/food/f1.jpg'),
  ('photos', 'aaaaaaaa-0000-0000-0000-00000000000a/meal/m1.jpg'),
  ('photos', 'aaaaaaaa-0000-0000-0000-00000000000a/meal/m2.jpg')$$, 4, 'photos: a member adds photos in their own folder');
select t.fails($$insert into storage.objects (bucket_id, name) values ('photos', 'bbbbbbbb-0000-0000-0000-00000000000b/meal/m9.jpg')$$, 'photos: nobody adds a photo in someone else''s folder');
select t.fails($$insert into storage.objects (bucket_id, name) values ('photos', 'aaaaaaaa-0000-0000-0000-00000000000a/other/../x.jpg')$$, 'photos: only known kinds and plain file names');
select t.ok(t.seen($$select 1 from storage.objects where bucket_id = 'photos'$$) = 4, 'photos: the owner sees all their photos');
select t.login(:bob);
select t.ok(t.seen($$select name from storage.objects where bucket_id = 'photos'$$) = 2, 'photos: a friend sees meal photos only');
select t.rows($$delete from storage.objects where bucket_id = 'photos'$$, 0, 'photos: a friend cannot remove them');
select t.login(:carol);
select t.ok((select array_agg(name) from storage.objects where bucket_id = 'photos') = array['aaaaaaaa-0000-0000-0000-00000000000a/meal/m1.jpg'], 'photos: a stranger sees only the photo of a meal shared with the community');
select t.rows($$update storage.objects set name = 'cccccccc-0000-0000-0000-00000000000c/meal/m1.jpg' where bucket_id = 'photos'$$, 0, 'photos: a stranger cannot take a photo over');
select t.login(null);
select t.ok(t.seen($$select 1 from storage.objects$$) = 0, 'photos: nothing for signed-out visitors');

/* ---------- mutual friends, a friend's friends, suggestions ---------- */
-- Eve - Finn - Gus are friends in a chain (Eve and Gus do not know each other); Hal is a stranger.
reset role;
insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-00000000000e', 'eve@test.invalid'), ('f0000000-0000-0000-0000-00000000000f', 'finn@test.invalid'),
  ('90000000-0000-0000-0000-000000000009', 'gus@test.invalid'), ('a0000000-0000-0000-0000-0000000000a0', 'hal@test.invalid');
insert into public.profiles (user_id, username, display_name) values
  ('e0000000-0000-0000-0000-00000000000e', 'eve', 'Eve'), ('f0000000-0000-0000-0000-00000000000f', 'finn', 'Finn'),
  ('90000000-0000-0000-0000-000000000009', 'gus', 'Gus'), ('a0000000-0000-0000-0000-0000000000a0', 'hal', 'Hal');
insert into public.friendships (requester, addressee, status) values
  ('e0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-00000000000f', 'accepted'),
  ('f0000000-0000-0000-0000-00000000000f', '90000000-0000-0000-0000-000000000009', 'accepted');
set role authenticated;
select t.login('e0000000-0000-0000-0000-00000000000e');
select t.ok((select array_agg(username) from public.mutual_friends('90000000-0000-0000-0000-000000000009')) = array['finn'], 'mutual friends: Eve sees Finn in common with Gus');
select t.ok((select array_agg(username || ':' || link order by username) from public.friends_of('f0000000-0000-0000-0000-00000000000f')) = array['eve:me', 'gus:none'], 'friends of a friend: Eve sees Finn''s friends and where she stands');
select t.ok((select array_agg(username || ':' || mutual) from public.friend_suggestions()) = array['gus:1'], 'suggestions: friends of friends, with the number in common');
select t.ok(not exists (select 1 from public.friends_of('90000000-0000-0000-0000-000000000009')), 'friends of a friend: nothing for someone who is not your friend');
select t.fails($$select * from public.friend_ids('f0000000-0000-0000-0000-00000000000f')$$, 'friend lists: not readable directly');
select t.login('a0000000-0000-0000-0000-0000000000a0');
select t.ok(not exists (select 1 from public.mutual_friends('f0000000-0000-0000-0000-00000000000f')), 'mutual friends: a stranger learns nothing (no friends in common)');
select t.ok(not exists (select 1 from public.friends_of('f0000000-0000-0000-0000-00000000000f')) and not exists (select 1 from public.friend_suggestions()), 'a stranger sees no friend list and no suggestion');
-- Finn hides his friend list: it disappears from his friends' screens and from suggestions.
select t.login('f0000000-0000-0000-0000-00000000000f');
update public.profiles set show_friends = false where user_id = auth.uid();
select t.login('e0000000-0000-0000-0000-00000000000e');
select t.ok(not exists (select 1 from public.friends_of('f0000000-0000-0000-0000-00000000000f')) and not exists (select 1 from public.friend_suggestions()), 'hidden list: no friends shown, no suggestion through Finn');
select t.ok((select count(*) from public.mutual_friends('90000000-0000-0000-0000-000000000009')) = 1, 'hidden list: mutual friends still shown (Eve already knows Finn)');
select t.login(null);
set role anon;
select t.fails($$select * from public.friend_suggestions()$$, 'signed out: no suggestions');
select t.fails($$select * from public.mutual_friends('f0000000-0000-0000-0000-00000000000f')$$, 'signed out: no mutual friends');
set role authenticated;

/* ---------- shared meals and community foods: readable by members, owned by their author ---------- */
select t.login(:carol);
select t.ok(t.seen($$select 1 from public.shared_meals$$) = 1, 'shared meals: members read them');
select t.rows($$update public.shared_meals set name = 'x' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'shared meals: nobody changes another member''s meal');
select t.rows($$delete from public.shared_meals where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'shared meals: nobody deletes another member''s meal');
select t.fails($$insert into public.shared_meals (user_id, meal_id, name, items) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'x', 'x', '[{}]')$$, 'shared meals: nobody shares in someone else''s name');
select t.ok(t.seen($$select 1 from public.community_foods$$) = 1, 'community foods: members read them');
select t.rows($$update public.community_foods set kcal = 1 where id = 'f-alice'$$, 0, 'community foods: nobody changes another member''s food');
select t.fails($$insert into public.community_foods (id, user_id, name, kcal) values ('f-x', 'aaaaaaaa-0000-0000-0000-00000000000a', 'x', 1)$$, 'community foods: nobody adds in someone else''s name');

/* ---------- shared meals: the author comes from the profile ---------- */
select t.login(:bob);
insert into public.shared_meals (user_id, meal_id, author, name, items) values (auth.uid(), 'b1', 'Alice', 'Pasta', '[{"name":"pasta"}]');
select t.ok((select author from public.shared_meals where meal_id = 'b1') = 'Bob', 'shared meals: a made-up author name is replaced by the profile name');
update public.profiles set display_name = 'Bobby' where user_id = auth.uid();
select t.ok((select author from public.shared_meals where meal_id = 'b1') = 'Bobby', 'shared meals: renaming yourself updates your shared meals');

/* ---------- community foods: at most 30 new ones a day per member ---------- */
select t.login(:bob);
do $$ begin for i in 1..30 loop insert into public.community_foods (id, user_id, name, kcal) values ('bob-' || i, auth.uid(), 'Food ' || i, 100); end loop; end $$;
select t.fails($$insert into public.community_foods (id, user_id, name, kcal) values ('bob-31', auth.uid(), 'One too many', 100)$$, 'community foods: the 31st food of the day is refused');
select t.rows($$insert into public.community_foods (id, user_id, name, kcal) values ('bob-1', auth.uid(), 'Food 1 fixed', 110) on conflict (id) do update set name = excluded.name, kcal = excluded.kcal$$, 1, 'community foods: editing one of your foods still works at the limit');

/* ---------- stats: plausible values only ---------- */
select t.login(:alice);
select t.rows($$update public.public_stats set stats = '{"v":1,"week":0,"weekDays":4,"weekWorkouts":5,"weekSets":80,"weekVolume":24000,"weekMinutes":300,"avgDays4w":3.5,"streak":12,"prs30":6,"strength4w":2.5,"totalWorkouts":180,"lastWorkoutAt":null,"lifts":{},"level":14,"periods":{"30":{"days":14,"sets":330,"volume":95000,"prs":6,"strength":2.5,"goals":75,"cardio":120,"cardioKm":20}}}' where user_id = auth.uid()$$, 1, 'stats: a heavy but real week is accepted');
\set sample `cat supabase/tests/sample_stats.json`
select t.rows(format($$update public.public_stats set stats = %L where user_id = auth.uid()$$, :'sample'), 1, 'stats: what the app publishes for a real-looking account is accepted');
select t.fails($$update public.public_stats set stats = '{"v":1,"weekDays":9}' where user_id = auth.uid()$$, 'stats: more than 7 training days in a week is refused');
select t.fails($$update public.public_stats set stats = '{"v":1,"streak":5000}' where user_id = auth.uid()$$, 'stats: an impossible streak is refused');
select t.fails($$update public.public_stats set stats = '{"v":1,"periods":{"30":{"days":45}}}' where user_id = auth.uid()$$, 'stats: 45 training days in 30 days is refused');
select t.fails($$update public.public_stats set stats = '{"v":1,"level":"99"}' where user_id = auth.uid()$$, 'stats: numbers must be numbers');

/* ---------- identity columns never change, even on your own rows ---------- */
select t.login(:alice);
select t.fails($$update public.shared_meals set meal_id = 'other' where user_id = auth.uid()$$, 'identity: a shared meal keeps its id');
select t.fails($$update public.community_foods set id = 'other' where user_id = auth.uid()$$, 'identity: a community food keeps its id');
select t.fails($$update public.community_foods set uses = 9999 where user_id = auth.uid()$$, 'identity: members cannot inflate a food''s use count');
select t.fails($$update public.community_foods set user_id = null where user_id = auth.uid()$$, 'identity: members cannot detach their food from their account');
select t.fails($$update public.activities set ref = 'other' where user_id = auth.uid()$$, 'identity: a post keeps its reference');
-- The app's own writes (upserts that resend the key) still work.
select t.rows($$insert into public.profiles (user_id, username, display_name) values (auth.uid(), 'alice', 'Alice B') on conflict (user_id) do update set user_id = excluded.user_id, username = excluded.username, display_name = excluded.display_name$$, 1, 'identity: the app''s profile upsert still works');
select t.rows($$insert into public.public_stats (user_id, stats) values (auth.uid(), '{"v":1}') on conflict (user_id) do update set user_id = excluded.user_id, stats = excluded.stats$$, 1, 'identity: the app''s stats upsert still works');
select t.rows($$insert into public.shared_meals (user_id, meal_id, name, items) values (auth.uid(), 'm1', 'Bowl 2', '[{"name":"rice"}]') on conflict (user_id, meal_id) do update set user_id = excluded.user_id, meal_id = excluded.meal_id, name = excluded.name$$, 1, 'identity: the app''s shared meal upsert still works');
select t.rows($$update public.user_state set data = '{"workouts":[1]}', updated_at = now() where user_id = auth.uid()$$, 1, 'identity: syncing your own data still works');

/* ---------- sync v2: user_items (owner only, server time) and entitlements ---------- */
select t.login(:bob);
select t.rows($$insert into public.user_items (kind, id, data) values ('workout', 'w1', '{"name":"Push"}')$$, 1, 'items: you write your own items');
select t.ok((select updated_at > now() - interval '1 minute' from public.user_items where id = 'w1'), 'items: the server sets the time');
select t.rows($$insert into public.user_items (kind, id, data, updated_at) values ('workout', 'w2', '{}', '2000-01-01') on conflict do nothing$$, 1, 'items: a time sent by the phone ...');
select t.ok((select updated_at > '2001-01-01' from public.user_items where id = 'w2'), '... is replaced by the server time');
select t.rows($$update public.user_items set deleted = true, data = '{"secret":1}' where id = 'w2'$$, 1, 'items: a deletion is kept as a marker');
select t.ok((select data is null from public.user_items where id = 'w2'), 'items: a deleted item keeps no data');
select t.rows($$delete from public.user_items where id = 'w1'$$, 0, 'items: rows are never deleted by the app (deletions are markers)');
select t.fails($$update public.user_items set kind = 'routine' where id = 'w1'$$, 'items: an item keeps its kind and id');
select t.fails($$insert into public.user_items (user_id, kind, id, data) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'workout', 'x', '{}')$$, 'items: nobody writes items for someone else');
select t.login(:carol);
select t.ok(t.seen($$select 1 from public.user_items$$) = 0, 'items: nobody reads another account''s items');
select t.rows($$update public.user_items set data = '{}' where id = 'w1'$$, 0, 'items: nobody changes another account''s items');
select t.fails($$insert into public.entitlements (user_id, plan) values (auth.uid(), 'pro')$$, 'entitlements: members cannot give themselves Pro');
reset role;
insert into public.entitlements (user_id, plan, source) values (:carol, 'pro', 'manual');
set role authenticated;
select t.login(:carol);
select t.fails($$update public.entitlements set expires_at = '2100-01-01' where user_id = auth.uid()$$, 'entitlements: members cannot extend their access');
select t.ok((select plan from public.entitlements where user_id = auth.uid()) = 'pro', 'entitlements: members read their own access');
select t.login(:bob);
select t.ok(t.seen($$select 1 from public.entitlements$$) = 0, 'entitlements: nobody reads another account''s access');
-- Old single-block copy frozen once the account moved to sync v2.
select t.rows($$update public.user_state set data = '{"v":1}' where user_id = auth.uid()$$, 1, 'sync v1: still writable before the move');
insert into public.user_items (kind, id, data) values ('meta', 'migrated', '{}');
select t.fails($$update public.user_state set data = '{"v":2}' where user_id = auth.uid()$$, 'sync v1: frozen after the move (an old app cannot overwrite)');

/* ---------- feedback and reports: write-only ---------- */
select t.ok(t.seen($$select 1 from public.feedback$$) = 0, 'feedback: nobody reads messages');
select t.fails($$insert into public.feedback (user_id, email, kind, message) values (auth.uid(), 'someone@else.invalid', 'idea', 'x')$$, 'feedback: the email must be your own');
select t.rows($$insert into public.content_reports (kind, target, reason) values ('food', 'f-alice', 'wrong_values')$$, 1, 'reports: a member can report');
select t.ok(t.seen($$select 1 from public.content_reports$$) = 0, 'reports: nobody reads reports');
select t.fails($$insert into public.content_reports (reporter, kind, target, reason) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'food', 'f2', 'spam')$$, 'reports: nobody reports in someone else''s name');

/* ---------- signed-out visitors and admin views ---------- */
reset role;
set role anon;
select t.login(null);
select t.ok(
  t.seen('select 1 from public.user_state') + t.seen('select 1 from public.profiles') + t.seen('select 1 from public.public_stats')
  + t.seen('select 1 from public.activities') + t.seen('select 1 from public.shared_meals') + t.seen('select 1 from public.community_foods')
  + t.seen('select 1 from public.friendships') = 0, 'signed out: nothing is readable');
reset role;
set role authenticated;
select t.login(:alice);
select t.fails('select * from admin.users', 'admin views: members cannot read them');
select t.fails($$select * from admin.account_for_email('bob@test.invalid')$$, 'admin views: members cannot look up accounts by email');
select t.fails('select * from admin.adoption', 'admin views: members cannot read the adoption numbers');
select t.fails('select * from admin.purge_expired()', 'retention: members cannot run the purge');
select t.fails('select * from admin.reports', 'admin views: members cannot read the reports');

/* ---------- account deletion ---------- */
select t.login(:alice);
select public.delete_my_account();
reset role;
select t.ok((select count(*) from public.user_state where user_id = :alice) = 0, 'delete account: synced data is gone');
select t.ok((select count(*) from public.feedback where email like 'aaaaaaaa%') = 0, 'delete account: contact messages are gone');
select t.ok((select count(*) from public.friendships where :alice in (requester, addressee)) = 0, 'delete account: friendships are gone');
select t.ok((select user_id from public.community_foods where id = 'f-alice') is null, 'delete account: shared foods stay, without a link to the person');

select t.ok((select count(*) from admin.reports) >= 1, 'admin views: the owner sees the reports');
select t.ok(not exists (select 1 from information_schema.columns where table_schema = 'admin' and column_name in ('email', 'name', 'kg', 'kcal')), 'admin views: no email, name, weight or calories');
select t.ok((select username from admin.account_for_email('BOB@test.invalid')) = 'bob', 'admin views: support can find an account by email');
insert into public.feedback (user_id, email, kind, message, created_at) values (:bob, 'bob@test.invalid', 'idea', 'old', now() - interval '13 months');
alter table public.user_items disable trigger stamp;
update public.user_items set deleted = true, data = null, updated_at = now() - interval '200 days' where user_id = :bob and id = 'w1';
alter table public.user_items enable trigger stamp;
select t.ok((select deleted from admin.purge_expired() where what like 'contact%') = 1, 'retention: contact messages older than 12 months are purged');
update auth.users set last_sign_in_at = now() - interval '25 months', created_at = now() - interval '30 months' where id = :carol;
update public.user_state set updated_at = now() - interval '25 months' where user_id = :carol;
select t.ok((select count(*) from admin.inactive_accounts where username = 'carol') = 1, 'retention: accounts inactive for 24 months are listed');
select t.ok(not exists (select 1 from public.user_items where id = 'w1') and exists (select 1 from public.user_items where id = 'w2'), 'retention: only deletion markers older than 180 days are purged');

/* ---------- sync v2 rollback: folding the rows gives back exactly the v1 state ---------- */
reset role;
\set dave '''dddddddd-0000-0000-0000-00000000000d'''
insert into auth.users (id, email) values (:dave, 'dave@test.invalid');
insert into public.user_state (user_id, data) values (:dave, '{}');
\set fixture `cat supabase/tests/sync_fixture.json`
insert into public.user_items (user_id, kind, id, data)
  select :dave, r.kind, r.id, r.data from jsonb_to_recordset((:'fixture'::jsonb) -> 'rows') as r(kind text, id text, data jsonb);
insert into public.user_items (user_id, kind, id, data) values (:dave, 'meta', 'migrated', '{}');
select t.ok(admin.fold_items(:dave) = (:'fixture'::jsonb) -> 'expected', 'rollback: the rows fold back into exactly the same state');
insert into public.user_items (user_id, kind, id, data, deleted) values (:dave, 'workout', 'w1', null, true)
  on conflict (user_id, kind, id) do update set deleted = true;
select t.ok(jsonb_array_length(admin.fold_items(:dave) -> 'workouts') = 1, 'rollback: deleted items stay deleted');
select admin.rollback_to_v1(:dave);
select t.ok((select jsonb_array_length(data -> 'workouts') from public.user_state where user_id = :dave) = 1, 'rollback: the single block is rebuilt');
select t.ok(not exists (select 1 from public.user_items where user_id = :dave and kind = 'meta' and id = 'migrated'), 'rollback: the account is unfrozen');

\echo 'All access-rule checks passed.'
