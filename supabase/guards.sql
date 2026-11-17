-- Foundry: identity columns never change. Run once in Supabase → SQL Editor, after security.sql
-- (safe to run again).
-- The app writes with "upserts", which resend the key columns, so a column-by-column UPDATE grant
-- would break it. Instead, a trigger refuses any UPDATE that changes who owns a row or which row it
-- is, whoever sends it. The row-level rules still decide which rows each member may touch.
create or replace function public.keep_identity()
returns trigger
language plpgsql
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    -- Detaching a row from a deleted account (foreign key "on delete set null") is allowed; members
    -- cannot do it themselves, since the row rules require user_id = auth.uid().
    if col = 'user_id' and (to_jsonb(new) -> col) = 'null'::jsonb then
      continue;
    end if;
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'The column "%" of % cannot be changed.', col, tg_table_name using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists keep_identity on public.user_state;
create trigger keep_identity before update on public.user_state
  for each row execute function public.keep_identity('user_id');

drop trigger if exists keep_identity on public.profiles;
create trigger keep_identity before update on public.profiles
  for each row execute function public.keep_identity('user_id');

drop trigger if exists keep_identity on public.public_stats;
create trigger keep_identity before update on public.public_stats
  for each row execute function public.keep_identity('user_id');

drop trigger if exists keep_identity on public.activities;
create trigger keep_identity before update on public.activities
  for each row execute function public.keep_identity('id', 'user_id', 'ref');

drop trigger if exists keep_identity on public.shared_meals;
create trigger keep_identity before update on public.shared_meals
  for each row execute function public.keep_identity('user_id', 'meal_id');

drop trigger if exists keep_identity on public.community_foods;
create trigger keep_identity before update on public.community_foods
  for each row execute function public.keep_identity('id', 'user_id', 'created_at', 'uses');

-- Friendships are changed with a plain UPDATE, so a column grant is enough (security.sql):
-- only "status" can change. Respects, comments, feedback and reports have no update rule at all.
