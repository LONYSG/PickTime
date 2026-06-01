import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Query key factory — keeps cache keys consistent across the app.
export const qk = {
  room: (id: string) => ['room', id] as const,
  participants: (id: string) => ['participants', id] as const,
  candidates: (id: string) => ['candidates', id] as const,
  votes: (id: string) => ['votes', id] as const,
  availability: (id: string) => ['availability', id] as const,
  comments: (id: string) => ['comments', id] as const,
  notifications: (pid: string) => ['notifications', pid] as const,
};
