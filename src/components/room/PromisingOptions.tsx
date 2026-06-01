import { Trophy, Sun } from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import { fmtRange, cn, sortSupporters } from '@/lib/utils';
import type { PromisingOption } from '@/lib/aggregate';
import type { Participant } from '@/lib/types';

/**
 * Shows ONLY the current leader(s): every option tied at the highest vote
 * count, earliest date/time first. No rank numbers — ties are genuinely equal.
 * The full ranked list lives in the "시간 후보 목록" view.
 */
export function PromisingOptions({
  options,
  participantsById,
  finalizedId,
  onPick,
}: {
  options: PromisingOption[];
  participantsById: Map<string, Participant>;
  finalizedId: string | null;
  onPick: (date: string) => void;
}) {
  const max = options.length ? options[0].total : 0; // options come sorted desc
  if (max <= 0) return null;

  const leaders = options
    .filter((o) => o.total === max)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''),
    );

  return (
    <section className="rounded-3xl bg-gradient-to-br from-primary to-indigo-500 p-4 text-primary-foreground shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5" />
        <h2 className="font-bold">가장 유력한 시간</h2>
        {leaders.length > 1 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
            공동 {leaders.length}개
          </span>
        )}
      </div>
      <div className="space-y-2">
        {leaders.map((o) => {
          const d = dayjs(o.date);
          const dots = sortSupporters(
            o.supporterIds.map((id) => participantsById.get(id)).filter(Boolean) as Participant[],
          )
            .slice(0, 6)
            .map((p) => p.color_hex);
          return (
            <button
              key={o.id}
              onClick={() => onPick(o.date)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl bg-white/15 p-3 text-left backdrop-blur-sm active:scale-[0.99]',
                o.id === finalizedId && 'ring-2 ring-amber-300',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {d.format('M/D (ddd)')} ·{' '}
                  {o.kind === 'allday' ? (
                    <span className="inline-flex items-center gap-1">
                      <Sun className="h-3.5 w-3.5" /> 하루종일 가능
                    </span>
                  ) : (
                    fmtRange(o.start_time!, o.end_time!)
                  )}
                  {o.unavailableCount > 0 && (
                    <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">
                      불참 {o.unavailableCount}
                    </span>
                  )}
                </span>
                <span className="mt-1 flex items-center gap-1">
                  {dots.map((c, j) => (
                    <span
                      key={j}
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
              </span>
              <span className="flex flex-col items-center">
                <span className="text-xl font-extrabold leading-none">{o.total}</span>
                <span className="text-[10px] opacity-80">표</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
