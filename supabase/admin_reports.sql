-- Foundry: reports to review, in the private "admin" schema (not exposed to the app). Run once in
-- Supabase → SQL Editor, after security.sql and admin.sql (safe to run again).
-- Read with: select * from admin.reports;  Mark one handled with:
--   update public.content_reports set handled_at = now() where id = <id>;
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create or replace view admin.reports as
select
  r.id,
  r.kind,
  r.target,
  r.reason,
  r.details,
  r.created_at,
  r.handled_at,
  p.username as reported_by,
  count(*) over (partition by r.kind, r.target) as reports_on_this_item
from public.content_reports r
left join public.profiles p on p.user_id = r.reporter
order by r.handled_at nulls first, reports_on_this_item desc, r.created_at desc;

revoke all on admin.reports from public, anon, authenticated;
