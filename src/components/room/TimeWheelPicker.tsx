import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// Alarm-clock-style scroll wheels: 오전/오후 · 시(1–12) · 분(00–59, 1-minute).
// Start time required; end time optional ("종료 시간 추가").

const ITEM_H = 40;
const VISIBLE = 5; // odd; middle row is the selection
const PAD = (VISIBLE - 1) / 2;

const pad2 = (n: number) => String(n).padStart(2, '0');

interface Parts {
  period: '오전' | '오후';
  h12: number;
  m: number;
}

function parse(t: string): Parts {
  const [h, m] = t.split(':').map(Number);
  return { period: h < 12 ? '오전' : '오후', h12: h % 12 === 0 ? 12 : h % 12, m };
}
function compose({ period, h12, m }: Parts): string {
  let h = h12 % 12;
  if (period === '오후') h += 12;
  return `${pad2(h)}:${pad2(m)}:00`;
}
function addMinutes(t: string, mins: number): string {
  const [h, m] = t.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}:00`;
}

const PERIODS: { value: Parts['period']; label: string }[] = [
  { value: '오전', label: '오전' },
  { value: '오후', label: '오후' },
];
const HOURS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}시` }));
const MINUTES = Array.from({ length: 60 }, (_, i) => ({ value: i, label: `${pad2(i)}분` }));

function Wheel<T extends string | number>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const idx = Math.max(0, items.findIndex((i) => i.value === value));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [idx]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
      const snap = i * ITEM_H;
      if (Math.abs(el.scrollTop - snap) > 1) el.scrollTo({ top: snap, behavior: 'smooth' });
      if (items[i].value !== value) onChange(items[i].value);
    }, 110);
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="no-scrollbar flex-1 snap-y snap-mandatory overflow-y-scroll"
      style={{ height: ITEM_H * VISIBLE }}
    >
      <div style={{ height: ITEM_H * PAD }} />
      {items.map((it) => (
        <div
          key={String(it.value)}
          className={cn(
            'flex snap-center items-center justify-center text-lg transition-colors',
            it.value === value ? 'font-bold text-foreground' : 'text-muted-foreground/40',
          )}
          style={{ height: ITEM_H }}
        >
          {it.label}
        </div>
      ))}
      <div style={{ height: ITEM_H * PAD }} />
    </div>
  );
}

function WheelGroup({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const p = parse(value);
  return (
    <div className="relative flex">
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-10 -translate-y-1/2 rounded-xl bg-primary/5 ring-1 ring-primary/15" />
      <Wheel items={PERIODS} value={p.period} onChange={(period) => onChange(compose({ ...p, period }))} />
      <Wheel items={HOURS} value={p.h12} onChange={(h12) => onChange(compose({ ...p, h12 }))} />
      <Wheel items={MINUTES} value={p.m} onChange={(m) => onChange(compose({ ...p, m }))} />
    </div>
  );
}

export function TimeWheelPicker({
  value,
  onChange,
}: {
  value: { start: string; end: string | null };
  onChange: (v: { start: string; end: string | null }) => void;
}) {
  const hasEnd = value.end !== null;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-1.5">
        <p className="pt-1 text-center text-xs font-semibold text-muted-foreground">시작</p>
        <WheelGroup value={value.start} onChange={(start) => onChange({ ...value, start })} />
      </div>

      <button
        type="button"
        onClick={() =>
          onChange({ start: value.start, end: hasEnd ? null : addMinutes(value.start, 60) })
        }
        className="flex w-full items-center justify-between rounded-2xl bg-muted/60 px-4 py-2.5"
      >
        <span className="text-sm font-semibold">종료 시간 추가</span>
        <span
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition',
            hasEnd ? 'bg-primary' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
              hasEnd ? 'left-[22px]' : 'left-0.5',
            )}
          />
        </span>
      </button>

      {hasEnd && value.end && (
        <div className="rounded-2xl border border-border bg-card p-1.5">
          <p className="pt-1 text-center text-xs font-semibold text-muted-foreground">종료</p>
          <WheelGroup value={value.end} onChange={(end) => onChange({ ...value, end })} />
        </div>
      )}
    </div>
  );
}
