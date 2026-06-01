import { useState } from 'react';
import { Trophy, ChevronDown, Sun } from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import { fmtRange, cn, sortSupporters } from '@/lib/utils';
import type { PromisingOption } from '@/lib/aggregate';
import type { Participant } from '@/lib/types';

/**
 * Shows the current leader(s): every option tied at the highest vote count,
 * earliest date/time first, capped at 3 with a 더보기 expander. No rank numbers
 * — ties are genuinely equal. The full ranked list lives in the 시간 후보 목록.
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
  const [expanded, setExpanded] = useState(false);
  const max = options.length ? options[0].total : 0; // options come sorted desc
  if (max <= 0) return null;

  const leadersAll = options
    .filter((o) => o.total === max)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''),
    );
  const leaders = expanded ? leadersAll : leadersAll.slice(0, 3);

  return (
    <section className="rounded-3xl bg-gradient-to-br from-primary to-indigo-500 p-4 text-primary-foreground shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5" />
        <h2 className="font-bold">가장 유력한 시간</h2>
        {leadersAll.length > 1 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
            공동 {leadersAll.length}개
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
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  {o.kind === 'allday' ? (
                    <span className="inline-flex items-center gap-1">
                      {d.format('M/D (ddd)')} · <Sun className="h-3.5 w-3.5" /> 하루종일
                    </span>
                  ) : (
                    `${d.format('M/D (ddd)')} · ${fmtRange(o.start_time!, o.end_time!)}`
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
              <span className="flex shrink-0 items-baseline gap-1 rounded-2xl bg-white/20 px-3 py-1.5">
                <span className="text-xl font-extrabold leading-none">{o.total}</span>
                <span className="text-[11px] opacity-80">표</span>
              </span>
            </button>
          );
        })}
      </div>

      {leadersAll.length > 3 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-2xl bg-white/15 py-2 text-sm font-semibold backdrop-blur-sm active:scale-[0.99]"
        >
          {expanded ? '접기' : `더보기 (+${leadersAll.length - 3})`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </section>
  );
}
