-- =============================================================================
-- Fix host transfer + make role-change notifications human-readable (Korean).
--
-- 0008's transfer_host compared `digest(token,'sha256')` (bytea) against the
-- stored hex-text token_hash, which errored on every call. It also used the
-- notification type 'role_changed' (the app expects 'role_change'). This rewrite
-- routes through _participant_from_token like every other RPC and writes Korean
-- notification details.
-- =============================================================================

create or replace function transfer_host(p_token text, p_new_host_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; target participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role <> 'host' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select * into target from participants where id = p_new_host_id;
  if target.id is null or target.room_id <> actor.room_id or target.status = 'left' then
    raise exception 'participant_not_found' using errcode = 'P0001';
  end if;

  update participants set role = 'admin' where id = actor.id;
  update participants set role = 'host'  where id = target.id;
  update rooms set host_participant_id = target.id where id = actor.room_id;

  insert into notifications(room_id, participant_id, type, detail)
    select actor.room_id, p.id, 'role_change',
           case when p.id = target.id then '회원님이 새 방장이 되었어요'
                else target.nickname || '님이 새 방장이 되었어요' end
      from participants p
     where p.room_id = actor.room_id and p.status <> 'left' and p.id <> actor.id;

  insert into audit_logs(room_id, participant_id, action, detail)
    values (actor.room_id, actor.id, 'transfer_host', target.nickname);
  perform _touch_room(actor.room_id);
end;
$$;

-- Korean detail for admin grant/revoke notifications.
create or replace function set_participant_role(p_token text, p_target_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; target participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role not in ('host', 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_role not in ('admin', 'participant') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  select * into target from participants where id = p_target_id;
  if target.room_id <> actor.room_id or target.role = 'host' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update participants set role = p_role where id = p_target_id;
  insert into notifications(room_id, participant_id, type, detail)
    values (actor.room_id, p_target_id, 'role_change',
            case when p_role = 'admin' then '관리자로 지정됐어요'
                 else '일반 참여자로 변경됐어요' end);
  insert into audit_logs(room_id, participant_id, action, detail)
    values (actor.room_id, actor.id, 'set_role', target.nickname || ' → ' || p_role);
end;
$$;

grant execute on function transfer_host(text, uuid), set_participant_role(text, uuid, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
