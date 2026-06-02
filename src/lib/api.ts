import { supabase } from './supabase';
import type {
  AppNotification,
  Comment,
  CandidateVote,
  DateAvailability,
  Participant,
  Room,
  TimeCandidate,
} from './types';

/** Map a Postgres RPC error code/message to a friendly Korean message. */
export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? '';
  const map: Record<string, string> = {
    nickname_taken: '이미 사용 중인 닉네임이에요.',
    color_taken: '이미 선택된 색상이에요.',
    pin_must_be_4_digits: 'PIN은 숫자 4자리여야 해요.',
    room_not_found: '방을 찾을 수 없어요.',
    participant_not_found: '참가자를 찾을 수 없어요.',
    forbidden: '권한이 없어요.',
    invalid_session: '세션이 만료됐어요. 다시 로그인해 주세요.',
    invalid_time_range: '종료 시간이 시작 시간보다 늦어야 해요.',
    not_found: '대상을 찾을 수 없어요.',
    host_cannot_leave: '방장은 나갈 수 없어요. 방을 삭제하거나 그대로 두세요.',
    invalid_status: '잘못된 상태예요.',
    room_finalized: '일정이 확정된 방이에요. 변경하려면 방을 다시 열어야 해요.',
    not_a_member: '더 이상 이 방의 멤버가 아니에요.',
    wrong_pin: '현재 PIN이 일치하지 않아요.',
  };
  for (const key of Object.keys(map)) if (msg.includes(key)) return map[key];
  return '문제가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

// ---- Reads ----------------------------------------------------------------

export async function fetchRoom(roomId: string): Promise<Room> {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (error) throw error;
  return data as Room;
}

export async function fetchParticipants(roomId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at');
  if (error) throw error;
  return data as Participant[];
}

export async function fetchCandidates(roomId: string): Promise<TimeCandidate[]> {
  const { data, error } = await supabase
    .from('time_candidates')
    .select('*')
    .eq('room_id', roomId)
    .order('date')
    .order('start_time');
  if (error) throw error;
  return data as TimeCandidate[];
}

export async function fetchVotes(roomId: string): Promise<CandidateVote[]> {
  // votes have no room_id; join through candidates by room.
  const { data, error } = await supabase
    .from('candidate_votes')
    .select('*, time_candidates!inner(room_id)')
    .eq('time_candidates.room_id', roomId);
  if (error) throw error;
  return (data as (CandidateVote & { time_candidates: unknown })[]).map(
    ({ time_candidates: _omit, ...v }) => v,
  );
}

export async function fetchAvailability(roomId: string): Promise<DateAvailability[]> {
  const { data, error } = await supabase
    .from('date_availability')
    .select('*')
    .eq('room_id', roomId);
  if (error) throw error;
  return data as DateAvailability[];
}

export async function fetchComments(roomId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at');
  if (error) throw error;
  return data as Comment[];
}

export async function fetchNotifications(participantId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as AppNotification[];
}

// ---- Auth / identity RPCs -------------------------------------------------

export async function createRoom(args: {
  title: string;
  dateStart: string;
  dateEnd: string;
  nickname: string;
  color: string;
  pin: string;
  password?: string | null;
}) {
  const { data, error } = await supabase.rpc('create_room', {
    p_title: args.title,
    p_date_start: args.dateStart,
    p_date_end: args.dateEnd,
    p_host_nickname: args.nickname,
    p_host_color: args.color,
    p_host_pin: args.pin,
    p_password: args.password ?? null,
  });
  if (error) throw error;
  return data as { room_id: string; participant_id: string; token: string };
}

export async function verifyRoomPassword(roomId: string, password: string) {
  const { data, error } = await supabase.rpc('verify_room_password', {
    p_room_id: roomId,
    p_password: password,
  });
  if (error) throw error;
  return data as boolean;
}

export async function joinRoom(args: {
  roomId: string;
  nickname: string;
  color: string;
  pin: string;
}) {
  const { data, error } = await supabase.rpc('join_room', {
    p_room_id: args.roomId,
    p_nickname: args.nickname,
    p_color: args.color,
    p_pin: args.pin,
  });
  if (error) throw error;
  return data as { participant_id: string; token: string };
}

export async function loginParticipant(participantId: string, pin: string) {
  const { data, error } = await supabase.rpc('login_participant', {
    p_participant_id: participantId,
    p_pin: pin,
  });
  if (error) throw error;
  return data as
    | { ok: true; token: string }
    | { ok: false; attempts?: number; locked_until?: string };
}

// ---- Everyday writes (token-checked RPCs; caller derived server-side) ------

/** Add a time candidate. The RPC also auto-votes the creator. Returns the row. */
export async function addCandidate(args: {
  token: string;
  date: string;
  start: string;
  end: string | null;
}) {
  const { data, error } = await supabase.rpc('add_candidate', {
    p_token: args.token,
    p_date: args.date,
    p_start: args.start,
    p_end: args.end,
  });
  if (error) throw error;
  return data as TimeCandidate;
}

