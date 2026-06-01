import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Optional sticky footer (e.g. action bar). */
  footer?: ReactNode;
}

/**
 * Mobile-native bottom sheet. Slides up from the bottom, backdrop tap or the
 * close button dismisses. Content scrolls; header/footer stay put. Constrained
 * to the centered mobile column on desktop.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fade-in bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl bg-background shadow-sheet animate-sheet-up',
        )}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden />
        </div>
        {title && (
          <div className="flex shrink-0 items-center justify-between px-5 pb-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-border bg-background px-5 pb-safe pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
