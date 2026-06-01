-- =============================================================================
-- Non-participation (불참) + leaving / kicking members
-- =============================================================================
-- * date_availability.status: a per-date mark is either "available all day" or
--   "unavailable" (can't make this date).
-- * participants.status: 'active' (normal), 'unavailable' (declared they can't
--   attend at all — votes cleared, still listed as 불참), or 'left' (voluntarily
--   left or kicked — removed from the member list, votes cleared, but their
--   comments stay, shown with a 탈퇴자 tag).
-- =============================================================================

alter table date_availability
  add column if not exists status text not null default 'all_day';
alter table date_availability
  drop constraint if exists date_availability_status_check;
alter table date_availability
  add constraint date_availability_status_check check (status in ('all_day', 'unavailable'));

alter table participants
  add column if not exists status text not null default 'active';
alter table participants
  drop constraint if exists participants_status_check;
alter table participants
  add constraint participants_status_check
  check (status in ('active', 'unavailable', 'left'));

-- -----------------------------------------------------------------------------
-- Per-date status: all_day / unavailable / none (clears the mark).
-- Marking a date unavailable also drops the caller's votes for that date.
-- Replaces the old direct-table all-day write.
-- -----------------------------------------------------------------------------
create or replace function set_date_status(p_token text, p_date date, p_status text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor participants;
begin
  actor := _participant_from_token(p_token);
  if p_status not in ('all_day', 'unavailable', 'none') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  if p_status = 'none' then
    delete from date_availability
      where room_id = actor.room_id and date = p_date and participant_id = actor.id;
  else
    insert into date_availability (room_id, date, participant_id, is_all_day, status)
    values (actor.room_id, p_date, actor.id, p_status = 'all_day', p_status)
    on conflict (room_id, date, participant_id)
    do update set is_all_day = excluded.is_all_day, status = excluded.status;

    if p_status = 'unavailable' then
      delete from candidate_votes cv
      using time_candidates tc
      where cv.candidate_id = tc.id
        and tc.room_id = actor.room_id
        and tc.date = p_date
        and cv.participant_id = actor.id;
    end if;
  end if;

  perform _touch_room(actor.room_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Whole-room non-participation toggle. Going unavailable clears all of the
-- caller's votes and date marks; going back to active just restores the flag.
-- -----------------------------------------------------------------------------
create or replace function set_self_participation(p_token text, p_unavailable boolean)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor participants;
begin
  actor := _participant_from_token(p_token);
  if p_unavailable then
    update participants set status = 'unavailable' where id = actor.id;
    delete from candidate_votes where participant_id = actor.id;
    delete from date_availability where participant_id = actor.id;
  else
    update participants set status = 'active' where id = actor.id;
  end if;
  perform _touch_room(actor.room_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Leave the room (soft delete). Votes/marks cleared, session revoked. The row
-- is kept (status='left') so existing comments still render the author, tagged
-- as 탈퇴자 in the UI. Host can't leave — they delete or stay.
-- -----------------------------------------------------------------------------
create or replace function leave_room(p_token text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role = 'host' then
    raise exception 'host_cannot_leave' using errcode = 'P0001';
  end if;
  update participants set status = 'left' where id = actor.id;
  delete from candidate_votes where participant_id = actor.id;
  delete from date_availability where participant_id = actor.id;
  update participant_auth set session_token_hash = null, session_expires_at = null
    where participant_id = actor.id;
  perform _touch_room(actor.room_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Kick a member (host/admin). Same soft-delete semantics as leaving.
-- -----------------------------------------------------------------------------
create or replace function kick_participant(p_token text, p_target_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor participants;
  target participants;
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
  update participant_auth set session_token_hash = null, session_expires_at = null
    where participant_id = p_target_id;
  insert into audit_logs(room_id, participant_id, action, detail)
    values (actor.room_id, actor.id, 'kick', target.nickname);
  perform _touch_room(actor.room_id);
end;
$$;

grant execute on function
  set_date_status(text, date, text),
  set_self_participation(text, boolean),
  leave_room(text),
  kick_participant(text, uuid)
  to anon, authenticated;
