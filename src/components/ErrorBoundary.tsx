import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Catches render errors and—critically—lazy-chunk load failures. After a new
 * deploy, an open tab may try to fetch a chunk hash that no longer exists
 * (ChunkLoadError); we reload once automatically to pull the fresh bundle.
 * Any other error shows a friendly recovery screen instead of a white page.
 */
const RELOAD_FLAG = 'pt-chunk-reloaded';

function isChunkError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? '';
  const name = (err as { name?: string })?.name ?? '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk|dynamically imported module|Importing a module script failed/i.test(msg)
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (isChunkError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    }
  }

  render() {
    if (!this.state.failed) {
      sessionStorage.removeItem(RELOAD_FLAG);
      return this.props.children;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-5xl">😵</p>
        <div>
          <p className="font-bold">문제가 발생했어요</p>
          <p className="mt-1 text-sm text-muted-foreground">
            잠시 후 다시 시도해 주세요. 계속되면 새로고침해 주세요.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>새로고침</Button>
      </div>
    );
  }
}
