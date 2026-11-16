-- Foundry gear and public profiles: run once in Supabase → SQL Editor → New query → Run
-- (after social.sql). Safe to run again.

alter table public.profiles add column if not exists gear jsonb not null default '{}'::jsonb check (pg_column_size(gear) < 6000);
alter table public.profiles add column if not exists is_public boolean not null default false;
alter table public.profiles add column if not exists bio text not null default '' check (char_length(bio) <= 160);

-- A profile page by username: the profile, its gear and its shared stats.
-- Visible to its owner, to friends, and to any signed-in member when the profile is public.
create or replace function public.profile_page(name text)
returns table (user_id uuid, username text, display_name text, avatar text, bio text, gear jsonb, is_public boolean, stats jsonb, stats_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar, p.bio, p.gear, p.is_public, s.stats, s.updated_at
  from profiles p
  left join public_stats s on s.user_id = p.user_id
  where p.username = lower(trim(name))
    and (p.is_public or p.user_id = auth.uid() or public.is_friend(p.user_id))
  limit 1;
$$;
revoke all on function public.profile_page(text) from public, anon;
grant execute on function public.profile_page(text) to authenticated;
