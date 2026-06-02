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

/** "18:00:00" -> "오후 6시", "18:30:00" -> "오후 6시 30분" */
export function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 || h === 24 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${m}분`;
}

/**
 * Format a candidate's time. With an end: "오후 3시 30분 ~ 오후 4시 30분".
 * Start only (no agreed end): just "오후 4시".
 */
export function fmtRange(start: string, end?: string | null): string {
  return end ? `${fmtTime(start)} ~ ${fmtTime(end)}` : fmtTime(start);
}
