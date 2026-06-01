import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ColorPicker } from '@/components/ColorPicker';
import { PinInput } from '@/components/PinInput';
import { toast } from '@/components/ui/toast';
import { suggestColors } from '@/lib/colors';
import { createRoom, friendlyError } from '@/lib/api';
import { useSessionStore } from '@/store/session';
import { nowKST, todayStr } from '@/lib/dayjs';

export default function CreateRoomPage() {
  const nav = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState(nowKST().format('YYYY-MM-DD'));
  const [end, setEnd] = useState(nowKST().add(13, 'day').format('YYYY-MM-DD'));
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');

  const colors = useMemo(() => suggestColors([], 5), []);
  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState<string | null>(colors[0] ?? null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const valid =
    title.trim() &&
    start &&
    end &&
    end >= start &&
    nickname.trim() &&
    color &&
    pin.length === 4 &&
    (!usePassword || password.length >= 1);

  async function submit() {
    if (!valid || !color) return;
    setBusy(true);
    try {
      const res = await createRoom({
        title: title.trim(),
        dateStart: start,
        dateEnd: end,
        nickname: nickname.trim(),
        color,
        pin,
        password: usePassword ? password : null,
      });
      setSession({
        roomId: res.room_id,
        participantId: res.participant_id,
        token: res.token,
        nickname: nickname.trim(),
        color,
        role: 'host',
        roomTitle: title.trim(),
        joinedAt: new Date().toISOString(),
      });
      toast.success('방이 만들어졌어요!');
      nav(`/room/${res.room_id}`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col pb-safe">
      <header className="flex items-center gap-2 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <button
          onClick={() => nav('/')}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
          aria-label="뒤로"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold">새 약속 방 만들기</h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
        <section className="space-y-4">
          <div>
            <Label>약속 이름</Label>
            <Input
              placeholder="예) 주말 저녁 모임"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>시작일</Label>
              <Input type="date" min={todayStr()} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>종료일</Label>
              <Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
            <span className="text-sm font-medium">비밀번호로 방 보호</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={usePassword}
              onChange={(e) => setUsePassword(e.target.checked)}
            />
          </label>
          {usePassword && (
            <Input
              type="password"
              placeholder="방 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </section>

        <div className="h-px bg-border" />

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground">내 정보 (방장)</h2>
          <div>
            <Label>닉네임</Label>
            <Input
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={24}
            />
          </div>
          <div>
            <Label>내 색상</Label>
            <ColorPicker colors={colors} value={color} onChange={setColor} />
          </div>
          <div>
            <Label>4자리 PIN (다시 입장할 때 사용)</Label>
            <PinInput value={pin} onChange={setPin} />
          </div>
        </section>
      </div>

      <div className="border-t border-border px-6 pb-8 pt-3">
        <Button className="w-full" size="lg" disabled={!valid || busy} onClick={submit}>
          {busy ? '만드는 중…' : '방 만들기'}
        </Button>
      </div>
    </div>
  );
}
