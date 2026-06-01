import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifyRoomPassword } from '@/lib/api';
import { toast } from '@/components/ui/toast';

/** Room password gate — shown before viewing a protected room. */
export function PasswordGate({ roomId, onUnlock }: { roomId: string; onUnlock: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const ok = await verifyRoomPassword(roomId, pw);
      if (ok) {
        sessionStorage.setItem(`pt-pw-${roomId}`, '1');
        onUnlock();
      } else {
        toast.error('비밀번호가 일치하지 않아요.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-muted text-primary">
        <Lock className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-xl font-bold">비밀번호로 보호된 방이에요</h1>
        <p className="mt-1 text-sm text-muted-foreground">입장하려면 비밀번호를 입력하세요.</p>
      </div>
      <Input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="방 비밀번호"
        autoFocus
      />
      <Button className="w-full" disabled={!pw || busy} onClick={submit}>
        입장
      </Button>
    </div>
  );
}
