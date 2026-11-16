-- Foundry security hardening. Run once in Supabase → SQL Editor, AFTER every other file in this
-- folder (schema, social, gear, activity, shared_meals, community_foods, feedback). Safe to run again.

-- 1. Friendships: accepting a request may only change its status.
--    Before this, the "accept" policy let the addressee rewrite `requester` too, and so become the
--    "friend" of any account without its consent (and read its stats, feed and profile).
--    Row Level Security decides WHICH rows; column privileges decide WHICH columns.
revoke update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;

-- 2. Account deletion erases every personal trace, including messages sent through "Contact us"
--    (they hold the email address and free text). Foods added to the shared database stay, with no
--    link to the person (user_id is set to null by the foreign key).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if to_regclass('public.feedback') is not null then
    delete from public.feedback where user_id = auth.uid();
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 3. Shared meals: plausible numbers only (rows written before this are left alone: "not valid").
alter table public.shared_meals drop constraint if exists shared_meals_plausible;
alter table public.shared_meals add constraint shared_meals_plausible
  check (kcal between 0 and 10000 and protein between 0 and 1000 and carbs between 0 and 2000 and fat between 0 and 1000) not valid;

-- 4. Reports: any member can flag a shared food, meal, comment or profile. Members can only add
--    their own reports and cannot read anyone's; read them in Table Editor → content_reports.
create table if not exists public.content_reports (
  id bigint generated always as identity primary key,
  reporter uuid references auth.users (id) on delete set null default auth.uid(),
  kind text not null check (kind in ('food', 'meal', 'comment', 'activity', 'profile')),
  -- The id of what is reported (food id, "user_id/meal_id", comment id, username…).
  target text not null check (char_length(target) between 1 and 200),
  reason text not null check (reason in ('wrong_values', 'inappropriate', 'spam', 'impersonation', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  unique (reporter, kind, target)
);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant insert (kind, target, reason, details) on public.content_reports to authenticated;
drop policy if exists "reports: send own" on public.content_reports;
create policy "reports: send own" on public.content_reports for insert to authenticated with check (reporter = auth.uid());
