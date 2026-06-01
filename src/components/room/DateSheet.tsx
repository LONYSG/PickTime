import { useMemo, useState } from 'react';
import {
  Plus,
  Sun,
  Check,
  CalendarOff,
  Pencil,
  Trash2,
  History,
  MessageCircle,
  Send,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { TimeRangePicker } from './TimeRangePicker';
import { VoterAvatars } from './VoterAvatars';
import { toast } from '@/components/ui/toast';
import { dayjs } from '@/lib/dayjs';
import { useHolidays } from '@/hooks/useHolidays';
import { fmtRange, cn } from '@/lib/utils';
import { tallyForDate } from '@/lib/aggregate';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useAuth } from '@/components/auth/AuthProvider';
import type {
  Comment,
  DateAvailability,
  Participant,
  Room,
  TimeCandidate,
  CandidateVote,
} from '@/lib/types';

interface DateSheetProps {
  room: Room;
  date: string | null;
  onClose: () => void;
  candidates: TimeCandidate[];
  votes: CandidateVote[];
  availability: DateAvailability[];
  comments: Comment[];
  participantsById: Map<string, Participant>;
}

export function DateSheet({
  room,
  date,
  onClose,
  candidates,
  votes,
  availability,
  comments,
  participantsById,
}: DateSheetProps) {
  const { session } = useAuth();
  const actions = useRoomActions(room.id);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const readOnly = room.is_finalized;
  const open = date !== null;

  const tallies = useMemo(
    () => (date ? tallyForDate(candidates, votes, availability, date) : []),
    [candidates, votes, availability, date],
  );
  const dateComments = useMemo(
    () => (date ? comments.filter((c) => c.date === date) : []),
    [comments, date],
  );

  const myRow =
    date && session
      ? availability.find((a) => a.date === date && a.participant_id === session.participantId)
      : undefined;
  const myAllDay = myRow?.status === 'all_day';
  const myUnavailable = myRow?.status === 'unavailable';
  // Whole-room 불참: per-date 불참 is meaningless, so block it with a notice.
  const meUnavailableAll =
    !!session && participantsById.get(session.participantId)?.status === 'unavailable';

  const getHoliday = useHolidays(date ? dayjs(date).year() : dayjs().year());

  if (!date) return null;
  const d = dayjs(date);

  // 이 날짜가 하루종일로 확정됐는지 확인
  const finalizedAllDay = room.finalized_options?.find(
    (o) => o.kind === 'allday' && o.date === date,
  );

  // 하루종일 표시 참여자 (항상 계산)
  const allDayParticipants = availability
    .filter((a) => a.date === date && a.status === 'all_day')
    .map((a) => participantsById.get(a.participant_id))
    .filter(Boolean) as Participant[];

  const holidayName = getHoliday(date);

  return (
    <Sheet
      open={open}
      onClose={() => {
        setAdding(false);
        setEditingId(null);
        onClose();
      }}
      title={holidayName ? `${d.format('M월 D일 (ddd)')} · ${holidayName}` : d.format('M월 D일 (ddd)')}
    >
      <div className="space-y-5 pb-4">
        {/* My status for this date: all-day / unavailable */}
        {!readOnly && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => actions.setMyDateStatus(date, myAllDay ? 'none' : 'all_day')}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition active:scale-[0.99]',
                myAllDay ? 'border-amber-300 bg-amber-50' : 'border-border bg-card',
              )}
            >
              <span
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-xl',
                  myAllDay ? 'bg-amber-400 text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                <Sun className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold">하루 종일 가능</span>
              <span className="text-[11px] text-muted-foreground">모든 후보 지지</span>
            </button>
            <button
              onClick={() => {
                if (meUnavailableAll) {
                  toast.info('이미 이 약속 전체 불참 상태예요. 날짜별 불참은 전체 불참을 해제한 뒤 사용하세요.');
                  return;
                }
                actions.setMyDateStatus(date, myUnavailable ? 'none' : 'unavailable');
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition active:scale-[0.99]',
                myUnavailable ? 'border-rose-300 bg-rose-50' : 'border-border bg-card',
                meUnavailableAll && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-xl',
                  myUnavailable ? 'bg-rose-400 text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                <CalendarOff className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold">이 날 불참</span>
              <span className="text-[11px] text-muted-foreground">투표 취소돼요</span>
            </button>
          </div>
        )}

        {/* Candidates */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-muted-foreground">{readOnly ? '시간 결과' : '시간 후보'}</h3>
            {!readOnly && !adding && (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 text-sm font-semibold text-primary"
              >
                <Plus className="h-4 w-4" /> 추가
              </button>
            )}
          </div>

          {adding && (
            <AddCandidate
              onCancel={() => setAdding(false)}
              onSubmit={async (start, end) => {
                await actions.createCandidate(date, start, end);
                setAdding(false);
              }}
            />
          )}

          {/* 하루종일 항목 — 시간 후보 없을 때는 맨 위에 */}
          {allDayParticipants.length > 0 && tallies.length === 0 && !adding && (
            <AllDayRow
              participants={allDayParticipants}
              isFinalized={!!finalizedAllDay}
              hasCandidates={false}
            />
          )}

          {/* 시간 후보도 없고 하루종일도 없을 때만 empty 메시지 */}
          {tallies.length === 0 && allDayParticipants.length === 0 && !adding && (
            <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              {readOnly ? '이 날은 시간 후보가 없었어요.' : '아직 시간 후보가 없어요. 첫 후보를 추가해 보세요!'}
            </p>
          )}

          {tallies.map((t) => {
            const voted = !!(session && t.explicitVoterIds.includes(session.participantId));
            const isOwner = !!(session && t.candidate.created_by === session.participantId);
            const canDelete = !!(session && (session.role !== 'participant' || isOwner));
            const isFinal = room.finalized_options?.length
              ? room.finalized_options.some((o) => o.candidate_id === t.candidate.id)
              : room.finalized_candidate_id === t.candidate.id;
            const supporters = t.supporterIds
              .map((id) => participantsById.get(id))
              .filter(Boolean) as Participant[];

            if (editingId === t.candidate.id) {
              return (
                <AddCandidate
                  key={t.candidate.id}
                  initial={{ start: t.candidate.start_time, end: t.candidate.end_time }}
                  warn={t.explicitVoterIds.length > 0}
                  submitLabel="수정"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (start, end) => {
                    await actions.updateCandidate(t.candidate.id, start, end);
                    setEditingId(null);
                  }}
                />
              );
            }

            return (
              <div
                key={t.candidate.id}
                className={cn(
                  'rounded-2xl border p-3',
                  isFinal ? 'border-amber-300 bg-amber-50' : 'border-border bg-card',
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    disabled={readOnly}
                    onClick={() => actions.toggleVote(t.candidate.id, voted)}
                    className={cn(
                      'grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition active:scale-95',
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
                    <div className="flex items-center gap-2">
                      <span className="font-bold">
                        {fmtRange(t.candidate.start_time, t.candidate.end_time)}
                      </span>
                      {isFinal && (
                        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">
                          확정
                        </span>
                      )}
                      {t.unavailableCount > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                          불참 {t.unavailableCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <VoterAvatars
                        supporters={supporters}
                        explicitIds={t.explicitVoterIds}
                        title={`${fmtRange(t.candidate.start_time, t.candidate.end_time)} · ${t.total}명`}
                      />
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
                    {t.total}표
                  </span>
                </div>

                {/* owner/admin controls */}
                {!readOnly && (isOwner || canDelete || t.candidate.edit_history.length > 0) && (
                  <div className="mt-2 flex items-center gap-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    {isOwner && (
                      <button
                        onClick={() => setEditingId(t.candidate.id)}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" /> 수정
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => actions.removeCandidate(t.candidate.id)}
                        className="flex items-center gap-1 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> 삭제
                      </button>
                    )}
                    {t.candidate.edit_history.length > 0 && (
                      <span className="ml-auto flex items-center gap-1">
                        <History className="h-3.5 w-3.5" />
                        {t.candidate.edit_history.at(-1)?.change}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 하루종일 항목 — 시간 후보 있을 때는 맨 아래에 */}
          {allDayParticipants.length > 0 && tallies.length > 0 && (
            <AllDayRow
              participants={allDayParticipants}
              isFinalized={!!finalizedAllDay}
              hasCandidates={true}
            />
          )}
        </section>

        {/* Comments */}
        <CommentSection
          date={date}
          comments={dateComments}
          participantsById={participantsById}
          readOnly={readOnly}
          onPost={(content) => actions.postComment(date, content)}
        />
      </div>
    </Sheet>
  );
}

function AddCandidate({
  initial,
  warn,
  submitLabel = '추가',
  onSubmit,
  onCancel,
}: {
  initial?: { start: string; end: string };
  warn?: boolean;
  submitLabel?: string;
  onSubmit: (start: string, end: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<{ start: string; end: string } | null>(
    initial ?? { start: '18:00:00', end: '20:00:00' },
  );
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
      {warn && (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800">
          이미 투표가 있어요. 수정하면 모든 표가 초기화되고 참가자에게 알림이 가요.
        </p>
      )}
      <TimeRangePicker value={value} onChange={setValue} />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          취소
        </Button>
        <Button
          className="flex-1"
          disabled={!value || busy}
          onClick={async () => {
            if (!value) return;
            setBusy(true);
            await onSubmit(value.start, value.end);
            setBusy(false);
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function AllDayRow({
  participants,
  isFinalized,
  hasCandidates,
}: {
  participants: Participant[];
  isFinalized: boolean;
  hasCandidates: boolean;
}) {
  return (
    <div className={cn(
      'rounded-2xl border p-3',
      isFinalized ? 'border-amber-300 bg-amber-50' : 'border-amber-200 bg-amber-50/60',
    )}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
          <Sun className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-800">
              {isFinalized ? '하루종일 확정' : '하루종일 가능'}
            </span>
            {!isFinalized && hasCandidates && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                모든 후보 지지
              </span>
            )}
          </div>
          <div className="mt-1">
            <VoterAvatars
              supporters={participants}
              explicitIds={participants.map((p) => p.id)}
              title={isFinalized ? '하루종일 확정 참여자' : '하루종일 가능 참여자'}
            />
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-700">
          {participants.length}명
        </span>
      </div>
    </div>
  );
}

function CommentSection({
  comments,
  participantsById,
  readOnly,
  onPost,
}: {
  date: string;
  comments: Comment[];
  participantsById: Map<string, Participant>;
  readOnly: boolean;
  onPost: (content: string) => void | Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    await onPost(content);
    setText('');
    setBusy(false);
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
        <MessageCircle className="h-4 w-4" /> 댓글
      </h3>

      <div className="space-y-2.5">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">{readOnly ? '댓글이 없어요.' : '가볍게 의견을 남겨보세요.'}</p>
        )}
        {comments.map((c) => {
          const p = c.participant_id ? participantsById.get(c.participant_id) : undefined;
          return (
            <div key={c.id} className="flex gap-2.5">
              <Avatar
                nickname={p?.nickname ?? '?'}
                color={p?.color_hex ?? '#9ca3af'}
                size="md"
              />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{p?.nickname ?? '알 수 없음'}</span>
                  {p?.status === 'left' && (
                    <span className="rounded bg-muted-foreground/15 px-1 text-[10px] font-medium text-muted-foreground">
                      탈퇴자
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {dayjs(c.created_at).format('M/D HH:mm')}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{c.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="댓글 달기…"
            rows={1}
            maxLength={500}
            className="max-h-28"
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={!text.trim() || busy}
            onClick={send}
            aria-label="보내기"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      )}
    </section>
  );
}