export async function castVote(token: string, candidateId: string) {
  const { error } = await supabase.rpc('cast_vote', {
    p_token: token,
    p_candidate_id: candidateId,
  });
  if (error) throw error;
}

export async function removeVote(token: string, candidateId: string) {
  const { error } = await supabase.rpc('remove_vote', {
    p_token: token,
    p_candidate_id: candidateId,
  });
  if (error) throw error;
}

/** Set the caller's status for a date: all_day / unavailable / none (clear). */
export async function setDateStatus(token: string, date: string, status: 'all_day' | 'unavailable' | 'none') {
  const { error } = await supabase.rpc('set_date_status', {
    p_token: token,
    p_date: date,
    p_status: status,
  });
  if (error) throw error;
}

export async function addComment(args: { token: string; date: string; content: string }) {
  const { error } = await supabase.rpc('add_comment', {
    p_token: args.token,
    p_date: args.date,
    p_content: args.content,
  });
  if (error) throw error;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(participantId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('participant_id', participantId)
    .eq('is_read', false);
  if (error) throw error;
}

// ---- Privileged RPCs ------------------------------------------------------

export async function editCandidate(
  token: string,
  candidateId: string,
  start: string,
  end: string | null,
) {
  const { error } = await supabase.rpc('edit_candidate', {
    p_token: token,
    p_candidate_id: candidateId,
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
}

export async function deleteCandidate(token: string, candidateId: string) {
  const { error } = await supabase.rpc('delete_candidate', {
    p_token: token,
    p_candidate_id: candidateId,
  });
  if (error) throw error;
}

export async function finalizeRoom(token: string, candidateId: string) {
  const { error } = await supabase.rpc('finalize_room', {
    p_token: token,
    p_candidate_id: candidateId,
  });
  if (error) throw error;
}

export async function reopenRoom(token: string) {
  const { error } = await supabase.rpc('reopen_room', { p_token: token });
  if (error) throw error;
}

export async function renameParticipant(token: string, targetId: string, nickname: string) {
  const { error } = await supabase.rpc('rename_participant', {
    p_token: token,
    p_target_id: targetId,
    p_nickname: nickname,
  });
  if (error) throw error;
}

export async function setParticipantRole(token: string, targetId: string, role: 'admin' | 'participant') {
  const { error } = await supabase.rpc('set_participant_role', {
    p_token: token,
    p_target_id: targetId,
    p_role: role,
  });
  if (error) throw error;
}

export async function changePin(token: string, oldPin: string, newPin: string) {
  const { error } = await supabase.rpc('change_pin', {
    p_token: token,
    p_old_pin: oldPin,
    p_new_pin: newPin,
  });
  if (error) throw error;
}

export async function resetParticipantPin(token: string, targetId: string, newPin: string) {
  const { error } = await supabase.rpc('reset_participant_pin', {
    p_token: token,
    p_target_id: targetId,
    p_new_pin: newPin,
  });
  if (error) throw error;
}

export async function updateRoomSettings(args: {
  token: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  password?: string | null;
}) {
  const { error } = await supabase.rpc('update_room_settings', {
    p_token: args.token,
    p_title: args.title,
    p_date_start: args.dateStart,
    p_date_end: args.dateEnd,
    p_password: args.password ?? null,
  });
  if (error) throw error;
}

export async function deleteRoom(token: string) {
  const { error } = await supabase.rpc('delete_room', { p_token: token });
  if (error) throw error;
}

/** Host only. Blank/empty password removes protection. */
export async function setRoomPassword(token: string, password: string | null) {
  const { error } = await supabase.rpc('set_room_password', {
    p_token: token,
    p_password: password && password.length > 0 ? password : null,
  });
  if (error) throw error;
}

export async function setSelfParticipation(token: string, unavailable: boolean) {
  const { error } = await supabase.rpc('set_self_participation', {
    p_token: token,
    p_unavailable: unavailable,
  });
  if (error) throw error;
}

export async function leaveRoom(token: string) {
  const { error } = await supabase.rpc('leave_room', { p_token: token });
  if (error) throw error;
}

export async function kickParticipant(token: string, targetId: string) {
  const { error } = await supabase.rpc('kick_participant', {
    p_token: token,
    p_target_id: targetId,
  });
  if (error) throw error;
}

export async function transferHost(token: string, newHostId: string) {
  const { error } = await supabase.rpc('transfer_host', {
    p_token: token,
    p_new_host_id: newHostId,
  });
  if (error) throw error;
}

export async function finalizeRoomAllDay(token: string, date: string) {
  const { error } = await supabase.rpc('finalize_room_allday', {
    p_token: token,
    p_date: date,
  });
  if (error) throw error;
}

export async function finalizeRoomMulti(
  token: string,
  options: Array<{ kind: 'candidate' | 'allday'; candidate_id?: string; date: string }>,
) {
  const { error } = await supabase.rpc('finalize_room_multi', {
    p_token: token,
    p_options: options,
  });
  if (error) throw error;
}
