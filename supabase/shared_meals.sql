-- Foundry: meals members choose to share. Run once in Supabase → SQL Editor (safe to run again).
-- Everyone signed in can read shared meals; each person can only add, change or remove their own.
create table if not exists public.shared_meals (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  meal_id text not null,
  author text not null default '' check (char_length(author) <= 40),
  name text not null check (char_length(name) between 1 and 80),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 40 and pg_column_size(items) < 20000),
  kcal integer not null default 0,
  protein real not null default 0,
  carbs real not null default 0,
  fat real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, meal_id)
);
create index if not exists shared_meals_recent on public.shared_meals (updated_at desc);

alter table public.shared_meals enable row level security;

drop policy if exists "shared meals: read" on public.shared_meals;
drop policy if exists "shared meals: add own" on public.shared_meals;
drop policy if exists "shared meals: change own" on public.shared_meals;
drop policy if exists "shared meals: remove own" on public.shared_meals;
create policy "shared meals: read" on public.shared_meals for select to authenticated using (true);
create policy "shared meals: add own" on public.shared_meals for insert to authenticated with check (user_id = auth.uid());
create policy "shared meals: change own" on public.shared_meals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shared meals: remove own" on public.shared_meals for delete to authenticated using (user_id = auth.uid());
