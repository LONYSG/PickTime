// App-facing domain types. These mirror the public (non-secret) columns the
// client is allowed to read. Hash/secret tables are intentionally absent —
// they're only ever touched by SECURITY DEFINER RPCs.

export type Role = 'host' | 'admin' | 'participant';

/** active = normal · unavailable = declared 전체 불참 · left = 탈퇴/추방됨 */
export type ParticipantStatus = 'active' | 'unavailable' | 'left';

export type AvailabilityStatus = 'all_day' | 'unavailable';

export interface FinalizedOption {
  kind: 'candidate' | 'allday';
  candidate_id?: string;
  date: string;
}

export interface Room {
  id: string;
  title: string;
  date_range_start: string; // YYYY-MM-DD
  date_range_end: string; // YYYY-MM-DD
  has_password: boolean;
  host_participant_id: string | null;
  is_finalized: boolean;
  finalized_candidate_id: string | null;
  finalized_date: string | null; // YYYY-MM-DD
  finalized_options: FinalizedOption[];
  created_at: string;
  last_activity_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  nickname: string;
  color_hex: string;
  role: Role;
  status: ParticipantStatus;
  created_at: string;
  last_active_at: string;
}

export interface EditHistoryEntry {
  by: string;
  at: string;
  change: string;
}

export interface TimeCandidate {
  id: string;
  room_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string | null; // HH:MM:SS — null when only a start time was set
  created_by: string | null;
  created_at: string;
  edit_history: EditHistoryEntry[];
}

export interface CandidateVote {
  id: string;
  candidate_id: string;
  participant_id: string;
  room_id?: string; // populated by a DB trigger; used for realtime scoping
  created_at: string;
}

export interface DateAvailability {
  id: string;
  room_id: string;
  date: string;
  participant_id: string;
  is_all_day: boolean;
  status: AvailabilityStatus;
  created_at: string;
}

export interface Comment {
  id: string;
  room_id: string;
  date: string;
  participant_id: string | null;
  content: string;
  created_at: string;
}

export type NotificationType =
  | 'comment'
  | 'candidate_edited'
  | 'finalized'
  | 'reopened'
  | 'role_change'
  | 'range_changed'
  | 'votes_cancelled';

export interface AppNotification {
  id: string;
  room_id: string;
  participant_id: string;
  type: NotificationType;
  related_date: string | null;
  related_candidate_id: string | null;
  detail: string | null;
  is_read: boolean;
  created_at: string;
}

/** Session persisted in localStorage after login/join. */
export interface Session {
  roomId: string;
  participantId: string;
  token: string;
  nickname: string;
  color: string;
  role: Role;
  roomTitle?: string;
  joinedAt?: string; // ISO string, for sorting recent rooms
}
