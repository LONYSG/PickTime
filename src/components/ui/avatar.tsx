import { cn } from '@/lib/utils';
import { readableTextOn } from '@/lib/colors';

interface AvatarProps {
  nickname: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  ring?: boolean;
  className?: string;
}

const sizes = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

/** A participant's color avatar — their visual fingerprint across the app. */
export function Avatar({ nickname, color, size = 'md', ring, className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-bold',
        sizes[size],
        ring && 'ring-2 ring-white',
        className,
      )}
      style={{ backgroundColor: color, color: readableTextOn(color) }}
      title={nickname}
    >
      {nickname.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** A small color dot used in dense vote displays. */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn('inline-block h-3 w-3 rounded-full ring-1 ring-black/5', className)}
      style={{ backgroundColor: color }}
    />
  );
}
