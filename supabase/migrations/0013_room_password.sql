-- =============================================================================
-- Host-only room password management after creation: set/change/remove.
-- update_room_settings could only ADD a password (never clear one). This adds a
-- dedicated host-only RPC: a null/blank password removes protection.
-- =============================================================================
create or replace function set_room_password(p_token text, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role <> 'host' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  if p_password is null or length(trim(p_password)) = 0 then
    delete from room_secrets where room_id = actor.room_id;
    update rooms set has_password = false where id = actor.room_id;
  else
    insert into room_secrets(room_id, password_hash)
    values (actor.room_id, crypt(p_password, gen_salt('bf')))
    on conflict (room_id) do update set password_hash = excluded.password_hash;
    update rooms set has_password = true where id = actor.room_id;
  end if;

  perform _touch_room(actor.room_id);
end;
$$;

grant execute on function set_room_password(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
