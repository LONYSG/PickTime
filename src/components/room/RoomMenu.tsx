import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  MessageCircle,
  CheckCircle2,
  RotateCcw,
  Pencil,
  KeyRound,
  ShieldCheck,
  Shield,
  Trash2,
  LogOut,
  Crown,
  Ban,
  UserMinus,
  DoorOpen,
  LogIn,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { PinInput } from '@/components/PinInput';
import { toast } from '@/components/ui/toast';
import { dayjs } from '@/lib/dayjs';
import { fmtRange, cn } from '@/lib/utils';
import { qk } from '@/lib/queryClient';
import {
  deleteRoom,
  finalizeRoom,
  friendlyError,
  kickParticipant,
  leaveRoom,
  renameParticipant,
  reopenRoom,
  resetParticipantPin,
  setParticipantRole,
  setSelfParticipation,
  updateRoomSettings,
} from '@/lib/api';
import { useSessionStore } from '@/store/session';
import { useAuth } from '@/components/auth/AuthProvider';
import { shareRoom } from '@/lib/kakao';
import type { CandidateTally } from '@/lib/aggregate';
import type { CandidateVote, Participant, Room, Session, TimeCandidate } from '@/lib/types';

export function RoomMenu({
  open,
  onClose,
  room,
  session,
  participants,
  candidates,
  votes,
  ranked,
}: {
  open: boolean;
  onClose: () => void;
  room: Room;
  session: Session | undefined;
  participants: Participant[];
  candidates: TimeCandidate[];
  votes: CandidateVote[];
  ranked: CandidateTally[];
}) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const clearSession = useSessionStore((s) => s.clearSession);
  const { ensureAuth } = useAuth();
  const isManager = session?.role === 'host' || session?.role === 'admin';
  const me = session ? participants.find((p) => p.id === session.participantId) : undefined;
  const [finalizing, setFinalizing] = useState(false);

  const refreshRoom = () => qc.invalidateQueries({ queryKey: qk.room(room.id) });
  const refreshParticipants = () => qc.invalidateQueries({ queryKey: qk.participants(room.id) });

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#/room/${room.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('링크를 복사했어요!');
    } catch {
      toast.info(url);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="방 메뉴">
      <div className="space-y-5 pb-4">
        {!session && (
          <Button
            className="w-full justify-start"
            onClick={() => {
              onClose();
              void ensureAuth();
            }}
          >
            <LogIn className="h-5 w-5" /> 참여하기 / 로그인
          </Button>
        )}

        <Button variant="secondary" className="w-full justify-start" onClick={copyLink}>
          <Link2 className="h-5 w-5" /> 초대 링크 복사
        </Button>

        <Button
          className="w-full justify-start bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00]"
          onClick={() => shareRoom(room.id, room.title)}
        >
          <MessageCircle className="h-5 w-5" /> 카카오톡으로 공유
        </Button>

        {/* Finalize / reopen */}
        {isManager && session && (
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-muted-foreground">일정 확정</h3>
            {room.is_finalized ? (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  try {
                    await reopenRoom(session.token);
                    refreshRoom();
                    toast.success('방을 다시 열었어요.');
                  } catch (e) {
                    toast.error(friendlyError(e));
                  }
                }}
              >
                <RotateCcw className="h-5 w-5" /> 방 다시 열기
              </Button>
            ) : (
              <Button
                className="w-full justify-start"
                onClick={() => setFinalizing(true)}
                disabled={ranked.filter((r) => r.total > 0).length === 0}
              >
                <CheckCircle2 className="h-5 w-5" /> 일정 확정하기
              </Button>
            )}
          </section>
        )}

        {/* Participants */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-muted-foreground">
            참가자 {participants.length}명
          </h3>
          <div className="space-y-1.5">
            {participants.map((p) => (
              <ParticipantRow
                key={p.id}
                p={p}
                room={room}
                session={session}
                onChanged={refreshParticipants}
              />
            ))}
          </div>
        </section>

        {/* Room settings */}
        {isManager && session && (
          <RoomSettingsForm
            room={room}
            session={session}
            candidates={candidates}
            votes={votes}
            onSaved={refreshRoom}
          />
        )}

        {/* My participation */}
        {session && me && (
          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-bold text-muted-foreground">내 참여</h3>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start',
                me.status === 'unavailable' && 'text-primary',
              )}
              onClick={async () => {
                try {
                  await setSelfParticipation(session.token, me.status !== 'unavailable');
                  qc.invalidateQueries({ queryKey: qk.participants(room.id) });
                  qc.invalidateQueries({ queryKey: qk.votes(room.id) });
                  qc.invalidateQueries({ queryKey: qk.availability(room.id) });
                  toast.success(
                    me.status === 'unavailable'
                      ? '다시 참여로 전환했어요.'
                      : '이 약속 전체 불참으로 표시했어요.',
                  );
                } catch (e) {
                  toast.error(friendlyError(e));
                }
              }}
            >
              <Ban className="h-5 w-5" />
              {me.status === 'unavailable' ? '다시 참여하기' : '이 약속 전체 불참'}
            </Button>
            {session.role !== 'host' && (
              <LeaveRoomButton
                onConfirm={async () => {
                  try {
                    await leaveRoom(session.token);
                    clearSession(room.id);
                    toast.success('방에서 나갔어요.');
                    nav('/');
                  } catch (e) {
                    toast.error(friendlyError(e));
                  }
                }}
              />
            )}
          </section>
        )}

        {/* Danger zone */}
        <section className="space-y-2 border-t border-border pt-4">
          {session?.role === 'host' && (
            <DeleteRoomButton
              onConfirm={async () => {
                try {
                  await deleteRoom(session.token);
                  clearSession(room.id);
                  toast.success('방을 삭제했어요.');
                  nav('/');
                } catch (e) {
                  toast.error(friendlyError(e));
                }
              }}
            />
          )}
          {session && (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                clearSession(room.id);
                onClose();
                toast.info('로그아웃했어요. 보기 모드로 전환돼요.');
              }}
            >
              <LogOut className="h-5 w-5" /> 로그아웃
            </Button>
          )}
        </section>
      </div>

      {finalizing && session && (
        <FinalizeDialog
          ranked={ranked}
          onClose={() => setFinalizing(false)}
          onPick={async (candidateId) => {
            try {
              await finalizeRoom(session.token, candidateId);
              refreshRoom();
              setFinalizing(false);
              onClose();
              toast.success('일정을 확정했어요! 🎉');
            } catch (e) {
              toast.error(friendlyError(e));
            }
          }}
        />
      )}
    </Sheet>
  );
}

