-- Foundry: photos of meals, foods and exercises. Run once in Supabase → SQL Editor (safe to run again),
-- after social.sql and shared_meals.sql.
-- Files live in the private "photos" bucket at <user id>/<meal|food|exercise>/<item id>.jpg.
--   - Each person adds, replaces and removes only files in their own folder.
--   - Exercise and food photos: only their owner can see them.
--   - Meal photos: the owner and accepted friends; every member too once the meal is shared
--     with the community (a row in shared_meals).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 400000, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 400000, allowed_mime_types = array['image/jpeg', 'image/webp'];

-- Whether the signed-in member may see a photo, from its path.
create or replace function public.photo_readable(path text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  parts text[] := string_to_array(path, '/');
  owner uuid;
begin
  if auth.uid() is null or array_length(parts, 1) <> 3 or parts[1] !~ '^[0-9a-f-]{36}$' then return false; end if;
  owner := parts[1]::uuid;
  if owner = auth.uid() then return true; end if;
  if parts[2] <> 'meal' then return false; end if;
  return public.is_friend(owner)
    or exists (select 1 from shared_meals m where m.user_id = owner and m.meal_id = split_part(parts[3], '.', 1));
end $$;

-- Whether a path is one the signed-in member may write: their folder, a known kind, a plain file name.
create or replace function public.photo_writable(path text)
returns boolean language sql stable as $$
  select auth.uid() is not null
    and path ~ ('^' || auth.uid()::text || '/(meal|food|exercise)/[A-Za-z0-9_-]{1,64}\.(jpg|webp)$');
$$;

revoke all on function public.photo_readable(text) from public, anon;
revoke all on function public.photo_writable(text) from public, anon;
grant execute on function public.photo_readable(text) to authenticated;
grant execute on function public.photo_writable(text) to authenticated;

drop policy if exists "photos: read" on storage.objects;
drop policy if exists "photos: add own" on storage.objects;
drop policy if exists "photos: replace own" on storage.objects;
drop policy if exists "photos: remove own" on storage.objects;
create policy "photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.photo_readable(name));
create policy "photos: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.photo_writable(name));
create policy "photos: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.photo_writable(name)) with check (bucket_id = 'photos' and public.photo_writable(name));
create policy "photos: remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.photo_writable(name));
