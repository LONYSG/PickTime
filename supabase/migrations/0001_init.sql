-- =============================================================================
-- PickTime — initial schema
-- =============================================================================
-- Design notes (lightweight, friends-only scheduling app):
--   * No Supabase Auth. Identity = a participant row + an opaque session token.
--   * Secret hashes (room password, participant PIN) live in dedicated *_secrets
--     / participant_auth tables that anon has ZERO access to and that are NEVER
--     added to the realtime publication. They are only touched by SECURITY
--     DEFINER RPCs below. This keeps bcrypt hashes off the client entirely.
--   * Everyday writes (votes, all-day, comments, adding candidates) go straight
--     to tables via PostgREST under permissive room-scoped RLS — keeps the UI
--     fast and realtime-friendly. Privileged / fairness-sensitive actions
--     (editing a voted candidate, finalize, role changes, PIN reset, delete)
--     go through token-checked RPCs.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table rooms (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 1 and 80),
  date_range_start      date not null,
  date_range_end        date not null,
  has_password          boolean not null default false,
  host_participant_id   uuid,                       -- FK added after participants
  is_finalized          boolean not null default false,
  finalized_candidate_id uuid,                      -- FK added after time_candidates
  created_at            timestamptz not null default now(),
  last_activity_at      timestamptz not null default now(),
  check (date_range_end >= date_range_start)
);

create table room_secrets (
  room_id       uuid primary key references rooms(id) on delete cascade,
  password_hash text not null
);

create table participants (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  nickname      text not null check (char_length(nickname) between 1 and 24),
  color_hex     text not null check (color_hex ~* '^#[0-9a-f]{6}$'),
  role          text not null default 'participant'
                  check (role in ('host', 'admin', 'participant')),
  created_at    timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  unique (room_id, color_hex)
);