function ParticipantRow({
  p,
  room,
  session,
  onChanged,
}: {
  p: Participant;
  room: Room;
  session: Session | undefined;
  onChanged: () => void;
}) {
  const canManage = (session?.role === 'host' || session?.role === 'admin') && p.role !== 'host';
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [name, setName] = useState(p.nickname);
  const isMe = session?.participantId === p.id;

  return (
    <div className="rounded-2xl bg-muted px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar nickname={p.nickname} color={p.color_hex} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{p.nickname}</span>
            {p.role === 'host' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            {p.role === 'admin' && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
            {isMe && <span className="text-[10px] text-muted-foreground">(나)</span>}
            {p.status === 'unavailable' && (
              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                불참
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <button
              onClick={() => setEditing((v) => !v)}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-card"
              aria-label="이름 변경"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={async () => {
                if (!session) return;
                try {
                  await setParticipantRole(
                    session.token,
                    p.id,
                    p.role === 'admin' ? 'participant' : 'admin',
                  );
                  onChanged();
                  toast.success(p.role === 'admin' ? '관리자 해제' : '관리자로 지정');
                } catch (e) {
                  toast.error(friendlyError(e));
                }
              }}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-card"
              aria-label="권한 변경"
            >
              {p.role === 'admin' ? <Shield className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setResetting(true)}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-card"
              aria-label="PIN 초기화"
            >
              <KeyRound className="h-4 w-4" />
            </button>
            {!isMe && (
              <button
                onClick={() => setKicking(true)}
                className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-card"
                aria-label="추방"
              >
                <UserMinus className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {kicking && session && (
        <Dialog open onClose={() => setKicking(false)} title={`${p.nickname}님을 추방할까요?`}>
          <p className="text-sm text-muted-foreground">
            이 멤버의 투표가 모두 삭제되고 멤버 목록에서 빠져요. 남긴 댓글은 '탈퇴자'로 표시돼
            남습니다.
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setKicking(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                try {
                  await kickParticipant(session.token, p.id);
                  setKicking(false);
                  onChanged();
                  toast.success(`${p.nickname}님을 추방했어요.`);
                } catch (e) {
                  toast.error(friendlyError(e));
                }
              }}
            >
              추방
            </Button>
          </div>
        </Dialog>
      )}

      {editing && session && (
        <div className="mt-2 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" maxLength={24} />
          <Button
            size="sm"
            className="h-10"
            onClick={async () => {
              try {
                await renameParticipant(session.token, p.id, name.trim());
                setEditing(false);
                onChanged();
                toast.success('이름을 변경했어요.');
              } catch (e) {
                toast.error(friendlyError(e));
              }
            }}
          >
            저장
          </Button>
        </div>
      )}

      {resetting && session && (
        <ResetPinDialog
          nickname={p.nickname}
          onClose={() => setResetting(false)}
          onSubmit={async (pin) => {
            try {
              await resetParticipantPin(session.token, p.id, pin);
              setResetting(false);
              toast.success(`${p.nickname}님의 PIN을 초기화했어요.`);
            } catch (e) {
              toast.error(friendlyError(e));
            }
          }}
        />
      )}
      {/* room kept for potential future per-room rules */}
      <span className="hidden">{room.id}</span>
    </div>
  );
}

function RoomSettingsForm({
  room,
  session,
  candidates,
  votes,
  onSaved,
}: {
  room: Room;
  session: Session;
  candidates: TimeCandidate[];
  votes: CandidateVote[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(room.title);
  const [start, setStart] = useState(room.date_range_start);
  const [end, setEnd] = useState(room.date_range_end);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const datesChanged = start !== room.date_range_start || end !== room.date_range_end;
  // Candidates that would fall outside the new range (and so be deleted).
  const lost = candidates.filter((c) => c.date < start || c.date > end);
  const lostIds = new Set(lost.map((c) => c.id));
  const affectedVoters = new Set(
    votes.filter((v) => lostIds.has(v.candidate_id)).map((v) => v.participant_id),
  ).size;

  async function save() {
    setBusy(true);
    try {
      await updateRoomSettings({
        token: session.token,
        title: title.trim(),
        dateStart: start,
        dateEnd: end,
      });
      onSaved();
      toast.success('설정을 저장했어요.');
      setConfirming(false);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-bold text-muted-foreground">방 설정</h3>
      <div>
        <Label>약속 이름</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>시작일</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label>종료일</Label>
          <Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full"
        disabled={busy || !title.trim() || end < start}
        onClick={() => {
          // If narrowing the range would delete already-voted candidates, confirm first.
          if (datesChanged && lost.length > 0) setConfirming(true);
          else save();
        }}
      >
        설정 저장
      </Button>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="기간을 바꿀까요?">
        <p className="text-sm text-muted-foreground">
          새 기간을 벗어나는 <b className="text-foreground">시간 후보 {lost.length}개</b>가 삭제되고,
          {affectedVoters > 0 && (
            <>
              {' '}
              <b className="text-foreground">{affectedVoters}명</b>의 투표가 취소돼요.
            </>
          )}{' '}
          되돌릴 수 없고, 해당 참가자에게 알림이 가요.
        </p>
        <div className="mt-3 max-h-28 overflow-y-auto rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          {Array.from(new Set(lost.map((c) => c.date)))
            .sort()
            .map((d) => dayjs(d).format('M/D (ddd)'))
            .join(', ')}
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
            취소
          </Button>
          <Button variant="destructive" className="flex-1" disabled={busy} onClick={save}>
            계속
          </Button>
        </div>
      </Dialog>
    </section>
  );
}

function FinalizeDialog({
  ranked,
  onClose,
  onPick,
}: {
  ranked: CandidateTally[];
  onClose: () => void;
  onPick: (candidateId: string) => void;
}) {
  const options = ranked.filter((r) => r.total > 0).slice(0, 8);
  return (
    <Dialog open onClose={onClose} title="확정할 시간 선택">
      <div className="space-y-2">
        {options.map((t) => (
          <button
            key={t.candidate.id}
            onClick={() => onPick(t.candidate.id)}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
          >
            <span className="font-semibold">
              {dayjs(t.candidate.date).format('M/D (ddd)')} ·{' '}
              {fmtRange(t.candidate.start_time, t.candidate.end_time)}
            </span>
            <span className="font-bold text-primary">{t.total}표</span>
          </button>
        ))}
      </div>
      <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>
        취소
      </Button>
    </Dialog>
  );
}

function ResetPinDialog({
  nickname,
  onClose,
  onSubmit,
}: {
  nickname: string;
  onClose: () => void;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState('');
  return (
    <Dialog open onClose={onClose} title={`${nickname}님 PIN 초기화`}>
      <p className="mb-4 text-sm text-muted-foreground">새 4자리 PIN을 설정해 전달하세요.</p>
      <PinInput value={pin} onChange={setPin} autoFocus />
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          취소
        </Button>
        <Button className="flex-1" disabled={pin.length !== 4} onClick={() => onSubmit(pin)}>
          초기화
        </Button>
      </div>
    </Dialog>
  );
}

function LeaveRoomButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start text-destructive"
        onClick={() => setConfirming(true)}
      >
        <DoorOpen className="h-5 w-5" /> 불참하고 방 나가기
      </Button>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="방에서 나갈까요?">
        <p className="text-sm text-muted-foreground">
          내 투표와 표시가 모두 사라지고 멤버 목록에서 빠져요. 남긴 댓글은 '탈퇴자'로 표시돼
          남습니다. 다시 들어오려면 새로 참여해야 해요.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
            취소
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>
            나가기
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function DeleteRoomButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="h-5 w-5" /> 방 삭제
      </Button>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="방을 삭제할까요?">
        <p className="text-sm text-muted-foreground">
          모든 투표, 후보, 댓글이 영구히 삭제돼요. 되돌릴 수 없어요.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
            취소
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>
            삭제
          </Button>
        </div>
      </Dialog>
    </>
  );
}
