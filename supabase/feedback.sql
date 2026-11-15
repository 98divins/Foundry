-- Foundry feedback: run once in Supabase → SQL Editor → New query → Run. Safe to run again.
-- Messages sent from Settings → Contact us. Users can only add their own; read them in
-- Table Editor → feedback (newest first), and reply to the email shown.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  email text,
  kind text not null check (kind in ('idea', 'bug', 'question', 'other')),
  message text not null check (char_length(message) between 1 and 5000),
  app_version text,
  device text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback: send own" on public.feedback;
create policy "feedback: send own" on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and email = (auth.jwt() ->> 'email'));
-- No select/update/delete policy: users cannot read anyone's feedback, including their own.
