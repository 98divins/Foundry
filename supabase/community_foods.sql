-- Foundry: foods created by members, shared with everyone. Run once in Supabase → SQL Editor (safe to run again).
create table if not exists public.community_foods (
  id text primary key,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  brand text check (brand is null or char_length(brand) <= 60),
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  kcal real not null check (kcal between 0 and 950),
  protein real not null default 0 check (protein between 0 and 100),
  carbs real not null default 0 check (carbs between 0 and 100),
  fat real not null default 0 check (fat between 0 and 100),
  serving_label text check (serving_label is null or char_length(serving_label) <= 40),
  serving_grams real check (serving_grams is null or serving_grams between 1 and 2000),
  uses integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists community_foods_name on public.community_foods using gin (to_tsvector('simple', name));
create index if not exists community_foods_barcode on public.community_foods (barcode);

alter table public.community_foods enable row level security;
drop policy if exists "community foods: read" on public.community_foods;
drop policy if exists "community foods: add own" on public.community_foods;
drop policy if exists "community foods: change own" on public.community_foods;
drop policy if exists "community foods: remove own" on public.community_foods;
create policy "community foods: read" on public.community_foods for select to authenticated using (true);
create policy "community foods: add own" on public.community_foods for insert to authenticated with check (user_id = auth.uid());
create policy "community foods: change own" on public.community_foods for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "community foods: remove own" on public.community_foods for delete to authenticated using (user_id = auth.uid());
