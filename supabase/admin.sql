-- Admin view: one row per account, to identify people in the dashboard. Run once in
-- Supabase → SQL Editor (safe to run again). It lives in a separate "admin" schema that the app's
-- API does not expose, and the app's roles have no access: only you, in the dashboard, can read it.
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create or replace view admin.users as
select
  u.id as user_id,
  u.email,
  s.data -> 'profile' ->> 'name' as name,
  p.username,
  p.display_name,
  u.created_at as signed_up_at,
  u.last_sign_in_at,
  s.updated_at as last_sync_at,
  jsonb_array_length(coalesce(s.data -> 'workouts', '[]'::jsonb)) as workouts,
  jsonb_array_length(coalesce(s.data -> 'routines', '[]'::jsonb)) as routines,
  jsonb_array_length(coalesce(s.data -> 'nutrition' -> 'log', '[]'::jsonb)) as foods_logged,
  s.data -> 'settings' ->> 'appLang' as language,
  (select count(*) from public.friendships f where f.status = 'accepted' and u.id in (f.requester, f.addressee)) as friends
from auth.users u
left join public.user_state s on s.user_id = u.id
left join public.profiles p on p.user_id = u.id
order by u.created_at desc;

revoke all on admin.users from public, anon, authenticated;
