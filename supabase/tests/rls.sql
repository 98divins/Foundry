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

/* ---------- shared meals and community foods: readable by members, owned by their author ---------- */
select t.login(:carol);
select t.ok(t.seen($$select 1 from public.shared_meals$$) = 1, 'shared meals: members read them');
select t.rows($$update public.shared_meals set name = 'x' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'shared meals: nobody changes another member''s meal');
select t.rows($$delete from public.shared_meals where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 0, 'shared meals: nobody deletes another member''s meal');
select t.fails($$insert into public.shared_meals (user_id, meal_id, name, items) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'x', 'x', '[{}]')$$, 'shared meals: nobody shares in someone else''s name');
select t.ok(t.seen($$select 1 from public.community_foods$$) = 1, 'community foods: members read them');
select t.rows($$update public.community_foods set kcal = 1 where id = 'f-alice'$$, 0, 'community foods: nobody changes another member''s food');
select t.fails($$insert into public.community_foods (id, user_id, name, kcal) values ('f-x', 'aaaaaaaa-0000-0000-0000-00000000000a', 'x', 1)$$, 'community foods: nobody adds in someone else''s name');

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
select t.fails('select * from admin.adoption', 'admin views: members cannot read the adoption numbers');

/* ---------- account deletion ---------- */
select t.login(:alice);
select public.delete_my_account();
reset role;
select t.ok((select count(*) from public.user_state where user_id = :alice) = 0, 'delete account: synced data is gone');
select t.ok((select count(*) from public.feedback where email like 'aaaaaaaa%') = 0, 'delete account: contact messages are gone');
select t.ok((select count(*) from public.friendships where :alice in (requester, addressee)) = 0, 'delete account: friendships are gone');
select t.ok((select user_id from public.community_foods where id = 'f-alice') is null, 'delete account: shared foods stay, without a link to the person');

\echo 'All access-rule checks passed.'
