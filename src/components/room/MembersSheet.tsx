import { useMemo, useState } from 'react';
import {
  Crown,
  ShieldCheck,
  ChevronDown,
  Sun,
  CalendarOff,
  Check,
  Ban,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Avatar } from '@/components/ui/avatar';
import { dayjs } from '@/lib/dayjs';
import { fmtRange, cn } from '@/lib/utils';
import type {
  CandidateVote,
  DateAvailability,
  Participant,
  TimeCandidate,
} from '@/lib/types';

/**
 * "참여 현황" — visible to everyone. Shows every member with whether they've
 * voted, and expands to reveal exactly which times they picked, their all-day
 * dates, and the dates they marked 불참.
 */
export function MembersSheet({
  open,
  onClose,
  participants,
  candidates,
  votes,
  availability,
  onOpenDate,
}: {
  open: boolean;
  onClose: () => void;
  participants: Participant[];
  candidates: TimeCandidate[];
  votes: CandidateVote[];
  availability: DateAvailability[];
  onOpenDate: (date: string) => void;
}) {
  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates],
  );

  const hasParticipated = (m: Participant) =>
    m.status !== 'unavailable' &&
    (votes.some((v) => v.participant_id === m.id) ||
      availability.some((a) => a.participant_id === m.id && a.status === 'all_day'));

  // Voted group on top (latest vote first); then the rest (latest to join first).
  const members = useMemo(() => {
    const lastActivity = (m: Participant) => {
      const ts = [
        ...votes.filter((v) => v.participant_id === m.id).map((v) => v.created_at),
        ...availability
          .filter((a) => a.participant_id === m.id && a.status === 'all_day')
          .map((a) => a.created_at),
      ].sort();
      return ts.at(-1) ?? '';
    };
    return participants
      .filter((p) => p.status !== 'left')
      .sort((a, b) => {
        const pa = hasParticipated(a);
        const pb = hasParticipated(b);
        if (pa !== pb) return pa ? -1 : 1;
        if (pa) return lastActivity(b).localeCompare(lastActivity(a));
        return b.created_at.localeCompare(a.created_at);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, votes, availability]);

  const participatedCount = members.filter(hasParticipated).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-baseline gap-2">
          참여 현황
          <span className="text-sm font-normal text-muted-foreground">
            투표 {participatedCount}/{members.length}
          </span>
        </span>
      }
    >
      <div className="space-y-2 pb-4">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            m={m}
            candidateById={candidateById}
            votes={votes.filter((v) => v.participant_id === m.id)}
            availability={availability.filter((a) => a.participant_id === m.id)}
            onOpenDate={(date) => {
              onClose();
              onOpenDate(date);
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

function MemberRow({
  m,
  candidateById,
  votes,
  availability,
  onOpenDate,
}: {
  m: Participant;
  candidateById: Map<string, TimeCandidate>;
  votes: CandidateVote[];
  availability: DateAvailability[];
  onOpenDate: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const votedCandidates = votes
    .map((v) => candidateById.get(v.candidate_id))
    .filter(Boolean) as TimeCandidate[];
  votedCandidates.sort(
    (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time),
  );
  const allDayDates = availability
    .filter((a) => a.status === 'all_day')
    .map((a) => a.date)
    .sort();
  const unavailableDates = availability
    .filter((a) => a.status === 'unavailable')
    .map((a) => a.date)
    .sort();

  const participated = m.status !== 'unavailable' && (votedCandidates.length > 0 || allDayDates.length > 0);
  const hasDetail = votedCandidates.length > 0 || allDayDates.length > 0 || unavailableDates.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <Avatar nickname={m.nickname} color={m.color_hex} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{m.nickname}</span>
            {m.role === 'host' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            {m.role === 'admin' && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          </div>
        </div>

        {m.status === 'unavailable' ? (
          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-600">
            <Ban className="h-3.5 w-3.5" /> 전체 불참
          </span>
        ) : participated ? (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            <Check className="h-3.5 w-3.5" /> 투표함
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            미투표
          </span>
        )}

        {hasDetail && (
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {open && hasDetail && (
        <div className="animate-expand-in space-y-3 border-t border-border bg-muted/40 px-3 py-3 text-sm">
          {votedCandidates.length > 0 && (
            <Detail icon={<Check className="h-4 w-4 text-primary" />} label="투표한 시간 (눌러서 이동)">
              {votedCandidates.map((c) => (
                <Chip key={c.id} onClick={() => onOpenDate(c.date)}>
                  {dayjs(c.date).format('M/D')} {fmtRange(c.start_time, c.end_time)}
                </Chip>
              ))}
            </Detail>
          )}
          {allDayDates.length > 0 && (
            <Detail icon={<Sun className="h-4 w-4 text-amber-500" />} label="하루종일 가능">
              {allDayDates.map((d) => (
                <Chip key={d} onClick={() => onOpenDate(d)}>
                  {dayjs(d).format('M/D (ddd)')}
                </Chip>
              ))}
            </Detail>
          )}
          {unavailableDates.length > 0 && (
            <Detail icon={<CalendarOff className="h-4 w-4 text-rose-500" />} label="불참">
              {unavailableDates.map((d) => (
                <Chip key={d} tone="rose" onClick={() => onOpenDate(d)}>
                  {dayjs(d).format('M/D (ddd)')}
                </Chip>
              ))}
            </Detail>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon} {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  children,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  tone?: 'rose';
  onClick?: () => void;
}) {
  const cls = cn(
    'break-keep rounded-lg px-2 py-1 text-xs font-medium',
    tone === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-card text-foreground',
    onClick && 'active:scale-95',
  );
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}
