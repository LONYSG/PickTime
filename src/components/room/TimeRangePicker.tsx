import { useRef, useState } from 'react';

// Lightweight take on the Google-Calendar-style drag-to-create gesture.
// A vertical 30-min slot track: press and drag to paint a time band. A manual
// start/end <select> is always available as a fallback. Kept deliberately
// simple — no momentum, no fine gestures.

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

  // Derive selected slot band from value (in minutes) for the overlay.
  const selStartSlot = value ? (toMin(value.start) - START_HOUR * 60) / 30 : null;
  const selEndSlot = value ? (toMin(value.end) - START_HOUR * 60) / 30 : null;

  const slotFromY = (clientY: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(0, Math.min(SLOTS - 1, Math.floor(y / SLOT_PX)));
  };

  const commit = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b) + 1; // inclusive end slot
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
      <div
        ref={trackRef}
        className="relative select-none overflow-hidden rounded-2xl border border-border bg-card"
        style={{ height: SLOTS * SLOT_PX, touchAction: 'none' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const s = slotFromY(e.clientY);
          setDrag({ anchor: s, current: s });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          setDrag((d) => (d ? { ...d, current: slotFromY(e.clientY) } : d));
        }}
        onPointerUp={() => {
          if (drag) commit(drag.anchor, drag.current);
          setDrag(null);
        }}
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
      </div>

      <p className="text-center text-xs text-muted-foreground">
        위 영역을 드래그하거나 아래에서 직접 선택하세요
      </p>

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
