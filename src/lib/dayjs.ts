import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import 'dayjs/locale/ko';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isoWeek);
dayjs.locale('ko');

export const KST = 'Asia/Seoul';

/** Current moment in KST. Never use `new Date()` directly elsewhere. */
export const nowKST = () => dayjs().tz(KST);

/** Parse a calendar date string (YYYY-MM-DD) as a KST day. */
export const kstDate = (date: string) => dayjs.tz(date, KST);

/** Today's calendar date in KST as YYYY-MM-DD. */
export const todayStr = () => nowKST().format('YYYY-MM-DD');

export { dayjs };
