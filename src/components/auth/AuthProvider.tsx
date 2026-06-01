import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Participant, Session } from '@/lib/types';
import { useSession, useSessionStore } from '@/store/session';
import { LoginSheet } from './LoginSheet';

interface AuthContextValue {
  session: Session | undefined;
  /** Resolve to a session, opening the login flow if the user is a viewer. */
  ensureAuth: () => Promise<Session>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  roomId,
  roomTitle,
  participants,
  children,
}: {
  roomId: string;
  roomTitle?: string;
  participants: Participant[];
  children: ReactNode;
}) {
  const session = useSession(roomId);
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((s: Session) => void) | null>(null);

  const ensureAuth = useCallback(() => {
    const current = useSessionStore.getState().getSession(roomId);
    if (current) return Promise.resolve(current);
    setOpen(true);
    return new Promise<Session>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [roomId]);

  const handleAuthed = (s: Session) => {
    setOpen(false);
    resolverRef.current?.(s);
    resolverRef.current = null;
  };

  const handleClose = () => {
    setOpen(false);
    resolverRef.current = null; // user cancelled — pending action is dropped
  };

  return (
    <AuthContext.Provider value={{ session, ensureAuth }}>
      {children}
      <LoginSheet
        open={open}
        roomId={roomId}
        roomTitle={roomTitle}
        participants={participants}
        onClose={handleClose}
        onAuthed={handleAuthed}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
