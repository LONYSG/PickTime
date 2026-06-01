-- =============================================================================
-- (#3) Room-scope candidate_votes for realtime, and
-- (#2) guard everyday writes server-side.
-- =============================================================================

-- ---- #3: give candidate_votes a room_id so realtime can filter by room ------
alter table candidate_votes add column if not exists room_id uuid references rooms(id) on delete cascade;

-- backfill existing rows from their candidate
update candidate_votes cv
  set room_id = tc.room_id
  from time_candidates tc
  where tc.id = cv.candidate_id and cv.room_id is null;

-- keep it populated automatically (client only sends candidate_id + participant_id)
create or replace function trg_fill_vote_room()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if NEW.room_id is null then
    select room_id into NEW.room_id from time_candidates where id = NEW.candidate_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists fill_vote_room on candidate_votes;
create trigger fill_vote_room before insert on candidate_votes
  for each row execute function trg_fill_vote_room();

alter table candidate_votes alter column room_id set not null;
create index if not exists idx_votes_room on candidate_votes(room_id);

-- ---- #2: reject everyday writes that shouldn't be allowed -------------------
-- Blocks inserts when the room is finalized (read-only) or when the actor has
-- left/been kicked. Does NOT block 'unavailable' (전체 불참) members — a
-- participating action is meant to reactivate them (see 0004).
create or replace function trg_guard_participation()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_room uuid;
  v_pid uuid;
  v_finalized boolean;
  v_status text;
begin
  if tg_table_name = 'candidate_votes' then
    v_pid := NEW.participant_id;
    select room_id into v_room from time_candidates where id = NEW.candidate_id;
  elsif tg_table_name = 'date_availability' then
    v_pid := NEW.participant_id; v_room := NEW.room_id;
  elsif tg_table_name = 'comments' then
    v_pid := NEW.participant_id; v_room := NEW.room_id;
  elsif tg_table_name = 'time_candidates' then
    v_pid := NEW.created_by; v_room := NEW.room_id;
  end if;

  select is_finalized into v_finalized from rooms where id = v_room;
  if v_finalized then
    raise exception 'room_finalized' using errcode = 'P0001';
  end if;

  if v_pid is not null then
    select status into v_status from participants where id = v_pid;
    if v_status = 'left' then
      raise exception 'not_a_member' using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists guard_on_vote on candidate_votes;
create trigger guard_on_vote before insert on candidate_votes
  for each row execute function trg_guard_participation();

drop trigger if exists guard_on_availability on date_availability;
create trigger guard_on_availability before insert on date_availability
  for each row execute function trg_guard_participation();

drop trigger if exists guard_on_comment on comments;
create trigger guard_on_comment before insert on comments
  for each row execute function trg_guard_participation();

drop trigger if exists guard_on_candidate on time_candidates;
create trigger guard_on_candidate before insert on time_candidates
  for each row execute function trg_guard_participation();

-- refresh PostgREST so the new candidate_votes.room_id column is visible
notify pgrst, 'reload schema';
