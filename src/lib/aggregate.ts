import type {
  CandidateVote,
  DateAvailability,
  TimeCandidate,
} from './types';

// Vote aggregation — the heart of PickTime's "glance" UX.
//
// Rule: a participant who marked a date "Available all day" counts as
// supporting EVERY time candidate on that date. Effective supporters of a
// candidate are therefore the UNION (deduped by participant) of:
//   - participants who explicitly voted for it, and
//   - participants who marked that candidate's date as all-day.

export interface CandidateTally {
  candidate: TimeCandidate;
  /** Deduped supporter participant ids (explicit ∪ all-day). */
  supporterIds: string[];
  /** Participant ids who explicitly voted (subset of supporterIds). */
  explicitVoterIds: string[];
  total: number;
  /** Participant ids who marked this date as 불참 (unavailable). */
  unavailableIds: string[];
  unavailableCount: number;
}

export function tallyForDate(
  candidates: TimeCandidate[],
  votes: CandidateVote[],
  availability: DateAvailability[],
  date: string,
): CandidateTally[] {
  const allDayIds = availability
    .filter((a) => a.date === date && a.status === 'all_day')
    .map((a) => a.participant_id);
  const unavailableIds = availability
    .filter((a) => a.date === date && a.status === 'unavailable')
    .map((a) => a.participant_id);

  return candidates
    .filter((c) => c.date === date)
    .map((candidate) => {
      const explicitVoterIds = votes
        .filter((v) => v.candidate_id === candidate.id)
        .map((v) => v.participant_id);
      const supporterIds = Array.from(new Set([...explicitVoterIds, ...allDayIds]));
      return {
        candidate,
        supporterIds,
        explicitVoterIds,
        total: supporterIds.length,
        unavailableIds,
        unavailableCount: unavailableIds.length,
      };
    });
}

/** Per-date aggregate for the calendar heatmap. */
export interface DateHeat {
  date: string;
  /** Distinct participants engaged on this date (voted or all-day). */
  supporterIds: string[];
  candidateCount: number;
  /** Highest single-candidate tally on the date — drives "leading" emphasis. */
  topTotal: number;
}

export function heatByDate(
  candidates: TimeCandidate[],
  votes: CandidateVote[],
  availability: DateAvailability[],
): Map<string, DateHeat> {
  const map = new Map<string, DateHeat>();
  const dates = new Set<string>([
    ...candidates.map((c) => c.date),
    ...availability.map((a) => a.date),
  ]);

  for (const date of dates) {
    const tallies = tallyForDate(candidates, votes, availability, date);
    const allDayIds = availability
      .filter((a) => a.date === date && a.status === 'all_day')
      .map((a) => a.participant_id);
    const engaged = new Set<string>(allDayIds);
    for (const t of tallies) t.explicitVoterIds.forEach((id) => engaged.add(id));
    map.set(date, {
      date,
      supporterIds: Array.from(engaged),
      candidateCount: tallies.length,
      topTotal: tallies.reduce((m, t) => Math.max(m, t.total), 0),
    });
  }
  return map;
}

/** Most-promising ranking: all candidates sorted by total desc. */
export function rankCandidates(
  candidates: TimeCandidate[],
  votes: CandidateVote[],
  availability: DateAvailability[],
): CandidateTally[] {
  const byDate = new Map<string, CandidateTally[]>();
  for (const c of candidates) {
    if (!byDate.has(c.date)) {
      byDate.set(c.date, tallyForDate(candidates, votes, availability, c.date));
    }
  }
  return Array.from(byDate.values())
    .flat()
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.unavailableCount - b.unavailableCount ||
        a.candidate.date.localeCompare(b.candidate.date) ||
        a.candidate.start_time.localeCompare(b.candidate.start_time),
    );
}

// A promising option is either a real time candidate or, for a date that only
// has "available all day" marks and no candidates, a synthetic "all-day" entry.
export interface PromisingOption {
  kind: 'candidate' | 'allday';
  id: string; // candidate id, or `allday-<date>`
  date: string;
  start_time?: string;
  end_time?: string | null;
  supporterIds: string[];
  total: number;
  unavailableIds: string[];
  unavailableCount: number;
}

/**
 * Ranking shown in "Most Promising Options". Includes time candidates AND
 * dates where people are only marked all-day (no candidate yet). When a date
 * has candidates, the all-day marks are already folded into each candidate's
 * total, so we don't add a separate all-day row for it.
 */
export function rankPromising(
  candidates: TimeCandidate[],
  votes: CandidateVote[],
  availability: DateAvailability[],
): PromisingOption[] {
  const dates = new Set<string>([
    ...candidates.map((c) => c.date),
    ...availability.filter((a) => a.is_all_day).map((a) => a.date),
  ]);

  const out: PromisingOption[] = [];
  for (const date of dates) {
    const tallies = tallyForDate(candidates, votes, availability, date);
    const unavailableIds = availability
      .filter((a) => a.date === date && a.status === 'unavailable')
      .map((a) => a.participant_id);
    if (tallies.length > 0) {
      for (const t of tallies) {
        out.push({
          kind: 'candidate',
          id: t.candidate.id,
          date,
          start_time: t.candidate.start_time,
          end_time: t.candidate.end_time,
          supporterIds: t.supporterIds,
          total: t.total,
          unavailableIds: t.unavailableIds,
          unavailableCount: t.unavailableCount,
        });
      }
    } else {
      const allDayIds = availability
        .filter((a) => a.date === date && a.status === 'all_day')
        .map((a) => a.participant_id);
      if (allDayIds.length > 0) {
        out.push({
          kind: 'allday',
          id: `allday-${date}`,
          date,
          supporterIds: allDayIds,
          total: allDayIds.length,
          unavailableIds,
          unavailableCount: unavailableIds.length,
        });
      }
    }
  }
  return out.sort(
    (a, b) =>
      b.total - a.total ||
      a.unavailableCount - b.unavailableCount ||
      a.date.localeCompare(b.date) ||
      (a.start_time ?? '').localeCompare(b.start_time ?? ''),
  );
}
