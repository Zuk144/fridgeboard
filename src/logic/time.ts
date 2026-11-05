/**
 * Local time in the board's time zone. Everything on screen is computed from an explicit `now`
 * (epoch ms) passed down from the app, never from Date.now() inside rendering.
 */
import type { DayKey } from '../../shared/payload';

export interface LocalTime {
  dayKey: DayKey;
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday */
  dow: number;
}

/** Turns epoch ms into wall-clock fields in one fixed time zone. */
export type Clock = (ms: number) => LocalTime;

export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n: number) => (n < 10 ? '0' : '') + n;

export function keyOf(y: number, m: number, d: number): DayKey {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function fromUtcFields(ms: number): LocalTime {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return { dayKey: keyOf(year, month, day), year, month, day, hour: d.getUTCHours(), minute: d.getUTCMinutes(), dow: d.getUTCDay() };
}

/** Wall clock with only a fixed UTC offset (minutes, EST is -300). The fallback when Intl can't do zones. */
export function offsetClock(offsetMin: number): Clock {
  return (ms) => fromUtcFields(ms + offsetMin * 60000);
}

/**
 * Wall clock for an IANA zone through Intl, falling back to the board's offset if this browser's
 * Intl can't handle the zone. The probe showed the fridge passes both 2026 DST checks.
 */
export function makeClock(tz: string, fallbackOffsetMin: number): Clock {
  const fallback = offsetClock(fallbackOffsetMin);
  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
    if (typeof fmt.formatToParts !== 'function') fmt = null;
  } catch {
    fmt = null;
  }
  if (!fmt) return fallback;
  const f = fmt;
  return (ms) => {
    try {
      const p: Record<string, number> = {};
      for (const part of f.formatToParts(new Date(ms))) {
        if (part.type !== 'literal') p[part.type] = Number(part.value);
      }
      if (!p.year || !p.month || !p.day || !isFinite(p.hour) || !isFinite(p.minute)) return fallback(ms);
      const hour = p.hour % 24;
      const dow = new Date(Date.UTC(p.year, p.month - 1, p.day, 12)).getUTCDay();
      return { dayKey: keyOf(p.year, p.month, p.day), year: p.year, month: p.month, day: p.day, hour, minute: p.minute, dow };
    } catch {
      return fallback(ms);
    }
  };
}

/** Epoch ms for a wall-clock time in the clock's zone (used for the dev ?now= override). */
export function wallToEpoch(y: number, m: number, d: number, hh: number, mm: number, clock: Clock): number {
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let guess = want;
  for (let i = 0; i < 3; i++) {
    const lt = clock(guess);
    const seen = Date.UTC(lt.year, lt.month - 1, lt.day, lt.hour, lt.minute);
    guess += want - seen;
  }
  return guess;
}

function keyToUtcNoon(key: DayKey): number {
  const p = key.split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = new Date(keyToUtcNoon(key) + n * 86400000);
  return keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from a to b (b later → positive). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((keyToUtcNoon(b) - keyToUtcNoon(a)) / 86400000);
}

export function dowOf(key: DayKey): number {
  return new Date(keyToUtcNoon(key)).getUTCDay();
}

export function dayNum(key: DayKey): number {
  return Number(key.split('-')[2]);
}

/** "Sunday, November 15" */
export function longDate(key: DayKey): string {
  const p = key.split('-');
  return `${DOW_LONG[dowOf(key)]}, ${MONTH_LONG[Number(p[1]) - 1]} ${Number(p[2])}`;
}

/** "Nov 15" */
export function shortDate(key: DayKey): string {
  const p = key.split('-');
  return `${MONTH_SHORT[Number(p[1]) - 1]} ${Number(p[2])}`;
}

/** Clock face: { time: "3:40", ampm: "pm" }. */
export function clockFace(lt: LocalTime): { time: string; ampm: string } {
  const h12 = lt.hour % 12 === 0 ? 12 : lt.hour % 12;
  return { time: `${h12}:${pad2(lt.minute)}`, ampm: lt.hour < 12 ? 'am' : 'pm' };
}

/** "7:40 am" for an instant. */
export function timeOfDay(ms: number, clock: Clock): string {
  const f = clockFace(clock(ms));
  return `${f.time} ${f.ampm}`;
}

/** "today", "tomorrow", "Wednesday", or "Nov 30" for a day relative to today. */
export function relativeDay(today: DayKey, key: DayKey): string {
  const n = daysBetween(today, key);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1 && n < 7) return DOW_LONG[dowOf(key)];
  return shortDate(key);
}

/** Hour (0-23) of an event's local "4:30" + "pm" fields. */
export function hour24(time: string | undefined, ampm: string | undefined): number {
  const h = parseInt(String(time || '0'), 10) % 12;
  return ampm === 'pm' ? h + 12 : h;
}
