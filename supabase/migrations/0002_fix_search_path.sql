-- =============================================================================
-- Fix: pgcrypto functions (crypt, gen_salt, gen_random_bytes, digest) live in
-- the `extensions` schema on Supabase, but our SECURITY DEFINER functions were
-- created with `search_path = public` only — so they couldn't resolve them at
-- call time. This re-points every function's search_path to include
-- `extensions`. Safe to run repeatedly.
-- =============================================================================
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as f
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_room', 'join_room', 'login_participant', 'verify_room_password',
        'reset_participant_pin', 'rename_participant', 'set_participant_role',
        'edit_candidate', 'delete_candidate', 'finalize_room', 'reopen_room',
        'update_room_settings', 'delete_room',
        '_participant_from_token', '_issue_token', '_touch_room',
        'delete_expired_rooms', 'trg_touch_room_from_child',
        'trg_touch_room_from_vote', 'trg_notify_comment'
      )
  loop
    execute format('alter function %s set search_path = public, extensions', r.f);
  end loop;
end;
$$;
