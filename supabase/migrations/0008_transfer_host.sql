-- transfer_host: host demotes self to admin and promotes another participant.
create or replace function transfer_host(
  p_token      text,
  p_new_host_id uuid
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pid    uuid;
  v_room   uuid;
begin
  select ps.participant_id, p.room_id
  into   v_pid, v_room
  from   participant_sessions ps
  join   participants p on p.id = ps.participant_id
  where  ps.token_hash = digest(p_token, 'sha256')
    and  p.role    = 'host'
    and  p.status  = 'active'
  limit 1;

  if not found then raise exception 'forbidden'; end if;

  if not exists (
    select 1 from participants
    where id = p_new_host_id and room_id = v_room and status = 'active'
  ) then raise exception 'participant_not_found'; end if;

  update participants set role = 'admin' where id = v_pid;
  update participants set role = 'host'  where id = p_new_host_id;
  update rooms set host_participant_id = p_new_host_id where id = v_room;

  insert into notifications (room_id, participant_id, type)
  select v_room, id, 'role_changed'
  from   participants
  where  room_id = v_room and status = 'active';
end;
$$;
