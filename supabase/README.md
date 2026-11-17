# Supabase: database files and settings

Every `.sql` file here is safe to run again. Run them in **Supabase → SQL Editor → New query → Run**,
in this order (a new project runs them all; an existing one runs the ones it does not have yet):

| # | File | What it does |
|---|---|---|
| 1 | `schema.sql` | Synced data (`user_state`), account deletion |
| 2 | `social.sql` | Profiles, friendships, shared stats |
| 3 | `realtime.sql` | Live updates in the Friends tab |
| 4 | `gear.sql` | Gear, bio, public profile page |
| 5 | `activity.sql` | Activity feed, Respect, comments |
| 6 | `feedback.sql` | "Contact us" messages |
| 7 | `shared_meals.sql` | Meals shared with the community |
| 8 | `community_foods.sql` | Shared food database |
| 9 | `security.sql` | Friendship fix, full account deletion, reports table |
| 10 | `guards.sql` | Identity columns never change |
| 11 | `stats_bounds.sql` | Plausible values only in shared stats |
| 12 | `community_limits.sql` | 30 new shared foods per member per day |
| 13 | `shared_meals_author.sql` | Shared meal author taken from the profile |
| 14 | `admin.sql` | Private view `admin.users` (counts only) and `admin.account_for_email()` for support |
| 15 | `adoption.sql` | Private adoption views (`admin.adoption`, `cohorts`, `features`, `daily`) |
| 16 | `admin_reports.sql` | Private view `admin.reports` (reports to review) |
| 17 | `user_items.sql` | Sync v2 tables (`user_items`, `entitlements`) and the freeze of the old copy |
| 18 | `retention.sql` | `admin.purge_expired()` (run monthly) and `admin.inactive_accounts` |

The access rules are tested on a local PostgreSQL by `npm run test:rls` (`tests/rls.sql`), in CI
before every deploy. Never run the files in `tests/` on the real project.

## Settings to check by hand (Supabase dashboard)

- [ ] **Authentication → Sign In / Providers → Email → Confirm email**: on for the public launch
  (it can stay off during the private beta, to avoid e-mail rate limits).
- [ ] **Authentication → Attack Protection → Prevent use of leaked passwords**: on (paid plans).
- [ ] **Authentication → Rate Limits**: sign-ups and sign-ins per hour set to sensible values.
- [ ] **Authentication → Emails → SMTP Settings**: your own e-mail service (the built-in one is
  limited to a few e-mails per hour and is meant for testing).
- [ ] **Authentication → URL Configuration**: Site URL and redirect URLs point to the app's address only.
- [ ] **Project Settings → General**: region in the European Union (e.g. Frankfurt, Paris, Ireland).
- [ ] **Database → Backups**: daily backups available (and point-in-time recovery when the plan allows).
- [ ] **Project Settings → Legal / DPA**: data processing agreement signed.
- [ ] **API → Exposed schemas**: only `public` (and `graphql_public`); never `admin`.
- [ ] **Table Editor**: every table in `public` shows "RLS enabled".
- [ ] Keys: only the **publishable/anon** key is in the app. The `service_role` key and the database
  password are never shared, committed or pasted anywhere.
