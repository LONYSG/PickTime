import { useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

/** 4-digit numeric PIN entry with auto-advance. */
export function PinInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(4, ' ').slice(0, 4).split('');

  const setDigit = (i: number, d: string) => {
    const next = value.split('');
    next[i] = d;
    onChange(next.join('').replace(/\s/g, '').slice(0, 4));
  };

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, '').slice(-1);
    if (!d) return;
    setDigit(i, d);
    if (i < 3) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[i].trim()) {
        setDigit(i, '');
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        setDigit(i - 1, '');
      }
    }
  };

  return (
    <div className="flex justify-center gap-3">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus && i === 0}
          maxLength={1}
          value={digits[i].trim()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          className={cn(
            'h-16 w-14 rounded-2xl border-2 border-input bg-card text-center text-2xl font-bold',
            'focus-visible:border-primary focus-visible:outline-none',
          )}
        />
      ))}
    </div>
  );
}
