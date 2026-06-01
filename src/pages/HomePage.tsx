import { useNavigate } from 'react-router-dom';
import { CalendarHeart, Users, Vote, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const nav = useNavigate();
  return (
    <div className="flex flex-1 flex-col px-6 pb-safe pt-safe">
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="space-y-3 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-soft">
            <CalendarHeart className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">PickTime</h1>
          <p className="text-balance text-muted-foreground">
            친구들과 약속 시간, 가장 빠르게 맞추는 방법.
            <br />
            링크 열고 바로 모두의 가능한 시간을 확인하세요.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { icon: Users, text: '로그인 없이 바로 캘린더 확인' },
            { icon: Vote, text: '날짜·시간 후보에 가볍게 투표' },
            { icon: Sparkles, text: '가장 유력한 시간 한눈에' },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3.5"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 pb-8">
        <Button size="lg" className="w-full" onClick={() => nav('/create')}>
          새 약속 방 만들기
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          방을 만들고 링크를 친구들에게 공유하세요.
        </p>
      </div>
    </div>
  );
}
