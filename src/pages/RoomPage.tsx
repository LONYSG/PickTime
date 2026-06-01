import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, MoreHorizontal, Lock, Sparkles, CheckCircle2, Users } from 'lucide-react';
import { VoterAvatars } from '@/components/room/VoterAvatars';
import { useRoomData } from '@/hooks/useRoomData';
import { useNotifications } from '@/hooks/useNotifications';
import { useSession } from '@/store/session';
import { heatByDate, rankCandidates, rankPromising } from '@/lib/aggregate';
import { dayjs } from '@/lib/dayjs';
import { fmtRange, cn } from '@/lib/utils';
import { FullSpinner } from '@/components/ui/spinner';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Calendar } from '@/components/room/Calendar';
import { CandidateListView } from '@/components/room/CandidateListView';
import { PromisingOptions } from '@/components/room/PromisingOptions';
import { DateSheet } from '@/components/room/DateSheet';
import { NotificationCenter } from '@/components/room/NotificationCenter';
import { MembersSheet } from '@/components/room/MembersSheet';
import { RoomMenu } from '@/components/room/RoomMenu';
import { PasswordGate } from '@/components/room/PasswordGate';
import NotFoundPage from './NotFoundPage';
import type { Participant } from '@/lib/types';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const nav = useNavigate();
  const data = useRoomData(roomId);
  const session = useSession(roomId);

  const [pwOk, setPwOk] = useState(() => !!sessionStorage.getItem(`pt-pw-${roomId}`));
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const { notifications, unread } = useNotifications(session?.participantId);

  const participantsById = useMemo(
    () => new Map<string, Participant>(data.participants.map((p) => [p.id, p])),
    [data.participants],
  );
  const heat = useMemo(
    () => heatByDate(data.candidates, data.votes, data.availability),
    [data.candidates, data.votes, data.availability],
  );
  const ranked = useMemo(
    () => rankCandidates(data.candidates, data.votes, data.availability),
    [data.candidates, data.votes, data.availability],
  );
  const promising = useMemo(
    () => rankPromising(data.candidates, data.votes, data.availability),
    [data.candidates, data.votes, data.availability],
  );

  if (data.isLoading) return <FullSpinner label="방을 불러오는 중…" />;
  if (data.error || !data.room) return <NotFoundPage />;
  const room = data.room;
  const activeParticipants = data.participants.filter((p) => p.status !== 'left');

  // Password gate (viewer access requires password if set), unless already logged in.
  if (room.has_password && !pwOk && !session) {
    return <PasswordGate roomId={room.id} onUnlock={() => setPwOk(true)} />;
  }

  const finalized = room.is_finalized
    ? ranked.find((r) => r.candidate.id === room.finalized_candidate_id)
    : undefined;
  const finalizedDate = room.is_finalized
    ? (finalized?.candidate.date ?? room.finalized_date ?? null)
    : null;
  const finalizedDates = room.is_finalized
    ? (room.finalized_options?.length
        ? room.finalized_options.map((o) => o.date)
        : finalizedDate ? [finalizedDate] : [])
    : [];

  return (
    <AuthProvider roomId={room.id} participants={data.participants}>
      <div className="flex flex-1 flex-col pb-safe">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/90 px-3 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur">
          <button
            onClick={() => nav('/')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"
            aria-label="홈"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate text-base font-bold">
              {room.has_password && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              {room.title}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {dayjs(room.date_range_start).format('M/D')} –{' '}
              {dayjs(room.date_range_end).format('M/D')} · 참가자 {activeParticipants.length}명
            </p>
          </div>
          <button
            onClick={() => setMembersOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"
            aria-label="참여 현황"
          >
            <Users className="h-5 w-5" />
          </button>
          {session && (
            <button
              onClick={() => setNotifOpen(true)}
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"
              aria-label="알림"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setMenuOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"
            aria-label="메뉴"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Finalized banner */}
          {room.is_finalized && finalizedDates.length > 0 && (
            <div className="space-y-2 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-400 p-4 text-white shadow-soft">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium opacity-90">일정이 확정됐어요</p>
                  {(room.finalized_options?.length
                    ? room.finalized_options
                    : [{ kind: 'allday' as const, date: finalizedDate! }]
                  ).map((opt, i) => {
                    const d = dayjs(opt.date).format('M월 D일 (ddd)');
                    const cand = ranked.find((r) => r.candidate.id === opt.candidate_id);
                    // confirmed = explicit voters ∪ all-day marks
                    const allDayIds = data.availability
                      .filter((a) => a.date === opt.date && a.status === 'all_day')
                      .map((a) => a.participant_id);
                    const voteIds = opt.kind === 'candidate'
                      ? data.votes.filter((v) => v.candidate_id === opt.candidate_id).map((v) => v.participant_id)
                      : [];
                    const confirmedIds = Array.from(new Set([...voteIds, ...allDayIds]));
                    const confirmed = confirmedIds
                      .map((id) => participantsById.get(id))
                      .filter(Boolean) as Participant[];
                    return (
                      <div key={i} className={cn(i > 0 && 'mt-2 border-t border-white/30 pt-2')}>
                        <p className="font-bold">
                          {d}{cand ? ` · ${fmtRange(cand.candidate.start_time, cand.candidate.end_time)}` : ' · 하루종일'}
                        </p>
                        {confirmed.length > 0 && (
                          <div className="mt-1.5">
                            <VoterAvatars
                              supporters={confirmed}
                              explicitIds={voteIds}
                              title={`${d}${cand ? ` · ${fmtRange(cand.candidate.start_time, cand.candidate.end_time)}` : ' · 하루종일'} 참여자`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!session && <ViewerBanner />}

          {!room.is_finalized && (
            <PromisingOptions
              options={promising}
              participantsById={participantsById}
              finalizedId={room.finalized_candidate_id}
              onPick={setPickedDate}
            />
          )}

          {/* Calendar / list view toggle */}
          <div className="flex rounded-2xl bg-muted p-1 text-sm font-semibold">
            {(['calendar', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'flex-1 rounded-xl py-2 transition',
                  view === v ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground',
                )}
              >
                {v === 'calendar' ? '캘린더' : '시간 후보 목록'}
              </button>
            ))}
          </div>

          {view === 'calendar' ? (
            <>
              <Calendar
                roomId={room.id}
                rangeStart={room.date_range_start}
                rangeEnd={room.date_range_end}
                heat={heat}
                participantCount={activeParticipants.length}
                participantsById={participantsById}
                finalizedDate={finalizedDate}
                finalizedDates={finalizedDates}
                readOnly={room.is_finalized}
                onPick={setPickedDate}
              />
              <Legend />
            </>
          ) : (
            <CandidateListView
              room={room}
              candidates={data.candidates}
              votes={data.votes}
              availability={data.availability}
              participantsById={participantsById}
              onOpenDate={setPickedDate}
            />
          )}
        </div>

        <DateSheet
          room={room}
          date={pickedDate}
          onClose={() => setPickedDate(null)}
          candidates={data.candidates}
          votes={data.votes}
          availability={data.availability}
          comments={data.comments}
          participantsById={participantsById}
        />

        {session && (
          <NotificationCenter
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            participantId={session.participantId}
            notifications={notifications}
            onJump={setPickedDate}
          />
        )}

        <MembersSheet
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          participants={data.participants}
          candidates={data.candidates}
          votes={data.votes}
          availability={data.availability}
        />

        <RoomMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          room={room}
          session={session}
          participants={activeParticipants}
          candidates={data.candidates}
          votes={data.votes}
          promising={promising}
        />
      </div>
    </AuthProvider>
  );
}

function ViewerBanner() {
  const { ensureAuth } = useAuth();
  return (
    <button
      onClick={() => void ensureAuth()}
      className="flex w-full items-center gap-2 rounded-2xl bg-primary/5 px-4 py-3 text-left text-sm text-primary active:scale-[0.99]"
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      <span>
        지금은 보기 모드예요. <span className="font-bold underline">참여하기</span>
      </span>
    </button>
  );
}

function Legend() {
  return (
    <div className="flex items-center justify-center gap-3 pb-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-indigo-50 ring-1 ring-border" /> 적음
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-indigo-200" /> 보통
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-indigo-300" /> 많음
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded ring-2 ring-amber-400" /> 확정
      </span>
    </div>
  );
}
