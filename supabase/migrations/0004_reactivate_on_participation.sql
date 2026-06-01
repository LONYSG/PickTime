-- =============================================================================
-- Auto-clear "전체 불참" (participants.status='unavailable') when the member
-- takes any participating action: voting, marking a date all-day, or creating
-- a candidate. Marking a date *unavailable* does NOT clear it (still 불참).
-- Implemented as triggers because votes/availability/candidates are written
-- directly to tables (not via RPC).
-- =============================================================================

create or replace function trg_reactivate_participant()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  pid uuid;
begin
  if tg_table_name = 'candidate_votes' then
    pid := NEW.participant_id;
  elsif tg_table_name = 'date_availability' then
    if NEW.status <> 'all_day' then
      return NEW; -- per-date 불참 is not a participating action
    end if;
    pid := NEW.participant_id;
  elsif tg_table_name = 'time_candidates' then
    pid := NEW.created_by;
  end if;

  if pid is not null then
    update participants set status = 'active'
      where id = pid and status = 'unavailable';
  end if;
  return NEW;
end;
$$;

drop trigger if exists reactivate_on_vote on candidate_votes;
create trigger reactivate_on_vote after insert on candidate_votes
  for each row execute function trg_reactivate_participant();

drop trigger if exists reactivate_on_availability on date_availability;
create trigger reactivate_on_availability after insert or update on date_availability
  for each row execute function trg_reactivate_participant();

drop trigger if exists reactivate_on_candidate on time_candidates;
create trigger reactivate_on_candidate after insert on time_candidates
  for each row execute function trg_reactivate_participant();
