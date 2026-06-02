import { cn } from '@/lib/utils';

/**
 * Consistent right-hand meta column for every voting row: 확정 chip, the vote
 * count pill, and the 불참 count — always stacked top-to-bottom, right-aligned,
 * and fixed-width so the time text on the left never collides with it.
 */
export function VoteMeta({
  total,
  unavailable = 0,
  isFinal = false,
  tone = 'primary',
}: {
  total: number;
  unavailable?: number;
  isFinal?: boolean;
  tone?: 'primary' | 'amber';
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      {isFinal && (
        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
          확정
        </span>
      )}
      <span
        className={cn(
          'inline-flex items-baseline gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-sm font-bold',
          tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary',
        )}
      >
        {total}
        <span className="text-[10px] font-semibold opacity-80">표</span>
      </span>
      {unavailable > 0 && (
        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
          불참 {unavailable}
        </span>
      )}
    </div>
  );
}
