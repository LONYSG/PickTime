-- Multi-finalization: store an ordered list of finalized options.
-- Each entry: {"kind":"candidate","candidate_id":"uuid","date":"YYYY-MM-DD"}
--           | {"kind":"allday","date":"YYYY-MM-DD"}
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS finalized_options jsonb NOT NULL DEFAULT '[]';

CREATE OR REPLACE FUNCTION finalize_room_multi(p_token text, p_options jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  actor participants;
  first_opt jsonb;
  first_candidate_id uuid;
  first_date date;
BEGIN
  actor := _participant_from_token(p_token);
  IF actor.role NOT IN ('host', 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = 'P0001';
  END IF;
  IF jsonb_array_length(p_options) = 0 THEN
    RAISE EXCEPTION 'not_found' USING errcode = 'P0001';
  END IF;

  -- Derive backward-compat single fields from first option.
  first_opt := p_options -> 0;
  IF first_opt->>'kind' = 'candidate' THEN
    first_candidate_id := (first_opt->>'candidate_id')::uuid;
    SELECT date INTO first_date FROM time_candidates WHERE id = first_candidate_id;
  ELSE
    first_candidate_id := null;
    first_date := (first_opt->>'date')::date;
  END IF;

  UPDATE rooms
     SET is_finalized            = true,
         finalized_candidate_id  = first_candidate_id,
         finalized_date          = first_date,
         finalized_options       = p_options
   WHERE id = actor.room_id;

  INSERT INTO notifications(room_id, participant_id, type, related_date, related_candidate_id)
    SELECT actor.room_id, p.id, 'finalized', first_date, first_candidate_id
      FROM participants p WHERE p.room_id = actor.room_id AND p.id <> actor.id;
  INSERT INTO audit_logs(room_id, participant_id, action)
    VALUES (actor.room_id, actor.id, 'finalize');
  PERFORM _touch_room(actor.room_id);
END;
$$;

-- Update reopen_room to also clear finalized_options.
CREATE OR REPLACE FUNCTION reopen_room(p_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE actor participants;
BEGIN
  actor := _participant_from_token(p_token);
  IF actor.role NOT IN ('host', 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = 'P0001';
  END IF;
  UPDATE rooms
     SET is_finalized = false, finalized_candidate_id = null,
         finalized_date = null, finalized_options = '[]'
   WHERE id = actor.room_id;
  INSERT INTO notifications(room_id, participant_id, type)
    SELECT actor.room_id, p.id, 'reopened'
      FROM participants p WHERE p.room_id = actor.room_id AND p.id <> actor.id;
  INSERT INTO audit_logs(room_id, participant_id, action)
    VALUES (actor.room_id, actor.id, 'reopen');
  PERFORM _touch_room(actor.room_id);
END;
$$;

NOTIFY pgrst, 'reload schema';
