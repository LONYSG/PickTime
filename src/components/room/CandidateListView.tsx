import { useMemo } from 'react';
import { Check, ChevronRight, CalendarX2, Sun } from 'lucide-react';
import { VoterAvatars } from './VoterAvatars';
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

// One row in the flat list: a real time candidate, or an "all-day only" date.
type Row =
  | {
      kind: 'candidate';
      total: number;
      unavailable: number;
      date: string;
      sortTime: string;
      tally: CandidateTally;
    }
  | {
      kind: 'allday';
      total: number;
      unavailable: number;
      date: string;
      sortTime: string;
      parts: Participant[];
    };

/**
 * Flat overview of every voting option in the room, sorted by votes (desc) then
 * earliest date/time. This is the "see everything" view — browse and vote on
 * existing options without proposing anything new. Dates that only have
 * "available all day" marks appear as their own all-day row.
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
          out.push({
            kind: 'candidate',
            total: t.total,
            unavailable: t.unavailableCount,
            date,
            sortTime: t.candidate.start_time,
            tally: t,
          });
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
        const dateLabel = (
          <button
            onClick={() => onOpenDate(row.date)}
            className="flex items-center gap-1 text-left active:opacity-70"
          >
            <span className="text-sm font-bold">{d.format('M/D')}</span>
            <span
              className={cn(
                'text-xs',
                d.day() === 0 && 'text-rose-500',
                d.day() === 6 && 'text-sky-500',
                d.day() !== 0 && d.day() !== 6 && 'text-muted-foreground',
              )}
            >
              {d.format('ddd')}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        );

        if (row.kind === 'allday') {
          const iAmAllDay = !!(
            session && row.parts.some((p) => p.id === session.participantId)
          );
          return (
            <div
              key={`allday-${row.date}`}
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-2.5"
            >
              <button
                disabled={readOnly}
                onClick={() => actions.setMyDateStatus(row.date, iAmAllDay ? 'none' : 'all_day')}
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 transition active:scale-95',
                  iAmAllDay
                    ? 'border-amber-400 bg-amber-400 text-white'
                    : 'border-amber-300 bg-card text-amber-500',
                  readOnly && 'opacity-60',
                )}
                aria-label="하루종일 가능 표시"
              >
                <Sun className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {dateLabel}
                  <span className="font-bold">하루종일 가능</span>
                  {row.unavailable > 0 && <UnavailBadge n={row.unavailable} />}
                </div>
                <div className="mt-1">
                  <VoterAvatars
                    supporters={row.parts}
                    explicitIds={[]}
                    title={`${d.format('M/D')} 하루종일 가능 · ${row.total}명`}
                  />
                </div>
              </div>
              <Count total={row.total} tone="amber" />
            </div>
          );
        }

        const t = row.tally;
        const voted = !!(session && t.explicitVoterIds.includes(session.participantId));
        const isFinal = room.finalized_candidate_id === t.candidate.id;
        const supporters = t.supporterIds
          .map((id) => participantsById.get(id))
          .filter(Boolean) as Participant[];

        return (
          <div
            key={t.candidate.id}
            className={cn(
              'flex items-center gap-3 rounded-2xl border p-2.5',
              isFinal ? 'border-amber-300 bg-amber-50' : 'border-border bg-card',
            )}
          >
            <button
              disabled={readOnly}
              onClick={() => actions.toggleVote(t.candidate.id, voted)}
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 transition active:scale-95',
                voted
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground',
                readOnly && 'opacity-60',
              )}
              aria-label="투표"
            >
              <Check className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {dateLabel}
                <span className="font-bold">
                  {fmtRange(t.candidate.start_time, t.candidate.end_time)}
                </span>
                {isFinal && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">
                    확정
                  </span>
                )}
                {row.unavailable > 0 && <UnavailBadge n={row.unavailable} />}
              </div>
              <div className="mt-1">
                <VoterAvatars
                  supporters={supporters}
                  explicitIds={t.explicitVoterIds}
                  title={`${d.format('M/D')} ${fmtRange(t.candidate.start_time, t.candidate.end_time)} · ${t.total}명`}
                />
              </div>
            </div>

            <Count total={t.total} />
          </div>
        );
      })}
    </div>
  );
}

function UnavailBadge({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
      불참 {n}
    </span>
  );
}

function Count({ total, tone = 'primary' }: { total: number; tone?: 'primary' | 'amber' }) {
  return (
    <div className="flex flex-col items-center pl-1">
      <span
        className={cn(
          'text-lg font-extrabold leading-none',
          tone === 'amber' ? 'text-amber-600' : 'text-primary',
        )}
      >
        {total}
      </span>
      <span className="text-[10px] text-muted-foreground">표</span>
    </div>
  );
}
