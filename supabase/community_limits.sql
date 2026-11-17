-- Foundry: limits on the shared food database. Run once in Supabase → SQL Editor, after
-- community_foods.sql (safe to run again).
-- At most 30 new foods per member per 24 hours, so one account cannot flood the database.
create or replace function public.community_foods_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from community_foods where id = new.id) then
    return new; -- an update of an existing food (upsert), not a new one
  end if;
  if (select count(*) from community_foods where user_id = new.user_id and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'Too many foods added today. Try again tomorrow.' using errcode = '54000';
  end if;
  return new;
end;
$$;

drop trigger if exists rate_limit on public.community_foods;
create trigger rate_limit before insert on public.community_foods
  for each row execute function public.community_foods_rate_limit();
