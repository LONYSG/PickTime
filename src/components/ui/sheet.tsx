import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Optional sticky footer (e.g. action bar). */
  footer?: ReactNode;
}

const CLOSE_THRESHOLD = 90; // px dragged down before release dismisses
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * Mobile-native bottom sheet. Slides up on open, slides down on close (backdrop
 * tap, close button, Escape) and can be flicked down to dismiss. Stays mounted
 * through the exit transition so the close animation always plays.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef(0);

  // Mount, then animate in on the next frame; animate out when open flips false.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const transform = dragging
    ? `translateY(${dragY}px)`
    : visible
      ? 'translateY(0)'
      : 'translateY(100%)';
  const dragProgress = Math.min(dragY / 320, 1);
  const backdropOpacity = visible ? 1 - dragProgress * 0.9 : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        style={{ opacity: backdropOpacity, transition: dragging ? 'none' : 'opacity 0.3s ease-out' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl bg-background shadow-sheet"
        style={{ transform, transition: dragging ? 'none' : `transform 0.3s ${EASE}` }}
        onTransitionEnd={() => {
          if (!visible && !dragging) {
            setMounted(false);
            setDragY(0);
          }
        }}
      >
        {/* Grab handle — drag only here so header buttons stay tappable. */}
        <div
          className="shrink-0 cursor-grab touch-none px-5 pb-1 pt-3"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            startYRef.current = e.clientY;
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            setDragY(Math.max(0, e.clientY - startYRef.current));
          }}
          onPointerUp={() => {
            setDragging(false);
            if (dragY > CLOSE_THRESHOLD) {
              setVisible(false);
              onClose();
            } else {
              setDragY(0);
            }
          }}
        >
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
