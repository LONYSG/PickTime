import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queryClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/components/ui/toast';
import {
  addCandidate,
  addComment,
  castVote,
  editCandidate,
  deleteCandidate,
  friendlyError,
  removeVote,
  setDateStatus,
  setSelfParticipation,
} from '@/lib/api';
import type { AvailabilityStatus, CandidateVote, DateAvailability } from '@/lib/types';

/**
 * All write actions for a room, with login-gating + optimistic cache updates.
 * Realtime invalidation reconciles the truth shortly after.
 */
export function useRoomActions(roomId: string) {
  const qc = useQueryClient();
  const { ensureAuth } = useAuth();

  async function toggleVote(candidateId: string, currentlyVoted: boolean) {
    const s = await ensureAuth();
    const key = qk.votes(roomId);
    const prev = qc.getQueryData<CandidateVote[]>(key) ?? [];
    // optimistic
    qc.setQueryData<CandidateVote[]>(key, (old = []) =>
      currentlyVoted
        ? old.filter((v) => !(v.candidate_id === candidateId && v.participant_id === s.participantId))
        : [
            ...old,
            {
              id: `optimistic-${candidateId}`,
              candidate_id: candidateId,
              participant_id: s.participantId,
              created_at: new Date().toISOString(),
            },
          ],
    );
    try {
      if (currentlyVoted) await removeVote(candidateId, s.participantId);
      else await castVote(candidateId, s.participantId);
    } catch (e) {
      qc.setQueryData(key, prev); // rollback
      toast.error(friendlyError(e));
    } finally {
      qc.invalidateQueries({ queryKey: key });
      // voting may auto-clear my "전체 불참" status (DB trigger)
      if (!currentlyVoted) qc.invalidateQueries({ queryKey: qk.participants(roomId) });
    }
  }

  /** Set my status for a date: 'all_day' | 'unavailable' | 'none' (clear). */
  async function setMyDateStatus(date: string, status: AvailabilityStatus | 'none') {
    const s = await ensureAuth();
    const key = qk.availability(roomId);
    const prev = qc.getQueryData<DateAvailability[]>(key) ?? [];
    qc.setQueryData<DateAvailability[]>(key, (old = []) => {
      const without = old.filter(
        (a) => !(a.date === date && a.participant_id === s.participantId),
      );
      if (status === 'none') return without;
      return [
        ...without,
        {
          id: `optimistic-${date}`,
          room_id: roomId,
          date,
          participant_id: s.participantId,
          is_all_day: status === 'all_day',
          status,
          created_at: new Date().toISOString(),
        },
      ];
    });
    try {
      await setDateStatus(s.token, date, status);
    } catch (e) {
      qc.setQueryData(key, prev);
      toast.error(friendlyError(e));
    } finally {
      qc.invalidateQueries({ queryKey: key });
      if (status === 'unavailable') qc.invalidateQueries({ queryKey: qk.votes(roomId) });
      // marking all-day may auto-clear my "전체 불참" status (DB trigger)
      if (status === 'all_day') qc.invalidateQueries({ queryKey: qk.participants(roomId) });
    }
  }

  /** Mark several dates "available all day" at once. */
  async function setMyDatesAllDay(dates: string[]) {
    if (dates.length === 0) return;
    const s = await ensureAuth();
    const key = qk.availability(roomId);
    const prev = qc.getQueryData<DateAvailability[]>(key) ?? [];
    qc.setQueryData<DateAvailability[]>(key, (old = []) => {
      const without = old.filter(
        (a) => !(dates.includes(a.date) && a.participant_id === s.participantId),
      );
      const added: DateAvailability[] = dates.map((date) => ({
        id: `optimistic-${date}`,
        room_id: roomId,
        date,
        participant_id: s.participantId,
        is_all_day: true,
        status: 'all_day',
        created_at: new Date().toISOString(),
      }));
      return [...without, ...added];
    });
    try {
      await Promise.all(dates.map((d) => setDateStatus(s.token, d, 'all_day')));
      toast.success(`${dates.length}일을 하루종일 가능으로 표시했어요.`);
    } catch (e) {
      qc.setQueryData(key, prev);
      toast.error(friendlyError(e));
    } finally {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: qk.participants(roomId) });
    }
  }

  /** Whole-room 불참 toggle (clears my votes/marks when turning on). */
  async function setMyParticipation(unavailable: boolean) {
    const s = await ensureAuth();
    try {
      await setSelfParticipation(s.token, unavailable);
      qc.invalidateQueries({ queryKey: qk.participants(roomId) });
      qc.invalidateQueries({ queryKey: qk.votes(roomId) });
      qc.invalidateQueries({ queryKey: qk.availability(roomId) });
      toast.success(unavailable ? '이 약속 전체 불참으로 표시했어요.' : '다시 참여로 전환했어요.');
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }

  async function createCandidate(date: string, start: string, end: string) {
    const s = await ensureAuth();
    try {
      const created = await addCandidate({ roomId, date, start, end, createdBy: s.participantId });
      // The creator implicitly supports the time they proposed.
      await castVote(created.id, s.participantId);
      qc.invalidateQueries({ queryKey: qk.candidates(roomId) });
      qc.invalidateQueries({ queryKey: qk.votes(roomId) });
      qc.invalidateQueries({ queryKey: qk.participants(roomId) });
      toast.success('시간 후보를 추가했어요.');
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }

  async function updateCandidate(candidateId: string, start: string, end: string) {
    const s = await ensureAuth();
    try {
      await editCandidate(s.token, candidateId, start, end);
      qc.invalidateQueries({ queryKey: qk.candidates(roomId) });
      qc.invalidateQueries({ queryKey: qk.votes(roomId) });
      toast.success('수정했어요. 기존 표는 초기화됐어요.');
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }

  async function removeCandidate(candidateId: string) {
    const s = await ensureAuth();
    try {
      await deleteCandidate(s.token, candidateId);
      qc.invalidateQueries({ queryKey: qk.candidates(roomId) });
      toast.success('삭제했어요.');
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }

  async function postComment(date: string, content: string) {
    const s = await ensureAuth();
    try {
      await addComment({ roomId, date, participantId: s.participantId, content });
      qc.invalidateQueries({ queryKey: qk.comments(roomId) });
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }

  return {
    toggleVote,
    setMyDateStatus,
    setMyDatesAllDay,
    setMyParticipation,
    createCandidate,
    updateCandidate,
    removeCandidate,
    postComment,
  };
}
