-- Foundry: products scanned by members are shared with everyone. Run once in Supabase → SQL Editor
-- (safe to run again), after community_foods.sql.
-- `origin` says where the values come from: 'member' (typed from the label) or 'off' (an Open Food
-- Facts product scanned by a member). Open Food Facts data is under the Open Database License: the
-- app shows "Data: Open Food Facts" on those foods, and their id is "off-<barcode>" so a product is
-- stored once (the first member who scans it keeps it; others read it).
alter table public.community_foods add column if not exists origin text not null default 'member';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_foods_origin_check') then
    alter table public.community_foods add constraint community_foods_origin_check
      check (origin in ('member', 'off') and (origin = 'member' or (barcode is not null and id = 'off-' || barcode)));
  end if;
end $$;
