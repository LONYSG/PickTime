import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Star, CalendarPlus, Check } from 'lucide-react';
import { dayjs, todayStr } from '@/lib/dayjs';
import { cn, sortSupporters } from '@/lib/utils';
import { useHolidays } from '@/hooks/useHolidays';
import { Button } from '@/components/ui/button';
import { useRoomActions } from '@/hooks/useRoomActions';
import type { DateHeat } from '@/lib/aggregate';
import type { Participant } from '@/lib/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface CalendarProps {
  roomId: string;
  rangeStart: string;
  rangeEnd: string;
  heat: Map<string, DateHeat>;
  participantCount: number;
  participantsById: Map<string, Participant>;
  finalizedDate: string | null;
  readOnly: boolean;
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
  roomId,
  rangeStart,
  rangeEnd,
  heat,
  participantCount,
  participantsById,
  finalizedDate,
  readOnly,
  onPick,
}: CalendarProps) {
  const start = dayjs(rangeStart);
  const end = dayjs(rangeEnd);
  const [month, setMonth] = useState(() => start.startOf('month'));
  const actions = useRoomActions(roomId);

  // Bulk "available all day" selection mode.
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [applying, setApplying] = useState(false);

  const today = todayStr();
  const isHoliday = useHolidays(month.year());
  const canPrev = month.isAfter(start.startOf('month'));
  const canNext = month.isBefore(end.startOf('month'));

  const cells = useMemo(() => {
    const firstOfMonth = month.startOf('month');
    const gridStart = firstOfMonth.subtract(firstOfMonth.day(), 'day');
    return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  }, [month]);

  const cancel = () => {
    setMulti(false);
    setSelected(new Set());
  };

  async function apply() {
    setApplying(true);
    await actions.setMyDatesAllDay(Array.from(selected));
    setApplying(false);
    cancel();
  }

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

      {/* Bulk all-day toolbar */}
      {!readOnly &&
        (multi ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-1.5">
            <span className="text-xs font-semibold text-primary">
              {selected.size}일 선택 · 날짜를 탭하세요
            </span>
            <div className="flex items-center gap-2">
              <button onClick={cancel} className="text-xs font-medium text-muted-foreground">
                취소
              </button>
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={selected.size === 0 || applying}
                onClick={apply}
              >
                하루종일 표시
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setMulti(true)}
            className="mb-2 flex w-full items-center justify-center gap-1 rounded-xl bg-muted/60 py-1.5 text-xs font-semibold text-primary active:scale-[0.99]"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> 여러 날 한번에 하루종일 가능
          </button>
        ))}

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
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
          const isToday = ds === today;
          const isHol = isHoliday(ds);
          const isSelected = multi && selected.has(ds);
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
              onClick={() => {
                if (!inRange) return;
                if (multi) {
                  setSelected((prev) => {
                    const n = new Set(prev);
                    n.has(ds) ? n.delete(ds) : n.add(ds);
                    return n;
                  });
                } else {
                  onPick(ds);
                }
              }}
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
                isSelected && 'bg-primary/15 ring-2 ring-primary',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  isToday && inRange
                    ? 'bg-primary text-primary-foreground'
                    : inRange
                      ? 'text-foreground'
                      : 'text-muted-foreground/40',
                  !isToday && inRange && (d.day() === 0 || isHol) && 'text-rose-500',
                  !isToday && inRange && d.day() === 6 && !isHol && 'text-sky-500',
                )}
              >
                {isFinal ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : d.date()}
              </span>

              {isSelected && (
                <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}

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
