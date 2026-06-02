import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  MessageCircle,
  CheckCircle2,
  RotateCcw,
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
  UserPlus,
  Settings,
  ChevronDown,
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
  changePin,
  deleteRoom,
  finalizeRoomMulti,
  friendlyError,
  kickParticipant,
  leaveRoom,
  reopenRoom,
  setParticipantRole,
  setRoomPassword,
  setSelfParticipation,
  transferHost,
  updateRoomSettings,
} from '@/lib/api';
import { useSessionStore } from '@/store/session';
import { useAuth } from '@/components/auth/AuthProvider';
import { shareRoom, shareResult } from '@/lib/kakao';
import { VoterAvatars } from './VoterAvatars';
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
  const participantsById = new Map(participants.map((p) => [p.id, p]));
  const [finalizing, setFinalizing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

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
          <section className="border-b border-border pb-4">
            <Button className="w-full justify-start" onClick={() => { onClose(); void ensureAuth(); }}>
              <LogIn className="h-5 w-5" /> 참여하기 / 로그인
            </Button>
          </section>
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

            <p className="text-sm text-muted-foreground">
              참가자와 참여 현황은 상단 👥 버튼에서 볼 수 있어요.
            </p>

            <section className="space-y-2 border-t border-border pt-4">
              {session?.role === 'host' && (
                <DeleteRoomButton onConfirm={async () => {
                  try { await deleteRoom(session!.token); clearSession(room.id); toast.success('방을 삭제했어요.'); nav('/'); }
                  catch (e) { toast.error(friendlyError(e)); }
                }} />
              )}
              {session && (
                <LogoutButton onConfirm={() => { clearSession(room.id); onClose(); toast.info('로그아웃했어요.'); nav('/'); }} />
              )}
            </section>
          </>
        ) : (
          /* ── 일반 메뉴 ── */
          <>
            <section className="border-b border-border pb-4">
              <Button variant="secondary" className="w-full justify-start" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-5 w-5" /> 이 약속에 친구 초대하기
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

            {isManager && session && (
              <RoomSettingsForm
                room={room}
                session={session}
                candidates={candidates}
                votes={votes}
                participants={participants}
                me={me}
                isHost={myRole === 'host'}
                onSaved={refreshRoom}
                onParticipantsChanged={refreshParticipants}
              />
            )}

            {session && me && (
              <section className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-bold text-muted-foreground">내 참여</h3>
                <ParticipationButton
                  unavailable={me.status === 'unavailable'}
                  onToggle={async (next) => {
                    try {
                      await setSelfParticipation(session.token, next);
                      qc.invalidateQueries({ queryKey: qk.participants(room.id) });
                      qc.invalidateQueries({ queryKey: qk.votes(room.id) });
                      qc.invalidateQueries({ queryKey: qk.availability(room.id) });
                      toast.success(next ? '이 약속 전체 불참으로 표시했어요.' : '다시 참여로 전환했어요.');
                    } catch (e) {
                      toast.error(friendlyError(e));
                    }
                  }}
                />
                <ChangePinButton token={session.token} />
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
                <LogoutButton onConfirm={() => { clearSession(room.id); onClose(); toast.info('로그아웃했어요.'); nav('/'); }} />
              )}
            </section>
          </>
        )}
      </div>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onKakao={() => {
          shareRoom(room.id, room.title);
          setInviteOpen(false);
        }}
        onCopy={async () => {
          await copyLink();
          setInviteOpen(false);
        }}
      />

      {finalizing && session && (
        <FinalizeDialog
          promising={promising}
          participantsById={participantsById}
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
  const [kicking, setKicking] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [roleConfirm, setRoleConfirm] = useState(false);
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
              onClick={() => setRoleConfirm(true)}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-card"
              aria-label={p.role === 'admin' ? '관리자 해제' : '관리자로 지정'}
            >
              {p.role === 'admin' ? <Shield className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </button>
            {/* 닉네임 변경 / PIN 초기화는 월권 소지가 있어 비활성화 (필요 시 복구) */}
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
  participants,
  me,
  isHost,
  onSaved,
  onParticipantsChanged,
}: {
  room: Room;
  session: Session;
  candidates: TimeCandidate[];
  votes: CandidateVote[];
  participants: Participant[];
  me: Participant | undefined;
  isHost: boolean;
  onSaved: () => void;
  onParticipantsChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(room.title);
  const [start, setStart] = useState(room.date_range_start);
  const [end, setEnd] = useState(room.date_range_end);
  const [pwOn, setPwOn] = useState(room.has_password);
  const [pw, setPw] = useState('');
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
    // Want a password on but never set one → ask for it.
    if (isHost && pwOn && !room.has_password && !pw.trim()) {
      toast.error('사용할 비밀번호를 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      await updateRoomSettings({
        token: session.token,
        title: title.trim(),
        dateStart: start,
        dateEnd: end,
      });
      if (isHost) {
        if (!pwOn && room.has_password) await setRoomPassword(session.token, null); // remove
        else if (pwOn && pw.trim()) await setRoomPassword(session.token, pw.trim()); // set/change
      }
      onSaved();
      setPw('');
      toast.success('설정을 저장했어요.');
      setConfirming(false);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-t border-border pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
          <Settings className="h-4 w-4" /> 방 설정
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
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

          {isHost && (
            <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <KeyRound className="h-4 w-4" /> 비밀번호로 방 보호
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pwOn}
                  onClick={() => setPwOn((v) => !v)}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition',
                    pwOn ? 'bg-primary' : 'bg-border',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                      pwOn ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
              {pwOn && (
                <Input
                  type="text"
                  placeholder={room.has_password ? '새 비밀번호 (변경 시에만 입력)' : '비밀번호 입력'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  maxLength={64}
                />
              )}
            </div>
          )}

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

          {/* 참가자 관리 (관리자 전용) */}
          <div className="space-y-1.5 border-t border-border pt-3">
            <h4 className="text-xs font-bold text-muted-foreground">참가자 관리 ({participants.length}명)</h4>
            {participants.map((p) => (
              <ParticipantRow
                key={p.id}
                p={p}
                room={room}
                session={session}
                me={me}
                onChanged={onParticipantsChanged}
              />
            ))}
          </div>
        </div>
      )}

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

function InviteDialog({
  open,
  onClose,
  onKakao,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  onKakao: () => void;
  onCopy: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="친구 초대하기">
      <p className="mb-4 text-sm text-muted-foreground">링크로 친구를 초대하세요.</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onKakao}
          className="flex flex-col items-center gap-2 rounded-2xl bg-[#FEE500] py-5 text-[#191919] transition active:scale-95"
        >
          <MessageCircle className="h-7 w-7" />
          <span className="text-sm font-bold">카카오톡</span>
        </button>
        <button
          onClick={onCopy}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-5 transition active:scale-95"
        >
          <Link2 className="h-7 w-7 text-primary" />
          <span className="text-sm font-bold">링크 복사</span>
        </button>
      </div>
    </Dialog>
  );
}

