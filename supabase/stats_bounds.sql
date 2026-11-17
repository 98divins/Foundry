-- Foundry: plausible numbers only in the stats friends see. Run once in Supabase → SQL Editor,
-- after social.sql (safe to run again).
-- The app computes these stats on the phone, so a member could send made-up numbers. Leaderboards
-- are only between friends; these bounds stop absurd values (a 900-week streak, 10 000 sets in a
-- week) without trying to prove the numbers are true. See docs/SPEC.md, "Leaderboards".
create or replace function public.stats_within(j jsonb, key text, lo numeric, hi numeric)
returns boolean language sql immutable as $$
  select case
    when j -> key is null or j -> key = 'null'::jsonb then true
    when jsonb_typeof(j -> key) <> 'number' then false
    else (j ->> key)::numeric between lo and hi
  end
$$;

create or replace function public.plausible_stats(s jsonb)
returns boolean language plpgsql immutable as $$
declare
  p text;
  d numeric;
  x jsonb;
begin
  if jsonb_typeof(s) <> 'object' then return false; end if;
  if not (
    stats_within(s, 'weekDays', 0, 7) and stats_within(s, 'weekWorkouts', 0, 70)
    and stats_within(s, 'weekSets', 0, 1500) and stats_within(s, 'weekVolume', 0, 300000)
    and stats_within(s, 'weekMinutes', 0, 10080) and stats_within(s, 'weekCardio', 0, 10080)
    and stats_within(s, 'weekCardioKm', 0, 2000) and stats_within(s, 'avgDays4w', 0, 7)
    and stats_within(s, 'streak', 0, 1100) and stats_within(s, 'prs30', 0, 1500)
    and stats_within(s, 'strength4w', -100, 100) and stats_within(s, 'totalWorkouts', 0, 30000)
    and stats_within(s, 'level', 1, 50) and stats_within(s, 'weekGoalPct', 0, 100)
  ) then
    return false;
  end if;
  for p in select unnest(array['30', '182', '365']) loop
    x := s -> 'periods' -> p;
    continue when x is null or x = 'null'::jsonb;
    d := p::numeric;
    if not (
      stats_within(x, 'days', 0, d) and stats_within(x, 'sets', 0, 220 * d)
      and stats_within(x, 'volume', 0, 45000 * d) and stats_within(x, 'prs', 0, 50 * d)
      and stats_within(x, 'strength', -100, 100) and stats_within(x, 'goals', 0, 100)
      and stats_within(x, 'cardio', 0, 1440 * d) and stats_within(x, 'cardioKm', 0, 300 * d)
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter table public.public_stats drop constraint if exists public_stats_plausible;
-- "not valid": rows already there are left alone; every new write is checked.
alter table public.public_stats add constraint public_stats_plausible check (public.plausible_stats(stats)) not valid;
