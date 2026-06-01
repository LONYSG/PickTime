import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import { cn, sortSupporters } from '@/lib/utils';
import type { DateHeat } from '@/lib/aggregate';
import type { Participant } from '@/lib/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface CalendarProps {
  rangeStart: string;
  rangeEnd: string;
  heat: Map<string, DateHeat>;
  participantCount: number;
  participantsById: Map<string, Participant>;
  finalizedDate: string | null;
  onPick: (date: string) => void;
}

/** Heat bucket → background tint. More distinct supporters = warmer. */
function heatClass(ratio: number): string {
  if (ratio <= 0) return 'bg-card';
  if (ratio < 0.25) return 'bg-indigo-50';
  if (ratio < 0.5) return 'bg-indigo-100';
  if (ratio < 0.75) return 'bg-indigo-200';
  return 'bg-indigo-300';
}

export function Calendar({
  rangeStart,
  rangeEnd,
  heat,
  participantCount,
  participantsById,
  finalizedDate,
  onPick,
}: CalendarProps) {
  const start = dayjs(rangeStart);
  const end = dayjs(rangeEnd);
  const [month, setMonth] = useState(() => start.startOf('month'));

  const canPrev = month.isAfter(start.startOf('month'));
  const canNext = month.isBefore(end.startOf('month'));

  const cells = useMemo(() => {
    const firstOfMonth = month.startOf('month');
    const gridStart = firstOfMonth.subtract(firstOfMonth.day(), 'day');
    return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  }, [month]);

  return (
    <div className="rounded-3xl bg-card p-3 shadow-soft">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={() => canPrev && setMonth(month.subtract(1, 'month'))}
          disabled={!canPrev}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted disabled:opacity-30"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-bold">{month.format('YYYY년 M월')}</span>
        <button
          onClick={() => canNext && setMonth(month.add(1, 'month'))}
          disabled={!canNext}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted disabled:opacity-30"
          aria-label="다음 달"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn(i === 0 && 'text-rose-400', i === 6 && 'text-sky-400')}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const ds = d.format('YYYY-MM-DD');
          const inMonth = d.month() === month.month();
          const inRange = !d.isBefore(start, 'day') && !d.isAfter(end, 'day');
          const info = heat.get(ds);
          const ratio = info && participantCount ? info.supporterIds.length / participantCount : 0;
          const hasCandidates = (info?.candidateCount ?? 0) > 0;
          const isFinal = finalizedDate === ds;
          const dots = sortSupporters(
            (info?.supporterIds ?? [])
              .map((id) => participantsById.get(id))
              .filter(Boolean) as Participant[],
          )
            .slice(0, 4)
            .map((p) => p.color_hex);

          return (
            <button
              key={ds}
              disabled={!inRange}
              onClick={() => inRange && onPick(ds)}
              className={cn(
                'relative flex aspect-square flex-col items-center rounded-xl p-1 text-sm transition',
                inRange
                  ? ratio > 0
                    ? heatClass(ratio)
                    : hasCandidates
                      ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-100'
                      : 'bg-card'
                  : 'bg-transparent',
                inRange ? 'active:scale-95' : 'cursor-default',
                !inMonth && 'opacity-40',
                isFinal && 'ring-2 ring-amber-400',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  inRange ? 'text-foreground' : 'text-muted-foreground/40',
                  d.day() === 0 && inRange && 'text-rose-500',
                  d.day() === 6 && inRange && 'text-sky-500',
                )}
              >
                {isFinal ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : d.date()}
              </span>
              {dots.length > 0 ? (
                <span className="mt-auto flex flex-wrap items-center justify-center gap-0.5">
                  {dots.map((c, i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  {info && info.supporterIds.length > 4 && (
                    <span className="text-[8px] leading-none text-muted-foreground">
                      +{info.supporterIds.length - 4}
                    </span>
                  )}
                </span>
              ) : (
                inRange &&
                hasCandidates && (
                  // Candidates exist but nobody has voted yet — still flag the day.
                  <span className="mt-auto h-1.5 w-1.5 rounded-full border border-indigo-300" />
                )
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
