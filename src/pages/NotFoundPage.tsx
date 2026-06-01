import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const nav = useNavigate();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">🤔</p>
      <h1 className="text-xl font-bold">페이지를 찾을 수 없어요</h1>
      <p className="text-sm text-muted-foreground">링크가 만료되었거나 잘못된 주소예요.</p>
      <Button variant="secondary" onClick={() => nav('/')}>
        홈으로
      </Button>
    </div>
  );
}
