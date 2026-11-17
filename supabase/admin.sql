-- Admin view: one row per account, to follow how the app is used. Run once in Supabase → SQL Editor
-- (safe to run again). It lives in a separate "admin" schema that the app's API does not expose,
-- and the app's roles have no access: only you, in the dashboard, can read it.
-- Counts only: no email, no name, no weight or calories (see the privacy policy). To find the
-- account behind an email for a support request, use: select * from admin.account_for_email('…');
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

drop view if exists admin.users;
create view admin.users as
select
  u.id as user_id,
  p.username,
  u.created_at::date as signed_up_on,
  u.last_sign_in_at::date as last_sign_in_on,
  s.updated_at::date as last_sync_on,
  jsonb_array_length(coalesce(s.data -> 'workouts', '[]'::jsonb)) as workouts,
  jsonb_array_length(coalesce(s.data -> 'routines', '[]'::jsonb)) as saved_workouts,
  jsonb_array_length(coalesce(s.data -> 'nutrition' -> 'log', '[]'::jsonb)) as foods_logged,
  s.data -> 'settings' ->> 'appLang' as language,
  (select count(*) from public.friendships f where f.status = 'accepted' and u.id in (f.requester, f.addressee)) as friends
from auth.users u
left join public.user_state s on s.user_id = u.id
left join public.profiles p on p.user_id = u.id
order by u.created_at desc;

-- Support only: the account behind an email address someone wrote from.
create or replace function admin.account_for_email(addr text)
returns table (user_id uuid, username text, signed_up_on date)
language sql stable security definer set search_path = public, auth as $$
  select u.id, p.username, u.created_at::date
  from auth.users u left join public.profiles p on p.user_id = u.id
  where lower(u.email) = lower(trim(addr));
$$;

revoke all on admin.users from public, anon, authenticated;
revoke all on function admin.account_for_email(text) from public, anon, authenticated;
