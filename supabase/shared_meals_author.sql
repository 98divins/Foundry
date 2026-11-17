-- Foundry: the author shown on a shared meal comes from the member's profile, never from what the
-- app sends. Run once in Supabase → SQL Editor, after shared_meals.sql and social.sql (safe to run
-- again).
create or replace function public.shared_meal_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author := coalesce(
    (select left(coalesce(nullif(p.display_name, ''), '@' || p.username), 40) from profiles p where p.user_id = new.user_id),
    ''
  );
  return new;
end;
$$;

drop trigger if exists author_from_profile on public.shared_meals;
create trigger author_from_profile before insert or update on public.shared_meals
  for each row execute function public.shared_meal_author();

-- When a member renames themselves, their shared meals follow.
create or replace function public.profile_renamed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.display_name is distinct from old.display_name or new.username is distinct from old.username then
    update shared_meals set author = '' where user_id = new.user_id; -- the trigger above fills it in
  end if;
  return new;
end;
$$;

drop trigger if exists rename_shared_meals on public.profiles;
create trigger rename_shared_meals after update on public.profiles
  for each row execute function public.profile_renamed();

-- Meals shared before this file was run: fill their author from the profile now.
update public.shared_meals set author = '';
