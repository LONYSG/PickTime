import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, UserPlus, LogIn } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { ColorPicker } from '@/components/ColorPicker';
import { PinInput } from '@/components/PinInput';
import { toast } from '@/components/ui/toast';
import { suggestColors } from '@/lib/colors';
import { friendlyError, joinRoom, loginParticipant } from '@/lib/api';
import { useSessionStore } from '@/store/session';
import { nowKST } from '@/lib/dayjs';
import type { Participant, Session } from '@/lib/types';

type Mode = 'choose' | 'new' | 'existing';

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
  const setSession = useSessionStore((s) => s.setSession);
  const loginable = participants.filter((p) => p.status !== 'left');

  useEffect(() => {
    if (open) setMode('choose');
  }, [open]);

  const finish = (s: Session) => {
    const enriched = { ...s, roomTitle, joinedAt: s.joinedAt ?? new Date().toISOString() };
    setSession(enriched);
    onAuthed(enriched);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-1">
          {mode !== 'choose' && (
            <button
              onClick={() => setMode('choose')}
              className="-ml-2 grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
              aria-label="뒤로"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {mode === 'choose' ? '참여하기' : mode === 'new' ? '새 참가자' : '기존 참가자'}
        </span>
      }
    >
      {mode === 'choose' && (
        <div className="space-y-3 pb-4">
          <p className="pb-1 text-sm text-muted-foreground">
            투표하거나 의견을 남기려면 참여가 필요해요.
          </p>
          <button
            onClick={() => setMode('new')}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold">처음이에요</span>
              <span className="block text-sm text-muted-foreground">닉네임과 색상을 정해요</span>
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

      {mode === 'new' && (
        <NewParticipant roomId={roomId} participants={participants} onDone={finish} />
      )}
      {mode === 'existing' && (
        <ExistingParticipant roomId={roomId} participants={loginable} onDone={finish} />
      )}
    </Sheet>
  );
}

function NewParticipant({
  roomId,
  participants,
  onDone,
}: {
  roomId: string;
  participants: Participant[];
  onDone: (s: Session) => void;
}) {
  const taken = useMemo(() => participants.map((p) => p.color_hex), [participants]);
  const colors = useMemo(() => suggestColors(taken, 5), [taken]);
  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState<string | null>(colors[0] ?? null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = nickname.trim() && color && pin.length === 4;

  async function submit() {
    if (!valid || !color) return;
    setBusy(true);
    try {
      const res = await joinRoom({ roomId, nickname: nickname.trim(), color, pin });
      onDone({
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

  return (
    <div className="space-y-5 pb-4">
      <div>
        <Label>닉네임</Label>
        <Input
          placeholder="닉네임"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={24}
          autoFocus
        />
      </div>
      <div>
        <Label>색상 고르기 (가입 후 변경 불가)</Label>
        <ColorPicker colors={colors} value={color} onChange={setColor} />
      </div>
      <div>
        <Label>4자리 PIN</Label>
        <PinInput value={pin} onChange={setPin} />
      </div>
      <Button className="w-full" size="lg" disabled={!valid || busy} onClick={submit}>
        {busy ? '참여 중…' : '참여하기'}
      </Button>
    </div>
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
            className="flex flex-col items-center gap-2 rounded-2xl p-3 active:scale-95 hover:bg-muted"
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
      <Button
        className="w-full"
        size="lg"
        disabled={pin.length !== 4 || busy || locked}
        onClick={submit}
      >
        {busy ? '확인 중…' : '입장'}
      </Button>
    </div>
  );
}
