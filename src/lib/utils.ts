import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Participant } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Canonical, stable ordering for participants wherever supporters/colors are
 * shown (calendar dots, promising options, vote lists). Sorted by join time so
 * the same person always appears in the same position across the whole app.
 */
export function sortSupporters(list: Participant[]): Participant[] {
  return [...list].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

function timeParts(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 || h === 24 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { period, clock: `${h12}:${String(m).padStart(2, '0')}` };
}

/** "18:00:00" -> "오후 6:00" */
export function fmtTime(t: string): string {
  const { period, clock } = timeParts(t);
  return `${period} ${clock}`;
}

/**
 * Compact range. Same half-day collapses the period: "오후 6:00 ~ 8:30".
 * Across noon it stays explicit: "오전 11:00 ~ 오후 1:00". Start only: "오후 6:00".
 */
export function fmtRange(start: string, end?: string | null): string {
  if (!end) return fmtTime(start);
  const s = timeParts(start);
  const e = timeParts(end);
  return s.period === e.period
    ? `${s.period} ${s.clock} ~ ${e.clock}`
    : `${s.period} ${s.clock} ~ ${e.period} ${e.clock}`;
}
