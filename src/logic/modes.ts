/** Night mode, the Tomorrow peek, and burn-in shift. Pure functions of the local hour. */
import type { DayKey, DisplaySettings } from '../../shared/payload';
import { addDays, type LocalTime } from './time';

/** Night window from nightStartHour to nightEndHour, wrapping past midnight (22 → 6). */
export function isNight(hour: number, d: Pick<DisplaySettings, 'nightStartHour' | 'nightEndHour'>): boolean {
  const s = d.nightStartHour;
  const e = d.nightEndHour;
  if (s === e) return false;
  if (s < e) return hour >= s && hour < e;
  return hour >= s || hour < e;
}

/** From tomorrowPeekHour until midnight, Tomorrow gets the room. */
export function isPeek(hour: number, d: Pick<DisplaySettings, 'tomorrowPeekHour'>): boolean {
  return d.tomorrowPeekHour > 0 && hour >= d.tomorrowPeekHour;
}

/** The day night mode looks ahead to: tomorrow late in the evening, the same day after midnight. */
export function nightLookahead(lt: LocalTime): { day: DayKey; label: string } {
  if (lt.hour >= 12) return { day: addDays(lt.dayKey, 1), label: 'Tomorrow' };
  return { day: lt.dayKey, label: 'Today' };
}

const SHIFTS: [number, number][] = [[0, 0], [4, 3], [-3, 4], [3, -4], [-4, -3], [2, 5], [-5, 1], [5, -2]];

/** A few px of drift every hour so nothing sits on the same pixels all day. */
export function burnInShift(now: number, scale = 1): { x: number; y: number } {
  const s = SHIFTS[Math.floor(now / 3600000) % SHIFTS.length];
  return { x: s[0] * scale, y: s[1] * scale };
}
