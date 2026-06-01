import { useEffect } from 'react';
import { create } from 'zustand';
import { CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  remove: (id: number) => void;
}

let counter = 0;
const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) =>
    set((s) => ({ toasts: [...s.toasts, { id: ++counter, kind, message }] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative API usable outside React components. */
export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
};

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const tones = {
  success: 'text-emerald-600',
  error: 'text-destructive',
  info: 'text-primary',
};

function ToastItem({ t }: { t: Toast }) {
  const remove = useToastStore((s) => s.remove);
  useEffect(() => {
    const id = setTimeout(() => remove(t.id), 2800);
    return () => clearTimeout(id);
  }, [t.id, remove]);
  const Icon = icons[t.kind];
  return (
    <div className="pointer-events-auto flex animate-pop-in items-center gap-2.5 rounded-2xl bg-foreground/95 px-4 py-3 text-sm font-medium text-background shadow-soft">
      <Icon className={cn('h-5 w-5 shrink-0', tones[t.kind])} />
      <span>{t.message}</span>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-md flex-col items-center gap-2 px-4 pt-safe">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
