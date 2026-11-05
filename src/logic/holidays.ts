/** Holiday chips for a day and the "11 days to Thanksgiving" countdown tag. Pure. */
import type { BoardEvent, DayKey } from '../../shared/payload';
import { daysBetween } from './time';

/** Holidays worth counting down to, with the short name the tag uses. */
const MAJOR: [RegExp, string][] = [
  [/thanksgiving/i, 'Thanksgiving'],
  [/^christmas( day)?$/i, 'Christmas'],
  [/^new year'?s day$/i, "New Year's"],
  [/^halloween$/i, 'Halloween'],
  [/^easter( sunday)?$/i, 'Easter'],
  [/independence day/i, 'the Fourth'],
  [/^mother'?s day$/i, "Mother's Day"],
  [/^father'?s day$/i, "Father's Day"],
];

export function majorName(title: string): string | null {
  const t = (title || '').trim();
  for (const [re, name] of MAJOR) if (re.test(t)) return name;
  return null;
}

export interface HolidayCountdown {
  name: string;
  days: number;
  text: string;
}

/** The next major holiday after today in the board's window (14 days), or null. */
export function holidayCountdown(events: BoardEvent[], today: DayKey): HolidayCountdown | null {
  let best: { e: BoardEvent; name: string } | null = null;
  for (const e of events) {
    if (e.kind !== 'holidays' || e.day <= today) continue;
    const name = majorName(e.title);
    if (name && (!best || e.day < best.e.day)) best = { e, name };
  }
  if (!best) return null;
  const days = daysBetween(today, best.e.day);
  return { name: best.name, days, text: days === 1 ? `${best.name} is tomorrow` : `${days} days to ${best.name}` };
}
