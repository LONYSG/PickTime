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

/** "18:00:00" -> "18:00" */
export function fmtTime(t: string): string {
  return t.slice(0, 5);
}

/** Format a candidate's time range for display. */
export function fmtRange(start: string, end: string): string {
  return `${fmtTime(start)}–${fmtTime(end)}`;
}
