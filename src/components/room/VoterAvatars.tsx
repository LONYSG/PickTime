import { useState } from 'react';
import { Sun, Check } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { sortSupporters } from '@/lib/utils';
import type { Participant } from '@/lib/types';

/**
 * Compact supporter avatar cluster. Tap to open a list showing each voter's
 * full nickname, with a tag for whether they voted directly or via "all day".
 */
export function VoterAvatars({
  supporters,
  explicitIds,
  title,
}: {
  supporters: Participant[];
  explicitIds: string[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ordered = sortSupporters(supporters);

  if (ordered.length === 0) {
    return <span className="text-xs text-muted-foreground">아직 표가 없어요</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex flex-wrap items-center gap-1 rounded-lg active:opacity-70"
        aria-label="투표한 사람 보기"
      >
        {ordered.slice(0, 8).map((p) => (
          <Avatar key={p.id} nickname={p.nickname} color={p.color_hex} size="sm" />
        ))}
        {ordered.length > 8 && (
          <span className="text-[10px] font-medium text-muted-foreground">
            +{ordered.length - 8}
          </span>
        )}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title ?? `투표한 사람 ${ordered.length}명`}
      >
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {ordered.map((p) => {
            const allDay = !explicitIds.includes(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5">
                <Avatar nickname={p.nickname} color={p.color_hex} size="md" />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.nickname}</span>
                {allDay ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600">
                    <Sun className="h-3.5 w-3.5" /> 하루종일
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                    <Check className="h-3.5 w-3.5" /> 투표
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Dialog>
    </>
  );
}
