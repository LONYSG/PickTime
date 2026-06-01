import type { ReactNode } from 'react';

/**
 * Centers a mobile-width column on any screen so the app feels like a native
 * mobile app even on desktop. The colored field behind the column gives the
 * "phone on a desk" feel without heavy chrome.
 */
export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full w-full bg-gradient-to-b from-indigo-50 via-muted to-muted">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-soft sm:my-0 sm:min-h-screen">
        {children}
      </div>
    </div>
  );
}
