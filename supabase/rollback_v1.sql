-- Foundry sync v2 → v1 rollback (docs/SYNC_V2.md, 3.3). Run once to install (safe to run again);
-- use only if the new sync must be undone within 30 days of the move. Procedure:
--   1. redeploy the previous app version;
--   2. for each moved account: select admin.rollback_to_v1(user_id) from public.user_items
--      where kind = 'meta' and id = 'migrated';
-- It rebuilds the single-block copy from the rows (exact inverse of the app's split, tested) and
-- removes the 'migrated' mark, which unfreezes user_state.

create or replace function admin.fold_items(uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  st jsonb := '{}'::jsonb;
  nut jsonb;
  r record;
  -- Items of a kind, in the person's order (order:<kind> document), then any left out of it.
  ordered jsonb;
begin
  for r in select id, data from user_items where user_id = uid and kind = 'doc' and not deleted and id like 'state:%' loop
    st := st || jsonb_build_object(substr(r.id, 7), r.data);
  end loop;
  nut := coalesce((select data from user_items where user_id = uid and kind = 'doc' and id = 'nutrition' and not deleted), '{}'::jsonb);

  -- Lists the app keeps sorted.
  st := st || jsonb_build_object('workouts', coalesce((select jsonb_agg(data order by (data->>'startedAt')::numeric) from user_items where user_id = uid and kind = 'workout' and not deleted), '[]'));
  nut := nut || jsonb_build_object(
    'log', coalesce((select jsonb_agg(data order by coalesce((data->>'createdAt')::numeric, 0)) from user_items where user_id = uid and kind = 'log' and not deleted), '[]'),
    'weights', coalesce((select jsonb_agg(data order by data->>'date') from user_items where user_id = uid and kind = 'weight' and not deleted), '[]'),
    'checkIns', coalesce((select jsonb_agg(data order by data->>'date') from user_items where user_id = uid and kind = 'checkin' and not deleted), '[]'),
    'incompleteDays', coalesce((select jsonb_agg(data order by data #>> '{}') from user_items where user_id = uid and kind = 'incomplete' and not deleted), '[]'));

  -- Lists in the person's order.
  for r in select * from (values ('routine', 'routines', false), ('folder', 'folders', false), ('exercise', 'customExercises', false),
                                 ('food', 'foods', true), ('meal', 'savedMeals', true), ('favorite', 'favorites', true)) v(kind, field, in_nutrition) loop
    select coalesce(jsonb_agg(i.data order by coalesce(o.pos, 1e9), i.id), '[]') into ordered
    from user_items i
    left join lateral (
      select e.pos from jsonb_array_elements_text(coalesce((select data from user_items d where d.user_id = uid and d.kind = 'doc' and d.id = 'order:' || r.kind), '[]')) with ordinality e(key, pos)
      where e.key = i.id
    ) o on true
    where i.user_id = uid and i.kind = r.kind and not i.deleted;
    if r.in_nutrition then nut := nut || jsonb_build_object(r.field, ordered); else st := st || jsonb_build_object(r.field, ordered); end if;
  end loop;

  return st || jsonb_build_object('nutrition', nut);
end;
$$;

create or replace function admin.rollback_to_v1(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from user_items where user_id = uid and kind = 'meta' and id = 'migrated';
  update user_state set data = admin.fold_items(uid), updated_at = now() where user_id = uid;
end;
$$;

revoke all on function admin.fold_items(uuid) from public, anon, authenticated;
revoke all on function admin.rollback_to_v1(uuid) from public, anon, authenticated;
