-- Foundry: run once in Supabase → SQL Editor → New query → Run.
-- One row per user holding the app data as JSON. Row Level Security: each user only sees theirs.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "own row: read" on public.user_state;
drop policy if exists "own row: insert" on public.user_state;
drop policy if exists "own row: update" on public.user_state;
drop policy if exists "own row: delete" on public.user_state;

create policy "own row: read" on public.user_state for select using (auth.uid() = user_id);
create policy "own row: insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "own row: update" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row: delete" on public.user_state for delete using (auth.uid() = user_id);

-- Account deletion from inside the app (required by the App Store). Deleting the auth user
-- also deletes their data row (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
