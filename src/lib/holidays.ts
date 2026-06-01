import Holidays from 'date-holidays';
import { dayjs } from './dayjs';

const KST = 'Asia/Seoul';

function buildHolidaySet(): Set<string> {
  const hd = new Holidays('KR');
  const set = new Set<string>();
  const baseYear = new Date().getFullYear();

  for (let y = baseYear - 1; y <= baseYear + 3; y++) {
    for (const h of hd.getHolidays(y)) {
      if (h.type !== 'public') continue;
      // start/end are Date objects (UTC). Convert to KST and enumerate each day.
      let cur = dayjs(h.start).tz(KST).startOf('day');
      const last = dayjs(h.end).tz(KST).startOf('day');
      while (cur.isBefore(last)) {
        set.add(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }
    }
  }
  return set;
}

const HOLIDAYS = buildHolidaySet();

export function isHoliday(dateStr: string): boolean {
  return HOLIDAYS.has(dateStr);
}
