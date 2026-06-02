-- =============================================================================
-- Close the vote/comment/candidate forgery gap.
--
-- Until now the "everyday" writes (vote, add candidate, comment) went straight
-- to the tables under permissive RLS, trusting a client-supplied
-- participant_id. A user could therefore cast votes or post comments AS someone
-- else by forging that id. This routes all four through token-checked
-- SECURITY DEFINER RPCs (the participant is derived from the session token, not
-- the client) and removes the permissive write policies so the tables can no
-- longer be written directly by anon.
--
-- The BEFORE INSERT guards from 0005 (finalized room / left member) still fire
-- on these RPC inserts, so finalize/left protection is unchanged.
-- =============================================================================

-- ---- RPCs ------------------------------------------------------------------

-- Vote for a candidate (idempotent). Caller derived from token.
create or replace function cast_vote(p_token text, p_candidate_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; v_room uuid;
begin
  actor := _participant_from_token(p_token);
  select room_id into v_room from time_candidates where id = p_candidate_id;
  if v_room is null or v_room <> actor.room_id then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into candidate_votes (candidate_id, participant_id)
  values (p_candidate_id, actor.id)
  on conflict (candidate_id, participant_id) do nothing;
end;
$$;

-- Remove my vote for a candidate.
create or replace function remove_vote(p_token text, p_candidate_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants;
begin
  actor := _participant_from_token(p_token);
  delete from candidate_votes where candidate_id = p_candidate_id and participant_id = actor.id;
end;
$$;

-- Add a time candidate (and auto-vote the creator) atomically. Returns the row.
create or replace function add_candidate(p_token text, p_date date, p_start time, p_end time)
returns time_candidates language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; v_row time_candidates;
begin
  actor := _participant_from_token(p_token);
  if p_end <= p_start then
    raise exception 'invalid_time_range' using errcode = 'P0001';
  end if;
  if p_date < (select date_range_start from rooms where id = actor.room_id)
  or p_date > (select date_range_end   from rooms where id = actor.room_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into time_candidates (room_id, date, start_time, end_time, created_by)
  values (actor.room_id, p_date, p_start, p_end, actor.id)
  returning * into v_row;
  -- the creator implicitly supports the time they proposed
  insert into candidate_votes (candidate_id, participant_id)
  values (v_row.id, actor.id)
  on conflict (candidate_id, participant_id) do nothing;
  return v_row;
end;
$$;

-- Post a date-level comment as the caller.
create or replace function add_comment(p_token text, p_date date, p_content text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants;
begin
  actor := _participant_from_token(p_token);
  if length(trim(coalesce(p_content, ''))) = 0 then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into comments (room_id, date, participant_id, content)
  values (actor.room_id, p_date, actor.id, left(trim(p_content), 500));
end;
$$;

grant execute on function
  cast_vote(text, uuid),
  remove_vote(text, uuid),
  add_candidate(text, date, time, time),
  add_comment(text, date, text)
  to anon, authenticated;

-- ---- Lock down direct table writes -----------------------------------------
-- Reads stay open; writes now only happen through the SECURITY DEFINER RPCs
-- above (and the existing availability/candidate-edit RPCs), which bypass RLS.
drop policy if exists write_votes        on candidate_votes;
drop policy if exists write_candidates   on time_candidates;
drop policy if exists write_comments     on comments;
drop policy if exists write_availability on date_availability;

notify pgrst, 'reload schema';
