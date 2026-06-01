import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '@/lib/types';

interface SessionState {
  // keyed by roomId so a user can hold a session per room
  sessions: Record<string, Session>;
  setSession: (s: Session) => void;
  clearSession: (roomId: string) => void;
  getSession: (roomId: string) => Session | undefined;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: {},
      setSession: (s) =>
        set((state) => ({ sessions: { ...state.sessions, [s.roomId]: s } })),
      clearSession: (roomId) =>
        set((state) => {
          const next = { ...state.sessions };
          delete next[roomId];
          return { sessions: next };
        }),
      getSession: (roomId) => get().sessions[roomId],
    }),
    { name: 'picktime-sessions' },
  ),
);

/** Hook: the current session for a room (or undefined if viewer-only). */
export function useSession(roomId: string | undefined) {
  return useSessionStore((s) => (roomId ? s.sessions[roomId] : undefined));
}
