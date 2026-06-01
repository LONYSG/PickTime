import { Sheet } from '@/components/ui/sheet';
import { dayjs } from '@/lib/dayjs';
import { cn } from '@/lib/utils';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queryClient';
import {
  Pencil,
  MessageCircle,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Bell,
  CalendarRange,
  XCircle,
} from 'lucide-react';
import type { AppNotification, NotificationType } from '@/lib/types';

const META: Record<NotificationType, { icon: typeof Bell; label: string }> = {
  comment: { icon: MessageCircle, label: '새 댓글' },
  candidate_edited: { icon: Pencil, label: '후보 시간 변경' },
  finalized: { icon: CheckCircle2, label: '일정 확정' },
  reopened: { icon: RotateCcw, label: '방 재오픈' },
  role_change: { icon: ShieldCheck, label: '권한 변경' },
  range_changed: { icon: CalendarRange, label: '기간 변경' },
  votes_cancelled: { icon: XCircle, label: '내 투표 취소됨' },
};

export function NotificationCenter({
  open,
  onClose,
  participantId,
  notifications,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  participantId: string;
  notifications: AppNotification[];
  onJump: (date: string) => void;
}) {
  const qc = useQueryClient();

  const refresh = () => qc.invalidateQueries({ queryKey: qk.notifications(participantId) });

  async function handleClick(n: AppNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      refresh();
    }
    if (n.related_date) {
      onClose();
      onJump(n.related_date);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex w-full items-center justify-between pr-2">
          <span>알림</span>
          {notifications.some((n) => !n.is_read) && (
            <button
              onClick={async () => {
                await markAllNotificationsRead(participantId);
                refresh();
              }}
              className="text-sm font-medium text-primary"
            >
              모두 읽음
            </button>
          )}
        </span>
      }
    >
      <div className="space-y-2 pb-4">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Bell className="h-8 w-8" />
            <p className="text-sm">아직 알림이 없어요.</p>
          </div>
        )}
        {notifications.map((n) => {
          const meta = META[n.type] ?? { icon: Bell, label: '알림' };
          const Icon = meta.icon;
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl border p-3 text-left active:scale-[0.99]',
                n.is_read ? 'border-border bg-card' : 'border-primary/30 bg-primary/5',
              )}
            >
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{meta.label}</span>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                {n.detail && (
                  <span className="block truncate text-sm text-muted-foreground">{n.detail}</span>
                )}
                <span className="block text-[11px] text-muted-foreground">
                  {dayjs(n.created_at).format('M/D HH:mm')}
                  {n.related_date && ` · ${dayjs(n.related_date).format('M/D')}로 이동`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
