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
  ArrowRightLeft,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { PinInput } from '@/components/PinInput';
import { toast } from '@/components/ui/toast';
import { dayjs, todayStr } from '@/lib/dayjs';
import { fmtRange, cn } from '@/lib/utils';
import { qk } from '@/lib/queryClient';
import {
  deleteRoom,
  finalizeRoomMulti,
  friendlyError,
  kickParticipant,
  leaveRoom,
  renameParticipant,
  reopenRoom,
  resetParticipantPin,
  setParticipantRole,
  setSelfParticipation,
  transferHost,
  updateRoomSettings,
} from '@/lib/api';
import { useSessionStore } from '@/store/session';
import { useAuth } from '@/components/auth/AuthProvider';
import { shareRoom, shareResult } from '@/lib/kakao';
import type { PromisingOption } from '@/lib/aggregate';
import type { CandidateVote, Participant, Room, Session, TimeCandidate } from '@/lib/types';

export function RoomMenu({
  open,
  onClose,
  room,
  session,
  participants,
  candidates,
  votes,

  promising,
}: {
  open: boolean;
  onClose: () => void;
  room: Room;
  session: Session | undefined;
  participants: Participant[];
  candidates: TimeCandidate[];
  votes: CandidateVote[];
  promising: PromisingOption[];
}) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const clearSession = useSessionStore((s) => s.clearSession);
  const { ensureAuth } = useAuth();
  const me = session ? participants.find((p) => p.id === session.participantId) : undefined;
  const myRole = me?.role ?? session?.role;
  const isManager = myRole === 'host' || myRole === 'admin';
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

  const resultLines = (() => {
    const opts = room.finalized_options ?? [];
    if (opts.length > 0) {
      return opts.map((opt) => {
        const d = dayjs(opt.date).format('M월 D일 (ddd)');
        if (opt.kind === 'allday') return `${d} · 하루종일`;
        const cand = candidates.find((c) => c.id === opt.candidate_id);
        return cand ? `${d} · ${fmtRange(cand.start_time, cand.end_time)}` : d;
      });
    }
    // 이전 방식으로 확정된 방 fallback
    if (room.finalized_date) {
      const d = dayjs(room.finalized_date).format('M월 D일 (ddd)');
      if (room.finalized_candidate_id) {
        const cand = candidates.find((c) => c.id === room.finalized_candidate_id);
        if (cand) return [`${d} · ${fmtRange(cand.start_time, cand.end_time)}`];
      }
      return [`${d} · 하루종일`];
    }
    return [];
  })();

  return (
    <Sheet open={open} onClose={onClose} title="방 메뉴">
      <div className="space-y-5 pb-4">
        {!session && (
          <Button className="w-full justify-start" onClick={() => { onClose(); void ensureAuth(); }}>
            <LogIn className="h-5 w-5" /> 참여하기 / 로그인
          </Button>
        )}

        {room.is_finalized ? (
          /* ── 확정 후 간소화 메뉴 ── */
          <>
            <section className="space-y-2 border-b border-border pb-4">
              <Button
                className="w-full justify-start bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00]"
                onClick={() => shareResult(room.id, room.title, resultLines)}
              >
                <MessageCircle className="h-5 w-5" /> 결과 카카오톡으로 공유
              </Button>
            </section>

            {isManager && session && (
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
            )}

            {/* 참가자 목록 (읽기 전용) */}
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground">참가자 {participants.length}명</h3>
              <div className="space-y-1.5">
                {participants.map((p) => (
                  <ParticipantRow key={p.id} p={p} room={room} session={session} me={me} onChanged={refreshParticipants} />
                ))}
              </div>
            </section>

            <section className="space-y-2 border-t border-border pt-4">
              {session?.role === 'host' && (
                <DeleteRoomButton onConfirm={async () => {
                  try { await deleteRoom(session!.token); clearSession(room.id); toast.success('방을 삭제했어요.'); nav('/'); }
                  catch (e) { toast.error(friendlyError(e)); }
                }} />
              )}
              {session && (
                <Button variant="ghost" className="w-full justify-start text-muted-foreground"
                  onClick={() => { clearSession(room.id); onClose(); toast.info('로그아웃했어요.'); }}>
                  <LogOut className="h-5 w-5" /> 로그아웃
                </Button>
              )}
            </section>
          </>
        ) : (
          /* ── 일반 메뉴 ── */
          <>
            <section className="space-y-2 border-b border-border pb-4">
              <Button variant="secondary" className="w-full justify-start" onClick={copyLink}>
                <Link2 className="h-5 w-5" /> 초대 링크 복사
              </Button>
              <Button
                className="w-full justify-start bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00]"
                onClick={() => shareRoom(room.id, room.title)}
              >
                <MessageCircle className="h-5 w-5" /> 카카오톡으로 공유
              </Button>
            </section>

            {isManager && session && (
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-muted-foreground">일정 확정</h3>
                <Button
                  className="w-full justify-start"
                  onClick={() => setFinalizing(true)}
                  disabled={promising.filter((r) => r.total > 0).length === 0}
                >
                  <CheckCircle2 className="h-5 w-5" /> 일정 확정하기
                </Button>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground">참가자 {participants.length}명</h3>
              <div className="space-y-1.5">
                {participants.map((p) => (
                  <ParticipantRow key={p.id} p={p} room={room} session={session} me={me} onChanged={refreshParticipants} />
                ))}
              </div>
            </section>

            {isManager && session && (
              <RoomSettingsForm room={room} session={session} candidates={candidates} votes={votes} onSaved={refreshRoom} />
            )}

            {session && me && (
              <section className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-bold text-muted-foreground">내 참여</h3>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start', me.status === 'unavailable' && 'text-primary')}
                  onClick={async () => {
                    try {
                      await setSelfParticipation(session.token, me.status !== 'unavailable');
                      qc.invalidateQueries({ queryKey: qk.participants(room.id) });
                      qc.invalidateQueries({ queryKey: qk.votes(room.id) });
                      qc.invalidateQueries({ queryKey: qk.availability(room.id) });
                      toast.success(me.status === 'unavailable' ? '다시 참여로 전환했어요.' : '이 약속 전체 불참으로 표시했어요.');
                    } catch (e) { toast.error(friendlyError(e)); }
                  }}
                >
                  <Ban className="h-5 w-5" />
                  {me.status === 'unavailable' ? '다시 참여하기' : '이 약속 전체 불참'}
                </Button>
                {session.role !== 'host' && (
                  <LeaveRoomButton onConfirm={async () => {
                    try { await leaveRoom(session.token); clearSession(room.id); toast.success('방에서 나갔어요.'); nav('/'); }
                    catch (e) { toast.error(friendlyError(e)); }
                  }} />
                )}
              </section>
            )}

            <section className="space-y-2 border-t border-border pt-4">
              {session?.role === 'host' && (
                <DeleteRoomButton onConfirm={async () => {
                  try { await deleteRoom(session!.token); clearSession(room.id); toast.success('방을 삭제했어요.'); nav('/'); }
                  catch (e) { toast.error(friendlyError(e)); }
                }} />
              )}
              {session && (
                <Button variant="ghost" className="w-full justify-start text-muted-foreground"
                  onClick={() => { clearSession(room.id); onClose(); toast.info('로그아웃했어요. 보기 모드로 전환돼요.'); }}>
                  <LogOut className="h-5 w-5" /> 로그아웃
                </Button>
              )}
            </section>
          </>
        )}
      </div>

      {finalizing && session && (
        <FinalizeDialog
          promising={promising}
          onClose={() => setFinalizing(false)}
          onConfirm={async (selected) => {
            try {
              const options = Array.from(selected).map((id) => {
                const opt = promising.find((o) => o.id === id)!;
                return opt.kind === 'candidate'
                  ? { kind: 'candidate' as const, candidate_id: opt.id, date: opt.date }
                  : { kind: 'allday' as const, date: opt.date };
              });
              await finalizeRoomMulti(session.token, options);
              refreshRoom();
              setFinalizing(false);
              onClose();
              toast.success('일정을 확정했어요!');
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
  me,
  onChanged,
}: {
  p: Participant;
  room: Room;
  session: Session | undefined;
  me: Participant | undefined;
  onChanged: () => void;
}) {
  const myRole = me?.role ?? session?.role;
  const canManage = (myRole === 'host' || myRole === 'admin') && p.role !== 'host' && !room.is_finalized;
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [roleConfirm, setRoleConfirm] = useState(false);
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
              onClick={() => setRoleConfirm(true)}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-card"
              aria-label={p.role === 'admin' ? '관리자 해제' : '관리자로 지정'}
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
            {myRole === 'host' && !isMe && (
              <button
                onClick={() => setTransferring(true)}
                className="grid h-8 w-8 place-items-center rounded-full text-amber-500 hover:bg-card"
                aria-label="호스트 위임"
              >
                <Crown className="h-4 w-4" />
              </button>
            )}
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

      {roleConfirm && session && (
        <Dialog open onClose={() => setRoleConfirm(false)}
          title={p.role === 'admin' ? `${p.nickname}님 관리자 해제` : `${p.nickname}님을 관리자로 지정`}>
          <p className="text-sm text-muted-foreground">
            {p.role === 'admin'
              ? '관리자 권한을 해제해요. 일반 참가자로 전환됩니다.'
              : '관리자로 지정하면 일정 확정, 방 설정, 참가자 관리 권한이 부여돼요.'}
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setRoleConfirm(false)}>취소</Button>
            <Button className="flex-1" onClick={async () => {
              try {
                await setParticipantRole(session.token, p.id, p.role === 'admin' ? 'participant' : 'admin');
                setRoleConfirm(false);
                onChanged();
                toast.success(p.role === 'admin' ? '관리자 해제했어요.' : '관리자로 지정했어요.');
              } catch (e) { toast.error(friendlyError(e)); }
            }}>
              확인
            </Button>
          </div>
        </Dialog>
      )}

      {transferring && session && (
        <Dialog open onClose={() => setTransferring(false)} title={`${p.nickname}님께 호스트를 위임할까요?`}>
          <p className="text-sm text-muted-foreground">
            {p.nickname}님이 새 호스트가 되고, 나는 관리자로 전환돼요.
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setTransferring(false)}>
              취소
            </Button>
            <Button
              className="flex-1"
              onClick={async () => {
                try {
                  await transferHost(session.token, p.id);
                  setTransferring(false);
                  onChanged();
                  toast.success(`${p.nickname}님께 호스트를 위임했어요.`);
                } catch (e) {
                  toast.error(friendlyError(e));
                }
              }}
            >
              <ArrowRightLeft className="h-4 w-4" /> 위임
            </Button>
          </div>
        </Dialog>
      )}

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
          <Input type="date" min={todayStr()} value={start} onChange={(e) => setStart(e.target.value)} />
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
  promising,
  onClose,
  onConfirm,
}: {
  promising: PromisingOption[];
  onClose: () => void;
  onConfirm: (selected: Set<string>) => void;
}) {
  const options = promising.filter((r) => r.total > 0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Dialog open onClose={onClose} title="확정할 일정 선택">
      <p className="mb-3 text-xs text-muted-foreground">여러 개 선택 가능해요 (1박2일 등)</p>
      <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
        {options.map((opt) => {
          const checked = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]',
                checked ? 'border-primary bg-primary/10' : 'border-border bg-card',
              )}
            >
              <span className="font-semibold">
                {dayjs(opt.date).format('M/D (ddd)')}
                {opt.kind === 'candidate' ? ` · ${fmtRange(opt.start_time!, opt.end_time!)}` : ' · 하루종일'}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary">{opt.total}표</span>
                <span className={cn('grid h-5 w-5 place-items-center rounded-full border-2 transition',
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                  {checked && <CheckCircle2 className="h-3 w-3" />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>취소</Button>
        <Button className="flex-1" disabled={selected.size === 0} onClick={() => onConfirm(selected)}>
          {selected.size > 0 ? `${selected.size}개 확정` : '확정'}
        </Button>
      </div>
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
