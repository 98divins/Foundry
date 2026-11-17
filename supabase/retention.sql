-- Foundry: apply the retention periods of the privacy policy. Run once in Supabase → SQL Editor,
-- after admin.sql, security.sql and feedback.sql (safe to run again). Only you can run these.
--
-- Monthly, run:   select * from admin.purge_expired();
-- (or schedule it: Database → Cron, if pg_cron is enabled: select admin.purge_expired();)
--
-- Accounts inactive for 24 months: admin.inactive_accounts lists them. Send each a warning email,
-- then delete those that did not come back 30 days later (Authentication → Users → Delete user).

create or replace function admin.purge_expired()
returns table (what text, deleted bigint)
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  delete from public.feedback where created_at < now() - interval '12 months';
  get diagnostics n = row_count;
  what := 'contact messages older than 12 months'; deleted := n; return next;
  delete from public.content_reports where created_at < now() - interval '12 months';
  get diagnostics n = row_count;
  what := 'reports older than 12 months'; deleted := n; return next;
end;
$$;
revoke all on function admin.purge_expired() from public, anon, authenticated;

create or replace view admin.inactive_accounts as
select u.id as user_id, p.username, u.created_at::date as signed_up_on,
  greatest(u.last_sign_in_at, s.updated_at)::date as last_active_on
from auth.users u
left join public.user_state s on s.user_id = u.id
left join public.profiles p on p.user_id = u.id
where greatest(coalesce(u.last_sign_in_at, u.created_at), coalesce(s.updated_at, u.created_at)) < now() - interval '24 months'
order by last_active_on;
revoke all on admin.inactive_accounts from public, anon, authenticated;
