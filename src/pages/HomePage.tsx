import { useNavigate } from 'react-router-dom';
import { CalendarHeart, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useSessionStore } from '@/store/session';

export default function HomePage() {
  const nav = useNavigate();
  const sessions = useSessionStore((s) => s.sessions);
  const recent = Object.values(sessions)
    .sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? ''))
    .slice(0, 10);

  return (
    <div className="flex flex-1 flex-col px-4 pb-safe pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <CalendarHeart className="h-5 w-5" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">PickTime</span>
        </div>
        <Button onClick={() => nav('/create')} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> 새 약속
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto py-2">
        {recent.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-muted-foreground">최근 약속</h2>
            <div className="space-y-2">
              {recent.map((s) => (
                <button
                  key={s.roomId}
                  onClick={() => nav(`/room/${s.roomId}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-soft active:scale-[0.99] transition"
                >
                  <Avatar nickname={s.nickname} color={s.color} size="md" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">
                      {s.roomTitle ?? '약속방'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.nickname} · {s.role === 'host' ? '방장' : s.role === 'admin' ? '관리자' : '참여자'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-muted text-muted-foreground">
              <CalendarHeart className="h-8 w-8" />
            </div>
            <div>
              <p className="font-bold">아직 참여한 약속이 없어요</p>
              <p className="mt-1 text-sm text-muted-foreground">
                새 약속을 만들거나 친구에게 링크를 받아보세요.
              </p>
            </div>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="pb-8 pt-4">
          <Button size="lg" className="w-full" onClick={() => nav('/create')}>
            <Plus className="h-5 w-5" /> 새 약속 만들기
          </Button>
        </div>
      )}
    </div>
  );
}
