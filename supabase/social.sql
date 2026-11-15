-- Foundry social features: run once in Supabase → SQL Editor → New query → Run (after schema.sql).
-- Safe to run again. What friends can see is a small summary of training stats, never the full data.

-- Public profile: the username friends find you by, a display name and a small picture.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  avatar text check (avatar is null or char_length(avatar) <= 20000),
  updated_at timestamptz not null default now()
);

-- Friend requests and friendships. One row per pair, whoever asked first.
create table if not exists public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_one_per_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

-- Training summary shared with friends (computed by the app; no workouts, no nutrition).
create table if not exists public.public_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stats jsonb not null check (pg_column_size(stats) < 8000),
  updated_at timestamptz not null default now()
);

-- Helpers for the access rules (security definer: they read friendships whatever the caller sees).
create or replace function public.is_friend(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = auth.uid() and addressee = other) or (addressee = auth.uid() and requester = other))
  );
$$;

create or replace function public.is_connected(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where (requester = auth.uid() and addressee = other) or (addressee = auth.uid() and requester = other)
  );
$$;

-- Find one person by exact username (no listing of all users).
create or replace function public.find_profile(name text)
returns table (user_id uuid, username text, display_name text, avatar text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar from profiles p where p.username = lower(trim(name)) limit 1;
$$;

revoke all on function public.is_friend(uuid) from public, anon;
revoke all on function public.is_connected(uuid) from public, anon;
revoke all on function public.find_profile(text) from public, anon;
grant execute on function public.is_friend(uuid) to authenticated;
grant execute on function public.is_connected(uuid) to authenticated;
grant execute on function public.find_profile(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.public_stats enable row level security;

drop policy if exists "profiles: read own and connected" on public.profiles;
drop policy if exists "profiles: write own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: delete own" on public.profiles;
create policy "profiles: read own and connected" on public.profiles for select using (user_id = auth.uid() or public.is_connected(user_id));
create policy "profiles: write own" on public.profiles for insert with check (user_id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles: delete own" on public.profiles for delete using (user_id = auth.uid());

drop policy if exists "friendships: read mine" on public.friendships;
drop policy if exists "friendships: ask" on public.friendships;
drop policy if exists "friendships: accept" on public.friendships;
drop policy if exists "friendships: remove" on public.friendships;
create policy "friendships: read mine" on public.friendships for select using (auth.uid() in (requester, addressee));
create policy "friendships: ask" on public.friendships for insert with check (requester = auth.uid() and status = 'pending');
create policy "friendships: accept" on public.friendships for update using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
create policy "friendships: remove" on public.friendships for delete using (auth.uid() in (requester, addressee));

drop policy if exists "stats: read own and friends" on public.public_stats;
drop policy if exists "stats: write own" on public.public_stats;
drop policy if exists "stats: update own" on public.public_stats;
drop policy if exists "stats: delete own" on public.public_stats;
create policy "stats: read own and friends" on public.public_stats for select using (user_id = auth.uid() or public.is_friend(user_id));
create policy "stats: write own" on public.public_stats for insert with check (user_id = auth.uid());
create policy "stats: update own" on public.public_stats for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "stats: delete own" on public.public_stats for delete using (user_id = auth.uid());

-- Live updates in the Friends tab (new requests, accepted invitations).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
