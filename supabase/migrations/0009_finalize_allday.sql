-- Add finalized_date so all-day options can be finalized without a time candidate.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS finalized_date DATE;

-- New RPC: finalize on a date only (no time candidate).
CREATE OR REPLACE FUNCTION finalize_room_allday(p_token text, p_date date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE actor participants;
BEGIN
  actor := _participant_from_token(p_token);
  IF actor.role NOT IN ('host', 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = 'P0001';
  END IF;
  IF p_date < (SELECT date_range_start FROM rooms WHERE id = actor.room_id)
  OR p_date > (SELECT date_range_end   FROM rooms WHERE id = actor.room_id) THEN
    RAISE EXCEPTION 'not_found' USING errcode = 'P0001';
  END IF;
  UPDATE rooms
     SET is_finalized = true, finalized_candidate_id = null, finalized_date = p_date
   WHERE id = actor.room_id;
  INSERT INTO notifications(room_id, participant_id, type, related_date)
    SELECT actor.room_id, p.id, 'finalized', p_date
      FROM participants p WHERE p.room_id = actor.room_id AND p.id <> actor.id;
  INSERT INTO audit_logs(room_id, participant_id, action)
    VALUES (actor.room_id, actor.id, 'finalize');
  PERFORM _touch_room(actor.room_id);
END;
$$;

-- Also clear finalized_date on reopen.
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
     SET is_finalized = false, finalized_candidate_id = null, finalized_date = null
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