-- Nickname uniqueness is case-insensitive, so it needs an expression index
-- (UNIQUE table constraints can't contain expressions like lower()).
create unique index uniq_participant_nickname
  on participants (room_id, lower(nickname));

create table participant_auth (
  participant_id     uuid primary key references participants(id) on delete cascade,
  pin_hash           text not null,
  pin_attempts       int not null default 0,
  pin_locked_until   timestamptz,
  session_token_hash text,
  session_expires_at timestamptz
);

create table time_candidates (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  date         date not null,
  start_time   time not null,
  end_time     time not null,
  created_by   uuid references participants(id) on delete set null,
  created_at   timestamptz not null default now(),
  edit_history jsonb not null default '[]'::jsonb,
  check (end_time > start_time)
);

create table candidate_votes (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references time_candidates(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (candidate_id, participant_id)
);

create table date_availability (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete cascade,
  date           date not null,
  participant_id uuid not null references participants(id) on delete cascade,
  is_all_day     boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (room_id, date, participant_id)
);

create table comments (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete cascade,
  date           date not null,
  participant_id uuid references participants(id) on delete set null,
  content        text not null check (char_length(content) between 1 and 500),
  created_at     timestamptz not null default now()
);

create table notifications (
  id                   uuid primary key default gen_random_uuid(),
  room_id              uuid not null references rooms(id) on delete cascade,
  participant_id       uuid not null references participants(id) on delete cascade,
  type                 text not null,
  related_date         date,
  related_candidate_id uuid,
  detail               text,
  is_read              boolean not null default false,
  created_at           timestamptz not null default now()
);

create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete cascade,
  participant_id uuid references participants(id) on delete set null,
  action         text not null,
  detail         text,
  created_at     timestamptz not null default now()
);

-- Deferred / circular foreign keys
alter table rooms
  add constraint rooms_host_fk
  foreign key (host_participant_id) references participants(id) on delete set null;
alter table rooms
  add constraint rooms_finalized_candidate_fk
  foreign key (finalized_candidate_id) references time_candidates(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index idx_participants_room       on participants(room_id);
create index idx_candidates_room         on time_candidates(room_id);
create index idx_candidates_date         on time_candidates(room_id, date);
create index idx_votes_candidate         on candidate_votes(candidate_id);
create index idx_votes_participant       on candidate_votes(participant_id);
create index idx_availability_room       on date_availability(room_id, date);
create index idx_availability_participant on date_availability(participant_id);
create index idx_comments_room           on comments(room_id, date);
create index idx_comments_participant    on comments(participant_id);
create index idx_notifications_recipient on notifications(participant_id, is_read);
create index idx_audit_room              on audit_logs(room_id);

-- Delete payloads need full old row so realtime knows which vote/day was removed
alter table candidate_votes   replica identity full;
alter table date_availability replica identity full;

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Public-readable, room-scoped writable tables. anon holds the API key; rooms
-- are unlisted UUIDs. This matches the "anon key + RLS is enough" brief.
alter table rooms             enable row level security;
alter table participants      enable row level security;
alter table time_candidates   enable row level security;
alter table candidate_votes   enable row level security;
alter table date_availability enable row level security;
alter table comments          enable row level security;
alter table notifications     enable row level security;
alter table audit_logs        enable row level security;

-- Secret tables: RLS on, no policies → no anon access at all (RPCs use DEFINER).
alter table room_secrets     enable row level security;
alter table participant_auth enable row level security;

-- Read access (viewer-on-entry): everyone can read room content.
create policy read_rooms        on rooms             for select using (true);
create policy read_participants on participants      for select using (true);
create policy read_candidates   on time_candidates   for select using (true);
create policy read_votes        on candidate_votes   for select using (true);
create policy read_availability on date_availability for select using (true);
create policy read_comments     on comments          for select using (true);
create policy read_audit        on audit_logs        for select using (true);
-- Notifications are readable by anyone holding the key (room-scoped UUIDs);
-- the client filters to its own participant_id.
create policy read_notifications on notifications     for select using (true);

-- Everyday participant writes (no role gate; friends-only threat model).
create policy write_candidates   on time_candidates
  for insert with check (true);
create policy write_votes        on candidate_votes
  for all using (true) with check (true);
create policy write_availability on date_availability
  for all using (true) with check (true);
create policy write_comments     on comments
  for insert with check (true);
-- Mark own notifications read.
create policy update_notifications on notifications
  for update using (true) with check (true);

-- NOTE: rooms / participants / finalize / role / pin changes flow through the
-- SECURITY DEFINER RPCs below, which bypass RLS and enforce token + role.

-- =============================================================================
-- Helpers
-- =============================================================================

-- Resolve a session token to its participant row; raises if invalid/expired.
create or replace function _participant_from_token(p_token text)
returns participants
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_part participants;
begin
  select p.* into v_part
  from participant_auth a
  join participants p on p.id = a.participant_id
  where a.session_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and a.session_expires_at > now();

  if v_part.id is null then
    raise exception 'invalid_session' using errcode = 'P0001';
  end if;
  return v_part;
end;
$$;

-- Issue a fresh session token for a participant, return the raw token.
create or replace function _issue_token(p_participant_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
begin
  update participant_auth
  set session_token_hash = encode(digest(v_token, 'sha256'), 'hex'),
      session_expires_at = now() + interval '60 days'
  where participant_id = p_participant_id;
  return v_token;
end;
$$;

create or replace function _touch_room(p_room_id uuid)
returns void language sql security definer set search_path = public, extensions as $$
  update rooms set last_activity_at = now() where id = p_room_id;
$$;

-- =============================================================================
-- RPCs — identity & rooms
-- =============================================================================

-- Create a room + its host participant. Returns ids + the host's session token.
create or replace function create_room(
  p_title         text,
  p_date_start    date,
  p_date_end      date,
  p_host_nickname text,
  p_host_color    text,
  p_host_pin      text,
  p_password      text default null
) returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_part_id uuid;
  v_token   text;
begin
  if p_host_pin !~ '^[0-9]{4}$' then
    raise exception 'pin_must_be_4_digits' using errcode = 'P0001';
  end if;

  insert into rooms (title, date_range_start, date_range_end, has_password)
  values (p_title, p_date_start, p_date_end, p_password is not null)
  returning id into v_room_id;

  if p_password is not null then
    insert into room_secrets (room_id, password_hash)
    values (v_room_id, crypt(p_password, gen_salt('bf')));
  end if;

  insert into participants (room_id, nickname, color_hex, role)
  values (v_room_id, p_host_nickname, p_host_color, 'host')
  returning id into v_part_id;

  insert into participant_auth (participant_id, pin_hash)
  values (v_part_id, crypt(p_host_pin, gen_salt('bf')));

  update rooms set host_participant_id = v_part_id where id = v_room_id;

  v_token := _issue_token(v_part_id);
  return json_build_object('room_id', v_room_id, 'participant_id', v_part_id, 'token', v_token);
end;
$$;

-- Verify a room password. Returns true/false.
create or replace function verify_room_password(p_room_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from room_secrets where room_id = p_room_id;
  if v_hash is null then
    return true; -- no password set
  end if;
  return v_hash = crypt(p_password, v_hash);
end;
$$;

-- New participant joins. Enforces nickname + color uniqueness. Returns token.
create or replace function join_room(
  p_room_id  uuid,
  p_nickname text,
  p_color    text,
  p_pin      text
) returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_part_id uuid;
  v_token   text;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'pin_must_be_4_digits' using errcode = 'P0001';
  end if;
  if not exists (select 1 from rooms where id = p_room_id) then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from participants
             where room_id = p_room_id and lower(nickname) = lower(p_nickname)) then
    raise exception 'nickname_taken' using errcode = 'P0001';
  end if;
  if exists (select 1 from participants
             where room_id = p_room_id and color_hex = p_color) then
    raise exception 'color_taken' using errcode = 'P0001';
  end if;

  insert into participants (room_id, nickname, color_hex, role)
  values (p_room_id, p_nickname, p_color, 'participant')
  returning id into v_part_id;

  insert into participant_auth (participant_id, pin_hash)
  values (v_part_id, crypt(p_pin, gen_salt('bf')));

  perform _touch_room(p_room_id);
  v_token := _issue_token(v_part_id);
  return json_build_object('participant_id', v_part_id, 'token', v_token);
end;
$$;

-- Existing participant logs in with PIN. Handles lockout (5 tries / 5 min).
create or replace function login_participant(p_participant_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a participant_auth;
  v_token text;
begin
  select * into a from participant_auth where participant_id = p_participant_id;
  if a.participant_id is null then
    raise exception 'participant_not_found' using errcode = 'P0001';
  end if;

  if a.pin_locked_until is not null and a.pin_locked_until > now() then
    return json_build_object('ok', false, 'locked_until', a.pin_locked_until);
  end if;

  if a.pin_hash = crypt(p_pin, a.pin_hash) then
    update participant_auth
      set pin_attempts = 0, pin_locked_until = null
      where participant_id = p_participant_id;
    update participants set last_active_at = now() where id = p_participant_id;
    v_token := _issue_token(p_participant_id);
    return json_build_object('ok', true, 'token', v_token);
  else
    update participant_auth
      set pin_attempts = pin_attempts + 1,
          pin_locked_until = case when pin_attempts + 1 >= 5
                                  then now() + interval '5 minutes' else null end
      where participant_id = p_participant_id
      returning pin_attempts, pin_locked_until into a.pin_attempts, a.pin_locked_until;
    return json_build_object('ok', false,
      'attempts', a.pin_attempts, 'locked_until', a.pin_locked_until);
  end if;
end;
$$;

-- =============================================================================
-- RPCs — privileged (token + role enforced)
-- =============================================================================

create or replace function reset_participant_pin(
  p_token text, p_target_id uuid, p_new_pin text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
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
    set pin_hash = crypt(p_new_pin, gen_salt('bf')),
        pin_attempts = 0, pin_locked_until = null, session_token_hash = null
    where participant_id = p_target_id;
  insert into audit_logs(room_id, participant_id, action, detail)
    values (actor.room_id, actor.id, 'reset_pin', target.nickname);
end;
$$;

create or replace function rename_participant(
  p_token text, p_target_id uuid, p_nickname text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
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
  if exists (select 1 from participants
             where room_id = actor.room_id and lower(nickname) = lower(p_nickname)
               and id <> p_target_id) then
    raise exception 'nickname_taken' using errcode = 'P0001';
  end if;
  update participants set nickname = p_nickname where id = p_target_id;
  insert into audit_logs(room_id, participant_id, action, detail)
    values (actor.room_id, actor.id, 'rename', target.nickname || ' → ' || p_nickname);
end;
$$;

create or replace function set_participant_role(
  p_token text, p_target_id uuid, p_role text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; target participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role not in ('host', 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_role not in ('admin', 'participant') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  select * into target from participants where id = p_target_id;
  if target.room_id <> actor.room_id or target.role = 'host' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update participants set role = p_role where id = p_target_id;
  insert into notifications(room_id, participant_id, type, detail)
    values (actor.room_id, p_target_id, 'role_change', p_role);
  insert into audit_logs(room_id, participant_id, action, detail)
    values (actor.room_id, actor.id, 'set_role', target.nickname || ' → ' || p_role);
end;
$$;

-- Edit a candidate. Owner only. If it had votes: reset them, log, notify all.
create or replace function edit_candidate(
  p_token text, p_candidate_id uuid, p_start time, p_end time
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor participants; c time_candidates; v_had_votes boolean; v_label text;
begin
  actor := _participant_from_token(p_token);
  select * into c from time_candidates where id = p_candidate_id;
  if c.id is null or c.room_id <> actor.room_id then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if c.created_by <> actor.id then
    raise exception 'forbidden' using errcode = 'P0001'; -- own candidates only
  end if;
  if p_end <= p_start then
    raise exception 'invalid_time_range' using errcode = 'P0001';
  end if;

  v_had_votes := exists (select 1 from candidate_votes where candidate_id = p_candidate_id);
  v_label := to_char(c.start_time, 'HH24:MI') || '–' || to_char(c.end_time, 'HH24:MI')
             || ' → ' || to_char(p_start, 'HH24:MI') || '–' || to_char(p_end, 'HH24:MI');

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

create or replace function delete_candidate(p_token text, p_candidate_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; c time_candidates;
begin
  actor := _participant_from_token(p_token);
  select * into c from time_candidates where id = p_candidate_id;
  if c.id is null or c.room_id <> actor.room_id then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  -- host/admin may delete any; owner may delete their own
  if actor.role not in ('host', 'admin') and c.created_by <> actor.id then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  delete from time_candidates where id = p_candidate_id;
  perform _touch_room(c.room_id);
end;
$$;

create or replace function finalize_room(p_token text, p_candidate_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor participants; c time_candidates;
begin
  actor := _participant_from_token(p_token);
  if actor.role not in ('host', 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select * into c from time_candidates where id = p_candidate_id;
  if c.id is null or c.room_id <> actor.room_id then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update rooms set is_finalized = true, finalized_candidate_id = p_candidate_id
    where id = actor.room_id;
  insert into notifications(room_id, participant_id, type, related_date, related_candidate_id)
    select actor.room_id, p.id, 'finalized', c.date, c.id
    from participants p where p.room_id = actor.room_id and p.id <> actor.id;
  insert into audit_logs(room_id, participant_id, action) values (actor.room_id, actor.id, 'finalize');
  perform _touch_room(actor.room_id);
end;
$$;

create or replace function reopen_room(p_token text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role not in ('host', 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update rooms set is_finalized = false, finalized_candidate_id = null
    where id = actor.room_id;
  insert into notifications(room_id, participant_id, type)
    select actor.room_id, p.id, 'reopened'
    from participants p where p.room_id = actor.room_id and p.id <> actor.id;
  insert into audit_logs(room_id, participant_id, action) values (actor.room_id, actor.id, 'reopen');
  perform _touch_room(actor.room_id);
end;
$$;

create or replace function update_room_settings(
  p_token text, p_title text, p_date_start date, p_date_end date, p_password text default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role not in ('host', 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update rooms
    set title = coalesce(p_title, title),
        date_range_start = coalesce(p_date_start, date_range_start),
        date_range_end = coalesce(p_date_end, date_range_end),
        has_password = (p_password is not null) or has_password
    where id = actor.room_id;
  if p_password is not null then
    insert into room_secrets(room_id, password_hash)
    values (actor.room_id, crypt(p_password, gen_salt('bf')))
    on conflict (room_id) do update set password_hash = excluded.password_hash;
  end if;
  perform _touch_room(actor.room_id);
end;
$$;

create or replace function delete_room(p_token text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor participants;
begin
  actor := _participant_from_token(p_token);
  if actor.role <> 'host' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  delete from rooms where id = actor.room_id; -- cascades to all children
end;
$$;

-- =============================================================================
-- Triggers — activity touch + comment notifications
-- =============================================================================

create or replace function trg_touch_room_from_child()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  update rooms set last_activity_at = now()
    where id = coalesce(NEW.room_id, OLD.room_id);
  return coalesce(NEW, OLD);
end;
$$;

create trigger touch_on_candidate after insert on time_candidates
  for each row execute function trg_touch_room_from_child();
create trigger touch_on_availability after insert or delete on date_availability
  for each row execute function trg_touch_room_from_child();
create trigger touch_on_comment after insert on comments
  for each row execute function trg_touch_room_from_child();

-- candidate_votes has no room_id; touch via candidate.
create or replace function trg_touch_room_from_vote()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  update rooms set last_activity_at = now()
    where id = (select room_id from time_candidates
                where id = coalesce(NEW.candidate_id, OLD.candidate_id));
  return coalesce(NEW, OLD);
end;
$$;
create trigger touch_on_vote after insert or delete on candidate_votes
  for each row execute function trg_touch_room_from_vote();

-- New comment → notify every other participant in the room.
create or replace function trg_notify_comment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into notifications(room_id, participant_id, type, related_date, detail)
    select NEW.room_id, p.id, 'comment', NEW.date, left(NEW.content, 60)
    from participants p
    where p.room_id = NEW.room_id and p.id <> NEW.participant_id;
  return NEW;
end;
$$;
create trigger notify_on_comment after insert on comments
  for each row execute function trg_notify_comment();

-- =============================================================================
-- Grants — let anon execute the RPCs (and authenticated, for completeness)
-- =============================================================================
grant execute on function
  create_room(text, date, date, text, text, text, text),
  verify_room_password(uuid, text),
  join_room(uuid, text, text, text),
  login_participant(uuid, text),
  reset_participant_pin(text, uuid, text),
  rename_participant(text, uuid, text),
  set_participant_role(text, uuid, text),
  edit_candidate(text, uuid, time, time),
  delete_candidate(text, uuid),
  finalize_room(text, uuid),
  reopen_room(text),
  update_room_settings(text, text, date, date, text),
  delete_room(text)
  to anon, authenticated;

-- Internal helpers must NOT be callable directly by clients.
revoke execute on function
  _participant_from_token(text), _issue_token(uuid), _touch_room(uuid)
  from anon, authenticated, public;

-- =============================================================================
-- Realtime — broadcast only non-secret, room-scoped tables
-- =============================================================================
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table time_candidates;
alter publication supabase_realtime add table candidate_votes;
alter publication supabase_realtime add table date_availability;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table notifications;

-- =============================================================================
-- Auto-expiry cleanup
-- =============================================================================
-- Delete a room once EITHER:
--   * 7 days have passed since its last calendar date, OR
--   * 30 days have passed since any activity in the room.
create or replace function delete_expired_rooms()
returns void language sql security definer set search_path = public, extensions as $$
  delete from rooms
  where now() > least(
    (date_range_end + interval '7 days'),
    (last_activity_at + interval '30 days')
  );
$$;

-- Schedule daily at 03:10 KST (18:10 UTC). Requires pg_cron (enable in
-- Supabase: Database → Extensions → pg_cron). Wrapped so the migration still
-- succeeds if pg_cron is not yet enabled.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('picktime-cleanup', '10 18 * * *',
      'select public.delete_expired_rooms();');
  end if;
exception when others then
  raise notice 'pg_cron not configured; schedule delete_expired_rooms() manually.';
end;
$$;
