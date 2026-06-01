import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { fetchNotifications } from '@/lib/api';

/** Live notifications for the logged-in participant (own rows only). */
export function useNotifications(participantId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: qk.notifications(participantId ?? ''),
    queryFn: () => fetchNotifications(participantId!),
    enabled: !!participantId,
  });

  useEffect(() => {
    if (!participantId) return;
    const channel = supabase
      .channel(`notif:${participantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `participant_id=eq.${participantId}`,
        },
        () => qc.invalidateQueries({ queryKey: qk.notifications(participantId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [participantId, qc]);

  const notifications = query.data ?? [];
  const unread = notifications.filter((n) => !n.is_read).length;
  return { notifications, unread };
}
