/** Which events belong to which day, and the rolling week. Pure. */
import type { BoardEvent, DayKey } from '../../shared/payload';
import { addDays } from './time';

export interface DayBucket {
  day: DayKey;
  /** All-day items covering this day (holidays first). */
  allDay: BoardEvent[];
  /** Timed items that start this day, by start time. */
  timed: BoardEvent[];
}

/** All-day events cover [day, endDay) like iCal; timed events belong to the day they start. */
export function isOnDay(e: BoardEvent, key: DayKey): boolean {
  if (e.allDay) return e.day <= key && (key < e.endDay || key === e.day);
  return e.day === key;
}

const kindRank = (e: BoardEvent) => (e.kind === 'holidays' ? 0 : 1);

export function bucketDay(events: BoardEvent[], key: DayKey): DayBucket {
  const allDay: BoardEvent[] = [];
  const timed: BoardEvent[] = [];
  for (const e of events) {
    if (!isOnDay(e, key)) continue;
    (e.allDay ? allDay : timed).push(e);
  }
  allDay.sort((a, b) => kindRank(a) - kindRank(b) || (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  timed.sort((a, b) => (a.start || 0) - (b.start || 0));
  return { day: key, allDay, timed };
}

/** Seven days starting today (a rolling week, not Sunday-Saturday). */
export function rollingWeek(events: BoardEvent[], today: DayKey, n = 7): DayBucket[] {
  const out: DayBucket[] = [];
  for (let i = 0; i < n; i++) out.push(bucketDay(events, addDays(today, i)));
  return out;
}

/** The first thing on the calendar after today (for the "coming up" card on an empty day). */
export function firstAfter(events: BoardEvent[], today: DayKey): BoardEvent | null {
  let best: BoardEvent | null = null;
  for (const e of events) {
    if (e.day <= today) continue;
    if (!best || e.day < best.day || (e.day === best.day && (e.allDay ? -1 : e.start || 0) < (best.allDay ? -1 : best.start || 0))) {
      best = e;
    }
  }
  return best;
}
