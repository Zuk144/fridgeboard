/** "updated 6 min ago", the offline badge, and the stale banner. Pure. */
import { type Clock, DOW_SHORT, shortDate, timeOfDay, daysBetween } from './time';

export function agoText(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}

/** "7:40 am" today, "Sat 7:40 pm" this week, "Nov 3" further back. */
export function whenText(ms: number, now: number, clock: Clock): string {
  const then = clock(ms);
  const today = clock(now).dayKey;
  const days = daysBetween(then.dayKey, today);
  if (days === 0) return timeOfDay(ms, clock);
  if (days > 0 && days < 7) return `${DOW_SHORT[then.dow]} ${timeOfDay(ms, clock)}`;
  return shortDate(then.dayKey);
}

export interface Freshness {
  /** "updated 6 min ago" */
  updated: string;
  stale: boolean;
  offline: boolean;
  /** "Offline · last updated 7:40 am" when the last fetch failed. */
  badge: string;
  /** Amber banner text when the board is older than staleAfterMinutes. */
  banner: string;
}

export function freshness(generatedAt: number, now: number, offline: boolean, staleAfterMinutes: number, clock: Clock): Freshness {
  const age = now - generatedAt;
  const stale = age > staleAfterMinutes * 60000;
  const when = whenText(generatedAt, now, clock);
  return {
    updated: `updated ${agoText(age)}`,
    stale,
    offline,
    badge: offline ? `Offline · last updated ${when}` : '',
    banner: stale
      ? `Heads up: this is from ${when} (${agoText(age)}). ${offline ? "The fridge can't reach the calendar." : 'Waiting for fresh data.'}`
      : '',
  };
}
