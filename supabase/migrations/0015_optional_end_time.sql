-- =============================================================================
-- Optional end time: a candidate can be just a start ("오후 4시에 만나자") with
-- no end. end_time becomes nullable; add_candidate/edit_candidate accept null.
-- =============================================================================

alter table time_candidates alter column end_time drop not null;

-- add_candidate: end optional (defaults to null). Still auto-votes the creator.
create or replace function add_candidate(p_token text, p_date date, p_start time, p_end time default null)
returns time_candidates language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; v_row time_candidates;
begin
  actor := _participant_from_token(p_token);
  if p_end is not null and p_end <= p_start then
    raise exception 'invalid_time_range' using errcode = 'P0001';
  end if;
  if p_date < (select date_range_start from rooms where id = actor.room_id)
  or p_date > (select date_range_end   from rooms where id = actor.room_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into time_candidates (room_id, date, start_time, end_time, created_by)
  values (actor.room_id, p_date, p_start, p_end, actor.id)
  returning * into v_row;
  insert into candidate_votes (candidate_id, participant_id)
  values (v_row.id, actor.id)
  on conflict (candidate_id, participant_id) do nothing;
  return v_row;
end;
$$;

-- edit_candidate: end optional; resets votes + notifies when the candidate had votes.
create or replace function edit_candidate(p_token text, p_candidate_id uuid, p_start time, p_end time default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  actor participants; c time_candidates; v_had_votes boolean; v_label text;
begin
  actor := _participant_from_token(p_token);
  select * into c from time_candidates where id = p_candidate_id;
  if c.id is null or c.room_id <> actor.room_id then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if c.created_by <> actor.id then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_end is not null and p_end <= p_start then
    raise exception 'invalid_time_range' using errcode = 'P0001';
  end if;

  v_had_votes := exists (select 1 from candidate_votes where candidate_id = p_candidate_id);
  v_label := (to_char(c.start_time, 'HH24:MI') || coalesce('–' || to_char(c.end_time, 'HH24:MI'), ''))
             || ' → '
             || (to_char(p_start, 'HH24:MI') || coalesce('–' || to_char(p_end, 'HH24:MI'), ''));

  update time_candidates
    set start_time = p_start, end_time = p_end,
        edit_history = edit_history || json_build_object(
          'by', actor.nickname, 'at', now(), 'change', v_label)::jsonb
    where id = p_candidate_id;

  if v_had_votes then
    delete from candidate_votes where candidate_id = p_candidate_id;
    insert into notifications(room_id, participant_id, type, related_date, related_candidate_id, detail)
      select c.room_id, p.id, 'candidate_edited', c.date, c.id, actor.nickname || ': ' || v_label
      from participants p where p.room_id = c.room_id and p.id <> actor.id;
  end if;
  insert into audit_logs(room_id, participant_id, action, detail)
    values (c.room_id, actor.id, 'edit_candidate', v_label);
  perform _touch_room(c.room_id);
end;
$$;

grant execute on function
  add_candidate(text, date, time, time),
  edit_candidate(text, uuid, time, time)
  to anon, authenticated;

notify pgrst, 'reload schema';
