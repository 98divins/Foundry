-- Foundry sync v2 (docs/SYNC_V2.md, 3.2 and 3.5). Run once in Supabase → SQL Editor, after
-- schema.sql and guards.sql (safe to run again). Nothing uses these tables until the app switches
-- an account to sync v2.

-- One row per item of a member's data (a workout, a food logged, a weigh-in, the settings…).
create table if not exists public.user_items (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind ~ '^[a-z]{2,20}$'),
  id text not null check (char_length(id) between 1 and 120),
  data jsonb check (data is null or pg_column_size(data) < 200000),
  deleted boolean not null default false,
  -- Set by the server on every write (never by the phone), so devices agree on what is newer.
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);
create index if not exists user_items_changes on public.user_items (user_id, updated_at);

create or replace function public.user_items_stamp()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  if new.deleted then new.data := null; end if;
  return new;
end;
$$;
drop trigger if exists stamp on public.user_items;
create trigger stamp before insert or update on public.user_items
  for each row execute function public.user_items_stamp();

drop trigger if exists keep_identity on public.user_items;
create trigger keep_identity before update on public.user_items
  for each row execute function public.keep_identity('user_id', 'kind', 'id');

alter table public.user_items enable row level security;
drop policy if exists "items: read own" on public.user_items;
drop policy if exists "items: write own" on public.user_items;
drop policy if exists "items: update own" on public.user_items;
create policy "items: read own" on public.user_items for select using (user_id = auth.uid());
create policy "items: write own" on public.user_items for insert with check (user_id = auth.uid());
create policy "items: update own" on public.user_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No delete: a deletion is a row with deleted = true, so other devices learn about it.

-- Once an account has moved to sync v2, the old single-block copy is frozen (kept 30 days to go back).
create or replace function public.user_state_frozen()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.user_items where user_id = old.user_id and kind = 'meta' and id = 'migrated') then
    raise exception 'This account uses the new sync. Update the app.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists frozen on public.user_state;
create trigger frozen before update on public.user_state
  for each row execute function public.user_state_frozen();

-- Pro access, decided by the server (in-app purchases later). Members read their own row only;
-- only the service role (server side) can write it.
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free', 'pro')),
  source text not null default 'manual' check (source in ('manual', 'beta', 'app_store', 'play_store', 'web')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;
drop policy if exists "entitlements: read own" on public.entitlements;
create policy "entitlements: read own" on public.entitlements for select to authenticated using (user_id = auth.uid());
