import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * Shared top nav bar so every screen lines up identically: same padding,
 * safe-area inset, and back-button metrics.
 */
export function PageHeader({
  onBack,
  title,
  right,
}: {
  onBack?: () => void;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/90 px-3 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur">
      {onBack && (
        <button
          onClick={onBack}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"
          aria-label="뒤로"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <div className="min-w-0 flex-1">{title}</div>
      {right}
    </header>
  );
}
