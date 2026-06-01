import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lightweight take on the Google-Calendar-style drag-to-create gesture.
// Drag mode must be explicitly enabled so vertical scroll is never hijacked.

const START_HOUR = 6;
const END_HOUR = 24;
const SLOTS = (END_HOUR - START_HOUR) * 2; // 30-min slots
const SLOT_PX = 16;

const slotToMinutes = (slot: number) => START_HOUR * 60 + slot * 30;
const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toTimeStr = (min: number) => `${fmt(min)}:00`;

export function TimeRangePicker({
  value,
  onChange,
}: {
  value: { start: string; end: string } | null;
  onChange: (v: { start: string; end: string }) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);
  const [dragMode, setDragMode] = useState(false);

  const selStartSlot = value ? (toMin(value.start) - START_HOUR * 60) / 30 : null;
  const selEndSlot = value ? (toMin(value.end) - START_HOUR * 60) / 30 : null;

  const slotFromY = (clientY: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(0, Math.min(SLOTS - 1, Math.floor(y / SLOT_PX)));
  };

  const commit = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b) + 1;
    onChange({ start: toTimeStr(slotToMinutes(lo)), end: toTimeStr(slotToMinutes(hi)) });
  };

  const band =
    drag !== null
      ? { lo: Math.min(drag.anchor, drag.current), hi: Math.max(drag.anchor, drag.current) + 1 }
      : selStartSlot !== null && selEndSlot !== null
        ? { lo: selStartSlot, hi: selEndSlot }
        : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">시간 선택</span>
        <button
          type="button"
          onClick={() => { setDragMode((v) => !v); setDrag(null); }}
          className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition',
            dragMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          <Pencil className="h-3 w-3" />
          {dragMode ? '드래그 완료' : '드래그 선택'}
        </button>
      </div>

      <div
        ref={trackRef}
        className="relative select-none overflow-hidden rounded-2xl border border-border bg-card"
        style={{
          height: SLOTS * SLOT_PX,
          touchAction: dragMode ? 'none' : 'pan-y',
        }}
        onPointerDown={dragMode ? (e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const s = slotFromY(e.clientY);
          setDrag({ anchor: s, current: s });
        } : undefined}
        onPointerMove={dragMode ? (e) => {
          if (!drag) return;
          setDrag((d) => (d ? { ...d, current: slotFromY(e.clientY) } : d));
        } : undefined}
        onPointerUp={dragMode ? () => {
          if (drag) { commit(drag.anchor, drag.current); setDragMode(false); }
          setDrag(null);
        } : undefined}
      >
        {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute left-0 flex w-full items-start"
            style={{ top: i * 2 * SLOT_PX }}
          >
            <span className="w-12 -translate-y-2 pl-2 text-[10px] text-muted-foreground">
              {String(START_HOUR + i).padStart(2, '0')}:00
            </span>
            <span className="mt-px h-px flex-1 bg-border/70" />
          </div>
        ))}

        {band && (
          <div
            className="pointer-events-none absolute left-12 right-2 rounded-lg bg-primary/30 ring-2 ring-primary"
            style={{ top: band.lo * SLOT_PX, height: (band.hi - band.lo) * SLOT_PX }}
          >
            <span className="absolute inset-0 grid place-items-center text-xs font-bold text-primary">
              {fmt(slotToMinutes(band.lo))}–{fmt(slotToMinutes(band.hi))}
            </span>
          </div>
        )}

        {!dragMode && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-xl bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
              드래그 선택 버튼을 누르면 드래그로 선택할 수 있어요
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <TimeSelect
          value={value?.start ?? '18:00:00'}
          onChange={(t) => onChange({ start: t, end: value?.end && value.end > t ? value.end : add30(t) })}
        />
        <span className="text-muted-foreground">–</span>
        <TimeSelect
          value={value?.end ?? '20:00:00'}
          min={value?.start}
          onChange={(t) => onChange({ start: value?.start ?? '18:00:00', end: t })}
        />
      </div>
    </div>
  );
}

function TimeSelect({
  value,
  min,
  onChange,
}: {
  value: string;
  min?: string;
  onChange: (t: string) => void;
}) {
  const options: string[] = [];
  for (let m = 0; m < 24 * 60; m += 30) options.push(toTimeStr(m));
  return (
    <select
      value={value.slice(0, 8)}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 flex-1 rounded-xl border border-input bg-card px-3 text-base"
    >
      {options
        .filter((o) => !min || o > min)
        .map((o) => (
          <option key={o} value={o}>
            {o.slice(0, 5)}
          </option>
        ))}
    </select>
  );
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function add30(t: string) {
  return toTimeStr(Math.min(24 * 60, toMin(t) + 60));
}
