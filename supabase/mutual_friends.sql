-- Foundry: mutual friends, a friend's friend list and "people you may know".
-- Run once in Supabase → SQL Editor (safe to run again), after social.sql.
-- Friendships stay private to the two people involved; these functions only answer what each
-- question needs:
--   - mutual_friends(other): your friends who are also friends with `other` (people you already know);
--   - friends_of(other): the friends of one of your friends, if they let their friends see their list;
--   - friend_suggestions(): friends of your friends (same consent), ranked by mutual friends.

alter table public.profiles add column if not exists show_friends boolean not null default true;

-- Accepted friends of someone (internal: never granted to the app directly).
create or replace function public.friend_ids(u uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select case when requester = u then addressee else requester end
  from friendships where status = 'accepted' and (requester = u or addressee = u);
$$;
revoke all on function public.friend_ids(uuid) from public, anon, authenticated;

create or replace function public.mutual_friends(other uuid)
returns table (user_id uuid, username text, display_name text, avatar text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar
  from profiles p
  where auth.uid() is not null and other <> auth.uid()
    and p.user_id in (select public.friend_ids(auth.uid()))
    and p.user_id in (select public.friend_ids(other))
  order by p.display_name, p.username;
$$;

-- `link` says where the caller stands with each person: 'me', 'friend', 'sent', 'received' or 'none'.
create or replace function public.friends_of(other uuid)
returns table (user_id uuid, username text, display_name text, avatar text, link text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar,
    case
      when p.user_id = auth.uid() then 'me'
      when exists (select 1 from friendships f where f.status = 'accepted'
        and ((f.requester = auth.uid() and f.addressee = p.user_id) or (f.addressee = auth.uid() and f.requester = p.user_id))) then 'friend'
      when exists (select 1 from friendships f where f.status = 'pending' and f.requester = auth.uid() and f.addressee = p.user_id) then 'sent'
      when exists (select 1 from friendships f where f.status = 'pending' and f.addressee = auth.uid() and f.requester = p.user_id) then 'received'
      else 'none'
    end
  from profiles p
  where auth.uid() is not null
    and public.is_friend(other)
    and (select show_friends from profiles where profiles.user_id = other)
    and p.user_id in (select public.friend_ids(other))
  order by p.display_name, p.username;
$$;

create or replace function public.friend_suggestions(max_rows int default 20)
returns table (user_id uuid, username text, display_name text, avatar text, mutual int)
language sql stable security definer set search_path = public as $$
  with mine as (select public.friend_ids(auth.uid()) as id),
  -- Friends who let their friends see their list.
  open_friends as (select m.id from mine m join profiles p on p.user_id = m.id where p.show_friends),
  candidates as (
    select c.id, count(*)::int as mutual
    from open_friends o, lateral (select public.friend_ids(o.id) as id) c
    where c.id <> auth.uid()
      and c.id not in (select id from mine)
      and not exists (select 1 from friendships f where (f.requester = auth.uid() and f.addressee = c.id) or (f.addressee = auth.uid() and f.requester = c.id))
    group by c.id
  )
  select p.user_id, p.username, p.display_name, p.avatar, c.mutual
  from candidates c join profiles p on p.user_id = c.id
  where auth.uid() is not null
  order by c.mutual desc, p.display_name
  limit least(greatest(max_rows, 1), 50);
$$;

revoke all on function public.mutual_friends(uuid) from public, anon;
revoke all on function public.friends_of(uuid) from public, anon;
revoke all on function public.friend_suggestions(int) from public, anon;
grant execute on function public.mutual_friends(uuid) to authenticated;
grant execute on function public.friends_of(uuid) to authenticated;
grant execute on function public.friend_suggestions(int) to authenticated;
