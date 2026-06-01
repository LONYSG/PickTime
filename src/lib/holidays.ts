import Holidays from 'date-holidays';
import { dayjs } from './dayjs';

const KST = 'Asia/Seoul';

function buildHolidaySet(): Set<string> {
  const hd = new Holidays('KR');
  const set = new Set<string>();
  const baseYear = new Date().getFullYear();

  // date → count of holidays landing on that date (to detect overlaps)
  const counts = new Map<string, number>();

  for (let y = baseYear - 1; y <= baseYear + 3; y++) {
    for (const h of hd.getHolidays(y)) {
      if (h.type !== 'public') continue;
      let cur = dayjs(h.start).tz(KST).startOf('day');
      const last = dayjs(h.end).tz(KST).startOf('day');
      while (cur.isBefore(last)) {
        const ds = cur.format('YYYY-MM-DD');
        set.add(ds);
        counts.set(ds, (counts.get(ds) ?? 0) + 1);
        cur = cur.add(1, 'day');
      }
    }
  }

  // 대체공휴일: 공휴일이 일요일이거나 다른 공휴일과 겹칠 때 → 다음 평일(월~금)
  const sorted = Array.from(counts.keys()).sort();
  for (const ds of sorted) {
    const d = dayjs(ds);
    const isSunday = d.day() === 0;
    const overlap = (counts.get(ds) ?? 1) - 1; // 겹친 수 (0이면 겹침 없음)
    const subsNeeded = (isSunday ? 1 : 0) + overlap;
    if (subsNeeded === 0) continue;

    let next = d.add(1, 'day');
    let found = 0;
    while (found < subsNeeded) {
      const ns = next.format('YYYY-MM-DD');
      // 대체공휴일은 평일(월~금)이어야 하며 이미 공휴일/대체공휴일이 아닌 날
      if (!set.has(ns) && next.day() !== 0 && next.day() !== 6) {
        set.add(ns);
        found++;
      }
      next = next.add(1, 'day');
    }
  }

  return set;
}

const HOLIDAYS = buildHolidaySet();

export function isHoliday(dateStr: string): boolean {
  return HOLIDAYS.has(dateStr);
}
