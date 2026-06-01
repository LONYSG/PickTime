import { Check } from 'lucide-react';
import { readableTextOn } from '@/lib/colors';
import { cn } from '@/lib/utils';

/** Pick one of the algorithm-suggested colors. Choice is permanent after join. */
export function ColorPicker({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string | null;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {colors.map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              'grid h-12 w-12 place-items-center rounded-2xl transition-transform active:scale-95',
              active ? 'ring-2 ring-offset-2 ring-foreground' : 'ring-1 ring-black/5',
            )}
            style={{ backgroundColor: c }}
            aria-label={`색상 ${c}`}
          >
            {active && <Check className="h-5 w-5" style={{ color: readableTextOn(c) }} />}
          </button>
        );
      })}
    </div>
  );
}
