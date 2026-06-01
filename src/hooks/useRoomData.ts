import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import {
  fetchAvailability,
  fetchCandidates,
  fetchComments,
  fetchParticipants,
  fetchRoom,
  fetchVotes,
} from '@/lib/api';

/**
 * Loads all room data and keeps it live via a single room-scoped realtime
 * channel. Any change to room tables simply invalidates the relevant query —
 * lightweight, and avoids fragile manual cache patching across clients.
 */
export function useRoomData(roomId: string | undefined) {
  const qc = useQueryClient();

  const room = useQuery({
    queryKey: qk.room(roomId ?? ''),
    queryFn: () => fetchRoom(roomId!),
    enabled: !!roomId,
  });
  const participants = useQuery({
    queryKey: qk.participants(roomId ?? ''),
    queryFn: () => fetchParticipants(roomId!),
    enabled: !!roomId,
  });
  const candidates = useQuery({
    queryKey: qk.candidates(roomId ?? ''),
    queryFn: () => fetchCandidates(roomId!),
    enabled: !!roomId,
  });
  const votes = useQuery({
    queryKey: qk.votes(roomId ?? ''),
    queryFn: () => fetchVotes(roomId!),
    enabled: !!roomId,
  });
  const availability = useQuery({
    queryKey: qk.availability(roomId ?? ''),
    queryFn: () => fetchAvailability(roomId!),
    enabled: !!roomId,
  });
  const comments = useQuery({
    queryKey: qk.comments(roomId ?? ''),
    queryFn: () => fetchComments(roomId!),
    enabled: !!roomId,
  });

  useEffect(() => {
    if (!roomId) return;
    const filter = `room_id=eq.${roomId}`;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () =>
        qc.invalidateQueries({ queryKey: qk.room(roomId) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter }, () =>
        qc.invalidateQueries({ queryKey: qk.participants(roomId) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_candidates', filter }, () => {
        qc.invalidateQueries({ queryKey: qk.candidates(roomId) });
        qc.invalidateQueries({ queryKey: qk.votes(roomId) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_votes' }, () =>
        qc.invalidateQueries({ queryKey: qk.votes(roomId) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_availability', filter }, () =>
        qc.invalidateQueries({ queryKey: qk.availability(roomId) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter }, () =>
        qc.invalidateQueries({ queryKey: qk.comments(roomId) }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, qc]);

  return {
    room: room.data,
    participants: participants.data ?? [],
    candidates: candidates.data ?? [],
    votes: votes.data ?? [],
    availability: availability.data ?? [],
    comments: comments.data ?? [],
    isLoading: room.isLoading || participants.isLoading || candidates.isLoading,
    error: room.error,
  };
}
