-- =============================================================================
-- Self-service PIN change. The participant proves they know their current PIN
-- (so a hijacked-but-unlocked session can't silently lock them out) and sets a
-- new one. Existing sessions stay valid — only host/admin reset force re-login.
-- =============================================================================
create or replace function change_pin(p_token text, p_old_pin text, p_new_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; a participant_auth;
begin
  actor := _participant_from_token(p_token);
  select * into a from participant_auth where participant_id = actor.id;
  if a.participant_id is null then
    raise exception 'participant_not_found' using errcode = 'P0001';
  end if;
  if a.pin_hash <> crypt(p_old_pin, a.pin_hash) then
    raise exception 'wrong_pin' using errcode = 'P0001';
  end if;
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'pin_must_be_4_digits' using errcode = 'P0001';
  end if;
  update participant_auth
    set pin_hash = crypt(p_new_pin, gen_salt('bf')), pin_attempts = 0, pin_locked_until = null
    where participant_id = actor.id;
end;
$$;

grant execute on function change_pin(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