function FinalizeDialog({
  promising,
  participantsById,
  onClose,
  onConfirm,
}: {
  promising: PromisingOption[];
  participantsById: Map<string, Participant>;
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
                'flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]',
                checked ? 'border-primary bg-primary/10' : 'border-border bg-card',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {dayjs(opt.date).format('M/D (ddd)')}
                  {opt.kind === 'candidate' ? ` · ${fmtRange(opt.start_time!, opt.end_time)}` : ' · 하루종일'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {opt.total}표
                  </span>
                  <span className={cn('grid h-5 w-5 place-items-center rounded-full border-2 transition',
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                    {checked && <CheckCircle2 className="h-3 w-3" />}
                  </span>
                </div>
              </div>
              {opt.supporterIds.length > 0 && (
                <VoterAvatars
                  supporters={opt.supporterIds.map((id) => participantsById.get(id)).filter(Boolean) as Participant[]}
                  explicitIds={opt.supporterIds}
                  title={`${dayjs(opt.date).format('M/D (ddd)')}${opt.kind === 'candidate' ? ` · ${fmtRange(opt.start_time!, opt.end_time)}` : ' · 하루종일'} · 투표자`}
                />
              )}
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

function ParticipationButton({
  unavailable,
  onToggle,
}: {
  unavailable: boolean;
  onToggle: (next: boolean) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (unavailable) {
    return (
      <Button
        variant="outline"
        className="w-full justify-start text-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onToggle(false);
          setBusy(false);
        }}
      >
        <Ban className="h-5 w-5" /> 다시 참여하기
      </Button>
    );
  }
  return (
    <>
      <Button variant="outline" className="w-full justify-start" onClick={() => setConfirming(true)}>
        <Ban className="h-5 w-5" /> 이 약속 전체 불참
      </Button>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="전체 불참으로 표시할까요?">
        <p className="text-sm text-muted-foreground">
          이 약속의 내 투표와 하루종일/날짜 표시가 모두 취소돼요.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
            취소
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onToggle(true);
              setBusy(false);
              setConfirming(false);
            }}
          >
            전체 불참
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function LogoutButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setConfirming(true)}
      >
        <LogOut className="h-5 w-5" /> 로그아웃
      </Button>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="로그아웃할까요?">
        <p className="text-sm text-muted-foreground">
          보기 모드로 전환되고 홈으로 이동해요. 최근 약속 목록에는 그대로 남아 있어요.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
            취소
          </Button>
          <Button className="flex-1" onClick={onConfirm}>
            로그아웃
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function ChangePinButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setOldPin('');
    setNewPin('');
  }

  return (
    <>
      <Button variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}>
        <KeyRound className="h-5 w-5" /> 내 PIN 변경
      </Button>
      <Dialog open={open} onClose={close} title="내 PIN 변경">
        <div className="space-y-4">
          <div>
            <Label>현재 PIN</Label>
            <PinInput value={oldPin} onChange={setOldPin} autoFocus />
          </div>
          <div>
            <Label>새 PIN</Label>
            <PinInput value={newPin} onChange={setNewPin} />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={close}>
            취소
          </Button>
          <Button
            className="flex-1"
            disabled={busy || oldPin.length !== 4 || newPin.length !== 4}
            onClick={async () => {
              setBusy(true);
              try {
                await changePin(token, oldPin, newPin);
                close();
                toast.success('PIN을 변경했어요.');
              } catch (e) {
                toast.error(friendlyError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            변경
          </Button>
        </div>
      </Dialog>
    </>
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
