import { useMemo } from 'react';
import { Check, CalendarX2, Sun } from 'lucide-react';
import { VoterAvatars } from './VoterAvatars';
import { VoteMeta } from './VoteMeta';
import { dayjs } from '@/lib/dayjs';
import { fmtRange, cn } from '@/lib/utils';
import { tallyForDate, type CandidateTally } from '@/lib/aggregate';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useAuth } from '@/components/auth/AuthProvider';
import type {
  CandidateVote,
  DateAvailability,
  Participant,
  Room,
  TimeCandidate,
} from '@/lib/types';

type Row =
  | { kind: 'candidate'; total: number; unavailable: number; date: string; sortTime: string; tally: CandidateTally }
  | { kind: 'allday'; total: number; unavailable: number; date: string; sortTime: string; parts: Participant[] };

/**
 * Flat overview of every voting option in the room, sorted by votes (desc) then
 * fewest 불참, then earliest date/time. Browse and vote without proposing
 * anything new. Dates with only "available all day" marks appear as all-day rows.
 */
export function CandidateListView({
  room,
  candidates,
  votes,
  availability,
  participantsById,
  onOpenDate,
}: {
  room: Room;
  candidates: TimeCandidate[];
  votes: CandidateVote[];
  availability: DateAvailability[];
  participantsById: Map<string, Participant>;
  onOpenDate: (date: string) => void;
}) {
  const { session } = useAuth();
  const actions = useRoomActions(room.id);
  const readOnly = room.is_finalized;

  const rows = useMemo(() => {
    const dates = Array.from(
      new Set([
        ...candidates.map((c) => c.date),
        ...availability.filter((a) => a.is_all_day).map((a) => a.date),
      ]),
    );
    const out: Row[] = [];
    for (const date of dates) {
      const tallies = tallyForDate(candidates, votes, availability, date);
      const unavailable = availability.filter(
        (a) => a.date === date && a.status === 'unavailable',
      ).length;
      if (tallies.length > 0) {
        for (const t of tallies) {
          out.push({ kind: 'candidate', total: t.total, unavailable, date, sortTime: t.candidate.start_time, tally: t });
        }
      } else {
        const parts = availability
          .filter((a) => a.date === date && a.status === 'all_day')
          .map((a) => participantsById.get(a.participant_id))
          .filter(Boolean) as Participant[];
        if (parts.length > 0) {
          out.push({ kind: 'allday', total: parts.length, unavailable, date, sortTime: '', parts });
        }
      }
    }
    return out.sort(
      (a, b) =>
        b.total - a.total ||
        a.unavailable - b.unavailable ||
        a.date.localeCompare(b.date) ||
        a.sortTime.localeCompare(b.sortTime),
    );
  }, [candidates, votes, availability, participantsById]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-card py-14 text-muted-foreground shadow-soft">
        <CalendarX2 className="h-8 w-8" />
        <p className="text-sm">아직 시간 후보가 없어요.</p>
        <p className="text-xs">캘린더에서 날짜를 눌러 첫 후보를 추가해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const d = dayjs(row.date);
        const dateCol = (
          <button
            onClick={() => onOpenDate(row.date)}
            className="w-11 shrink-0 text-center active:opacity-70"
            aria-label={`${d.format('M월 D일')} 자세히`}
          >
            <span className="block text-sm font-bold leading-tight">{d.format('M/D')}</span>
            <span
              className={cn(
                'block text-[11px] leading-tight',
                d.day() === 0 && 'text-rose-500',
                d.day() === 6 && 'text-sky-500',
                d.day() !== 0 && d.day() !== 6 && 'text-muted-foreground',
              )}
            >
              {d.format('ddd')}
            </span>
          </button>
        );

        if (row.kind === 'allday') {
          const iAmAllDay = !!(session && row.parts.some((p) => p.id === session.participantId));
          return (
            <div
              key={`allday-${row.date}`}
              className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50"
            >
              <div className="flex items-center gap-2 p-2.5">
                {dateCol}
                <button
                  disabled={readOnly}
                  onClick={() => actions.setMyDateStatus(row.date, iAmAllDay ? 'none' : 'all_day')}
                  className={cn('flex flex-1 items-center gap-2 text-left transition', !readOnly && 'active:scale-[0.99]')}
                >
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2',
                      iAmAllDay ? 'border-amber-400 bg-amber-400 text-white' : 'border-amber-300 bg-card text-amber-500',
                    )}
                  >
                    <Sun className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 break-keep text-sm font-semibold leading-snug">
                    하루종일 가능
                  </span>
                  <VoteMeta total={row.total} unavailable={row.unavailable} tone="amber" />
                </button>
              </div>
              <VoterAvatars
                full
                className="border-t border-amber-200/70 bg-amber-50/60 px-3 py-2.5"
                supporters={row.parts}
                explicitIds={[]}
                title={`${d.format('M/D')} 하루종일 가능 · ${row.total}명`}
              />
            </div>
          );
        }

        const t = row.tally;
        const voted = !!(session && t.explicitVoterIds.includes(session.participantId));
        const isFinal = room.finalized_options?.length
          ? room.finalized_options.some((o) => o.candidate_id === t.candidate.id)
          : room.finalized_candidate_id === t.candidate.id;
        const supporters = t.supporterIds
          .map((id) => participantsById.get(id))
          .filter(Boolean) as Participant[];

        return (
          <div
            key={t.candidate.id}
            className={cn(
              'overflow-hidden rounded-2xl border',
              isFinal ? 'border-amber-300 bg-amber-50' : 'border-border bg-card',
            )}
          >
            <div className="flex items-center gap-2 p-2.5">
              {dateCol}
              <button
                disabled={readOnly}
                onClick={() => actions.toggleVote(t.candidate.id, voted)}
                className={cn('flex flex-1 items-center gap-2 text-left transition', !readOnly && 'active:scale-[0.99]')}
              >
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2',
                    voted ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  <Check className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 break-keep text-sm font-bold leading-snug">
                  {fmtRange(t.candidate.start_time, t.candidate.end_time)}
                </span>
                <VoteMeta total={t.total} unavailable={row.unavailable} isFinal={isFinal} />
              </button>
            </div>
            {supporters.length > 0 && (
              <VoterAvatars
                full
                className="border-t border-border/60 bg-muted/30 px-3 py-2.5"
                supporters={supporters}
                explicitIds={t.explicitVoterIds}
                title={`${d.format('M/D')} ${fmtRange(t.candidate.start_time, t.candidate.end_time)} · ${t.total}명`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

