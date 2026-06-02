import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@/lib/types';

/**
 * Rooms the user has visited, kept independently of login sessions so a room
 * still shows up under "최근 약속" after logging out (or when only ever viewed).
 */
export interface RecentRoom {
  roomId: string;
  title?: string;
  nickname?: string;
  color?: string;
  role?: Role;
  visitedAt: string;
}

interface RecentState {
  recents: Record<string, RecentRoom>;
  touchRecent: (r: RecentRoom) => void;
  removeRecent: (roomId: string) => void;
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      recents: {},
      touchRecent: (r) =>
        set((state) => ({
          recents: { ...state.recents, [r.roomId]: { ...state.recents[r.roomId], ...r } },
        })),
      removeRecent: (roomId) =>
        set((state) => {
          const next = { ...state.recents };
          delete next[roomId];
          return { recents: next };
        }),
    }),
    { name: 'picktime-recents' },
  ),
);
