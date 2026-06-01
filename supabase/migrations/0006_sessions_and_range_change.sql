-- =============================================================================
-- (A) Multiple concurrent sessions per participant.
--     Previously each login overwrote the single stored token, so logging in
--     on a 2nd tab/device silently invalidated the 1st ("세션 만료"). Tokens now
--     live in their own table so many can be valid at once.
-- (B) Date-range change: drop out-of-range candidates/votes and notify.
-- =============================================================================

-- ---- (A) sessions table ----------------------------------------------------
create table if not exists participant_sessions (
  token_hash     text primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_sessions_participant on participant_sessions(participant_id);
alter table participant_sessions enable row level security; -- no policies → no anon access

-- migrate existing single tokens so current logins survive this change
insert into participant_sessions (token_hash, participant_id, expires_at)
select session_token_hash, participant_id, coalesce(session_expires_at, now() + interval '60 days')
from participant_auth
where session_token_hash is not null
on conflict (token_hash) do nothing;

create or replace function _issue_token(p_participant_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(24), 'hex');
begin
  insert into participant_sessions (token_hash, participant_id, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_participant_id, now() + interval '60 days');
  return v_token;
end;
$$;

create or replace function _participant_from_token(p_token text)
returns participants language plpgsql security definer set search_path = public, extensions as $$
declare v_part participants;
begin
  select p.* into v_part
  from participant_sessions s
  join participants p on p.id = s.participant_id
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and s.expires_at > now();
  if v_part.id is null then
    raise exception 'invalid_session' using errcode = 'P0001';
  end if;
  return v_part;
end;
$$;

revoke execute on function _issue_token(uuid), _participant_from_token(text)
  from anon, authenticated, public;

-- leaving / kicking / pin reset must revoke ALL of that member's sessions
create or replace function leave_room(p_token text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role = 'host' then
    raise exception 'host_cannot_leave' using errcode = 'P0001';
  end if;
  update participants set status = 'left' where id = actor.id;
  delete from candidate_votes where participant_id = actor.id;
  delete from date_availability where participant_id = actor.id;
  delete from participant_sessions where participant_id = actor.id;
  perform _touch_room(actor.room_id);
end;
$$;

create or replace function kick_participant(p_token text, p_target_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; target participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role not in ('host', 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select * into target from participants where id = p_target_id;
  if target.id is null or target.room_id <> actor.room_id or target.role = 'host' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update participants set status = 'left' where id = p_target_id;
  delete from candidate_votes where participant_id = p_target_id;
  delete from date_availability where participant_id = p_target_id;
  delete from participant_sessions where participant_id = p_target_id;
  insert into audit_logs(room_id, participant_id, action, detail)
    values (actor.room_id, actor.id, 'kick', target.nickname);
  perform _touch_room(actor.room_id);
end;
$$;

create or replace function reset_participant_pin(p_token text, p_target_id uuid, p_new_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; target participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role not in ('host', 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select * into target from participants where id = p_target_id;
  if target.room_id <> actor.room_id then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'pin_must_be_4_digits' using errcode = 'P0001';
  end if;
  update participant_auth
    set pin_hash = crypt(p_new_pin, gen_salt('bf')), pin_attempts = 0, pin_locked_until = null
    where participant_id = p_target_id;
  delete from participant_sessions where participant_id = p_target_id; -- force re-login
  insert into audit_logs(room_id, participant_id, action, detail)
    values (actor.room_id, actor.id, 'reset_pin', target.nickname);
end;
$$;

-- ---- (B) date-range change handling ----------------------------------------
-- Narrowing the range removes candidates (and their votes) that fall outside
-- it. Affected voters get a 'votes_cancelled' notice; everyone gets a
-- 'range_changed' notice. Title-only edits don't notify.
create or replace function update_room_settings(
  p_token text, p_title text, p_date_start date, p_date_end date, p_password text default null
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  actor participants;
  v_start date; v_end date;
  v_old_start date; v_old_end date;
  v_changed boolean;
begin
  actor := _participant_from_token(p_token);
  if actor.role not in ('host', 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select date_range_start, date_range_end into v_old_start, v_old_end
    from rooms where id = actor.room_id;
  v_start := coalesce(p_date_start, v_old_start);
  v_end := coalesce(p_date_end, v_old_end);
  if v_end < v_start then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;
  v_changed := v_start <> v_old_start or v_end <> v_old_end;

  if v_changed then
    -- notify members whose votes are about to be cancelled (before deletion)
    insert into notifications(room_id, participant_id, type, detail)
      select distinct actor.room_id, cv.participant_id, 'votes_cancelled',
             to_char(v_start, 'MM/DD') || ' ~ ' || to_char(v_end, 'MM/DD')
      from candidate_votes cv
      join time_candidates tc on tc.id = cv.candidate_id
      where tc.room_id = actor.room_id
        and (tc.date < v_start or tc.date > v_end)
        and cv.participant_id <> actor.id;

    delete from time_candidates
      where room_id = actor.room_id and (date < v_start or date > v_end);
    delete from date_availability
      where room_id = actor.room_id and (date < v_start or date > v_end);
  end if;

  update rooms
    set title = coalesce(p_title, title),
        date_range_start = v_start,
        date_range_end = v_end,
        has_password = (p_password is not null) or has_password
    where id = actor.room_id;
  if p_password is not null then
    insert into room_secrets(room_id, password_hash)
    values (actor.room_id, crypt(p_password, gen_salt('bf')))
    on conflict (room_id) do update set password_hash = excluded.password_hash;
  end if;

  if v_changed then
    insert into notifications(room_id, participant_id, type, detail)
      select actor.room_id, p.id, 'range_changed',
             to_char(v_start, 'MM/DD') || ' ~ ' || to_char(v_end, 'MM/DD')
      from participants p
      where p.room_id = actor.room_id and p.id <> actor.id and p.status <> 'left';
  end if;

  perform _touch_room(actor.room_id);
end;
$$;

notify pgrst, 'reload schema';
