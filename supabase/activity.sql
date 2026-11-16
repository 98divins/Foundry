-- Foundry activity feed: run once in Supabase → SQL Editor → New query → Run (after social.sql).
-- Safe to run again. Friends see each other's finished workouts (a summary), level-ups and badges,
-- can give "Respect" and leave short comments. Only friends can read them.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The app's own id for what happened (workout id, "level-12"…), so publishing twice does not duplicate.
  ref text not null check (char_length(ref) <= 80),
  kind text not null check (kind in ('workout', 'level', 'badge')),
  data jsonb not null check (pg_column_size(data) < 4000),
  created_at timestamptz not null default now(),
  unique (user_id, ref)
);
create index if not exists activities_recent on public.activities (created_at desc);

create table if not exists public.respects (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists activity_comments_by_activity on public.activity_comments (activity_id, created_at);

-- Who may see an activity: its author and the author's friends.
create or replace function public.can_see_activity(a uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from activities x where x.id = a and (x.user_id = auth.uid() or public.is_friend(x.user_id)));
$$;
revoke all on function public.can_see_activity(uuid) from public, anon;
grant execute on function public.can_see_activity(uuid) to authenticated;

alter table public.activities enable row level security;
alter table public.respects enable row level security;
alter table public.activity_comments enable row level security;

drop policy if exists "activities: read own and friends" on public.activities;
drop policy if exists "activities: write own" on public.activities;
drop policy if exists "activities: update own" on public.activities;
drop policy if exists "activities: delete own" on public.activities;
create policy "activities: read own and friends" on public.activities for select using (user_id = auth.uid() or public.is_friend(user_id));
create policy "activities: write own" on public.activities for insert with check (user_id = auth.uid());
create policy "activities: update own" on public.activities for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "activities: delete own" on public.activities for delete using (user_id = auth.uid());

drop policy if exists "respects: read visible" on public.respects;
drop policy if exists "respects: give" on public.respects;
drop policy if exists "respects: take back" on public.respects;
create policy "respects: read visible" on public.respects for select using (public.can_see_activity(activity_id));
create policy "respects: give" on public.respects for insert with check (user_id = auth.uid() and public.can_see_activity(activity_id));
create policy "respects: take back" on public.respects for delete using (user_id = auth.uid());

drop policy if exists "comments: read visible" on public.activity_comments;
drop policy if exists "comments: write" on public.activity_comments;
drop policy if exists "comments: delete own or on mine" on public.activity_comments;
create policy "comments: read visible" on public.activity_comments for select using (public.can_see_activity(activity_id));
create policy "comments: write" on public.activity_comments for insert with check (user_id = auth.uid() and public.can_see_activity(activity_id));
-- You can delete your comments, and any comment on your own activity.
create policy "comments: delete own or on mine" on public.activity_comments for delete
  using (user_id = auth.uid() or exists (select 1 from public.activities x where x.id = activity_id and x.user_id = auth.uid()));
