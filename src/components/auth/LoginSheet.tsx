import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, UserPlus, LogIn } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { PinInput } from '@/components/PinInput';
import { toast } from '@/components/ui/toast';
import { pickColor } from '@/lib/colors';
import { friendlyError, joinRoom, loginParticipant } from '@/lib/api';
import { useSessionStore } from '@/store/session';
import { nowKST } from '@/lib/dayjs';
import type { Participant, Session } from '@/lib/types';

type Mode = 'choose' | 'new-nick' | 'new-pin' | 'existing';

const BACK: Record<Mode, Mode | null> = {
  choose: null,
  'new-nick': 'choose',
  'new-pin': 'new-nick',
  existing: 'choose',
};

const TITLE: Record<Mode, string> = {
  choose: '참여하기',
  'new-nick': '닉네임 정하기',
  'new-pin': 'PIN 설정',
  existing: '기존 참가자',
};

export function LoginSheet({
  open,
  roomId,
  roomTitle,
  participants,
  onClose,
  onAuthed,
}: {
  open: boolean;
  roomId: string;
  roomTitle?: string;
  participants: Participant[];
  onClose: () => void;
  onAuthed: (s: Session) => void;
}) {
  const [mode, setMode] = useState<Mode>('choose');
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);

  const loginable = participants.filter((p) => p.status !== 'left');
  // Color is auto-assigned (no picking), avoiding colors already in the room.
  const color = useMemo(() => pickColor(participants.map((p) => p.color_hex)), [participants]);
  const existingNames = useMemo(
    () => new Set(loginable.map((p) => p.nickname.trim().toLowerCase())),
    [loginable],
  );

  useEffect(() => {
    if (open) {
      setMode('choose');
      setNickname('');
      setPin('');
    }
  }, [open]);

  const finish = (s: Session) => {
    const enriched = { ...s, roomTitle, joinedAt: s.joinedAt ?? new Date().toISOString() };
    setSession(enriched);
    onAuthed(enriched);
  };

  function toPin() {
    const n = nickname.trim();
    if (!n) return;
    if (existingNames.has(n.toLowerCase())) {
      toast.error('이미 사용 중인 닉네임이에요.');
      return;
    }
    setMode('new-pin');
  }

  async function join() {
    if (pin.length !== 4) return;
    setBusy(true);
    try {
      const res = await joinRoom({ roomId, nickname: nickname.trim(), color, pin });
      finish({
        roomId,
        participantId: res.participant_id,
        token: res.token,
        nickname: nickname.trim(),
        color,
        role: 'participant',
      });
      toast.success('참여 완료!');
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const back = BACK[mode];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-1">
          {back && (
            <button
              onClick={() => setMode(back)}
              className="-ml-2 grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
              aria-label="뒤로"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {TITLE[mode]}
        </span>
      }
    >
      {mode === 'choose' && (
        <div className="space-y-3 pb-4">
          <p className="pb-1 text-sm text-muted-foreground">
            투표하거나 의견을 남기려면 참여가 필요해요.
          </p>
          <button
            onClick={() => setMode('new-nick')}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold">처음이에요</span>
              <span className="block text-sm text-muted-foreground">닉네임만 정하면 끝</span>
            </span>
          </button>
          <button
            onClick={() => setMode('existing')}
            disabled={loginable.length === 0}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left active:scale-[0.99] disabled:opacity-50"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-foreground">
              <LogIn className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold">이미 참여했어요</span>
              <span className="block text-sm text-muted-foreground">나를 선택하고 PIN 입력</span>
            </span>
          </button>
        </div>
      )}

      {mode === 'new-nick' && (
        <div className="space-y-5 pb-4">
          <div>
            <Label>닉네임</Label>
            <Input
              placeholder="닉네임을 입력하세요"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && toPin()}
              maxLength={24}
              autoFocus
            />
          </div>
          <Button className="w-full" size="lg" disabled={!nickname.trim()} onClick={toPin}>
            다음
          </Button>
        </div>
      )}

      {mode === 'new-pin' && (
        <div className="space-y-5 pb-4">
          <div>
            <Label>4자리 PIN 설정</Label>
            <p className="mb-2 text-xs text-muted-foreground">다시 입장할 때 사용해요.</p>
            <PinInput value={pin} onChange={setPin} autoFocus />
          </div>
          <Button className="w-full" size="lg" disabled={pin.length !== 4 || busy} onClick={join}>
            {busy ? '참여 중…' : '완료'}
          </Button>
        </div>
      )}

      {mode === 'existing' && (
        <ExistingParticipant roomId={roomId} participants={loginable} onDone={finish} />
      )}
    </Sheet>
  );
}

function ExistingParticipant({
  roomId,
  participants,
  onDone,
}: {
  roomId: string;
  participants: Participant[];
  onDone: (s: Session) => void;
}) {
  const [selected, setSelected] = useState<Participant | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const locked = lockedUntil ? nowKST().isBefore(lockedUntil) : false;

  async function submit() {
    if (!selected || pin.length !== 4) return;
    setBusy(true);
    try {
      const res = await loginParticipant(selected.id, pin);
      if (res.ok) {
        onDone({
          roomId,
          participantId: selected.id,
          token: res.token,
          nickname: selected.nickname,
          color: selected.color_hex,
          role: selected.role,
        });
        toast.success(`${selected.nickname}님, 환영해요!`);
      } else {
        setPin('');
        if (res.locked_until) {
          setLockedUntil(res.locked_until);
          toast.error('5회 실패로 5분간 잠겼어요.');
        } else {
          toast.error(`PIN이 일치하지 않아요. (${res.attempts ?? 0}/5)`);
        }
      }
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <div className="grid grid-cols-3 gap-3 pb-4">
        {participants.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className="flex flex-col items-center gap-2 rounded-2xl p-3 hover:bg-muted active:scale-95"
          >
            <Avatar nickname={p.nickname} color={p.color_hex} size="lg" />
            <span className="max-w-full truncate text-xs font-medium">{p.nickname}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <button
        onClick={() => {
          setSelected(null);
          setPin('');
          setLockedUntil(null);
        }}
        className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3"
      >
        <Avatar nickname={selected.nickname} color={selected.color_hex} size="md" />
        <span className="font-semibold">{selected.nickname}</span>
        <span className="ml-auto text-xs text-muted-foreground">바꾸기</span>
      </button>
      <div>
        <Label>PIN 입력</Label>
        <PinInput value={pin} onChange={setPin} autoFocus />
      </div>
      {locked && (
        <p className="text-center text-sm text-destructive">
          잠금 상태예요. 잠시 후 다시 시도하거나 방장에게 PIN 초기화를 요청하세요.
        </p>
      )}
      <Button className="w-full" size="lg" disabled={pin.length !== 4 || busy || locked} onClick={submit}>
        {busy ? '확인 중…' : '입장'}
      </Button>
    </div>
  );
}
