-- Adoption dashboard: how people use the app once installed. Run once in Supabase → SQL Editor
-- (after admin.sql; safe to run again). Everything is computed live from the synced data, in the
-- private "admin" schema that only you can read from the dashboard.
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- One row per account and day it was used: a workout, a food logged or a weigh-in.
create or replace view admin.active_days as
select s.user_id, d.day, d.what
from public.user_state s
cross join lateral (
  select (to_timestamp((w ->> 'startedAt')::bigint / 1000.0) at time zone 'Europe/Paris')::date as day, 'workout' as what
  from jsonb_array_elements(coalesce(s.data -> 'workouts', '[]'::jsonb)) w
  where w ->> 'endedAt' is not null
  union
  select (e ->> 'date')::date, 'food'
  from jsonb_array_elements(coalesce(s.data -> 'nutrition' -> 'log', '[]'::jsonb)) e
  where coalesce((e ->> 'planned')::boolean, false) = false
  union
  select (x ->> 'date')::date, 'weight'
  from jsonb_array_elements(coalesce(s.data -> 'nutrition' -> 'weights', '[]'::jsonb)) x
) d;

-- The headline numbers.
create or replace view admin.adoption as
with u as (
  select u.id, u.created_at::date as signed_up from auth.users u
),
a as (select distinct user_id, day from admin.active_days)
select
  (select count(*) from u) as accounts,
  (select count(*) from u where signed_up >= current_date - 7) as new_last_7_days,
  (select count(distinct user_id) from a) as activated,
  round(100.0 * (select count(distinct user_id) from a) / nullif((select count(*) from u), 0), 1) as activated_pct,
  (select count(distinct user_id) from a where day > current_date - 7) as active_last_7_days,
  (select count(distinct user_id) from a where day > current_date - 30) as active_last_30_days,
  -- Week-2 retention: of the accounts older than 14 days, how many were used between day 7 and 13.
  round(100.0 * (
    select count(distinct u.id) from u join a on a.user_id = u.id
    where u.signed_up <= current_date - 14 and a.day between u.signed_up + 7 and u.signed_up + 13
  ) / nullif((select count(*) from u where signed_up <= current_date - 14), 0), 1) as week2_retention_pct;

-- Weekly cohorts: of the people who signed up a given week, % still using the app 1, 2, 3, 4 weeks later.
create or replace view admin.cohorts as
with u as (
  select u.id, date_trunc('week', u.created_at)::date as cohort, u.created_at::date as signed_up from auth.users u
),
a as (select distinct user_id, day from admin.active_days)
select
  cohort as week_of_signup,
  count(*) as signups,
  round(100.0 * count(*) filter (where exists (select 1 from a where a.user_id = u.id)) / count(*), 0) as used_pct,
  round(100.0 * count(*) filter (where exists (select 1 from a where a.user_id = u.id and a.day between u.signed_up + 7 and u.signed_up + 13)) / count(*), 0) as week1_pct,
  round(100.0 * count(*) filter (where exists (select 1 from a where a.user_id = u.id and a.day between u.signed_up + 14 and u.signed_up + 20)) / count(*), 0) as week2_pct,
  round(100.0 * count(*) filter (where exists (select 1 from a where a.user_id = u.id and a.day between u.signed_up + 21 and u.signed_up + 27)) / count(*), 0) as week3_pct,
  round(100.0 * count(*) filter (where exists (select 1 from a where a.user_id = u.id and a.day between u.signed_up + 28 and u.signed_up + 34)) / count(*), 0) as week4_pct
from u
group by cohort
order by cohort desc;

-- Which features people actually use (number and % of accounts).
create or replace view admin.features as
with s as (select user_id, data from public.user_state),
n as (select count(*)::numeric as total from s),
f as (
  select 'Workouts logged' as feature, count(*) filter (where jsonb_array_length(coalesce(data -> 'workouts', '[]')) > 0) as users from s
  union all select 'Routines created', count(*) filter (where jsonb_array_length(coalesce(data -> 'routines', '[]')) > 0) from s
  union all select 'Interval routines', count(*) filter (where jsonb_path_exists(data, '$.routines[*].interval')) from s
  union all select 'Folders', count(*) filter (where jsonb_array_length(coalesce(data -> 'folders', '[]')) > 0) from s
  union all select 'Custom exercises', count(*) filter (where jsonb_array_length(coalesce(data -> 'customExercises', '[]')) > 0) from s
  union all select 'Nutrition plan set', count(*) filter (where data -> 'nutrition' -> 'profile' is not null and data -> 'nutrition' -> 'profile' <> 'null') from s
  union all select 'Food logged', count(*) filter (where jsonb_array_length(coalesce(data -> 'nutrition' -> 'log', '[]')) > 0) from s
  union all select 'Saved meals', count(*) filter (where jsonb_array_length(coalesce(data -> 'nutrition' -> 'savedMeals', '[]')) > 0) from s
  union all select 'Meals planned ahead', count(*) filter (where jsonb_path_exists(data, '$.nutrition.log[*] ? (@.planned == true)')) from s
  union all select 'Weigh-ins', count(*) filter (where jsonb_array_length(coalesce(data -> 'nutrition' -> 'weights', '[]')) > 0) from s
  union all select 'Weekly check-ins', count(*) filter (where jsonb_array_length(coalesce(data -> 'nutrition' -> 'checkIns', '[]')) > 0) from s
  union all select 'Weekly goals', count(*) filter (where data -> 'goals' is not null and data -> 'goals' <> 'null') from s
  union all select 'Profile photo', count(*) filter (where coalesce(data -> 'profile' ->> 'avatar', '') <> '') from s
  union all select 'Gear filled in', count(*) filter (where jsonb_typeof(data -> 'profile' -> 'gear') = 'object' and data -> 'profile' -> 'gear' <> '{}') from s
  union all select 'Username (Friends)', (select count(*) from public.profiles)
  union all select 'At least one friend', (select count(distinct x) from public.friendships, lateral (values (requester), (addressee)) v(x) where status = 'accepted')
  union all select 'Posted in the feed', (select count(distinct user_id) from public.activities)
  union all select 'Gave a Respect', (select count(distinct user_id) from public.respects)
  union all select 'Shared a meal', (select count(distinct user_id) from public.shared_meals)
)
select feature, users, round(100 * users / nullif((select total from n), 0), 0) as pct_of_accounts from f;

-- Activity per day over the last 60 days (for a quick chart).
create or replace view admin.daily as
select day, count(distinct user_id) as active_users,
  count(distinct user_id) filter (where what = 'workout') as trained,
  count(distinct user_id) filter (where what = 'food') as logged_food
from admin.active_days
where day > current_date - 60 and day <= current_date
group by day order by day desc;

revoke all on all tables in schema admin from public, anon, authenticated;
