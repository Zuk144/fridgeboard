/** Game-day state for sports calendars: countdown before kickoff, "Game on" for 3 hours. Pure. */
import type { BoardEvent, DayKey } from '../../shared/payload';
import { hour24 } from './time';

export const GAME_WINDOW_MS = 3 * 3600000;

export type GameState = 'before' | 'on' | 'after';

export function gameState(e: BoardEvent, now: number): GameState {
  const start = e.start || 0;
  const end = Math.max(start + GAME_WINDOW_MS, e.end || 0);
  if (now < start) return 'before';
  if (now < end) return 'on';
  return 'after';
}

/** Today's game to put on the tape: one that's on beats the next one up; finished games drop off. */
export function pickGame(events: BoardEvent[], today: DayKey, now: number): { e: BoardEvent; state: 'before' | 'on' } | null {
  let upcoming: BoardEvent | null = null;
  for (const e of events) {
    if (e.kind !== 'sports' || e.allDay || e.day !== today || e.start == null) continue;
    const s = gameState(e, now);
    if (s === 'on') return { e, state: 'on' };
    if (s === 'before' && (!upcoming || e.start < (upcoming.start as number))) upcoming = e;
  }
  return upcoming ? { e: upcoming, state: 'before' } : null;
}

/** "8:20 tonight" for evening kickoffs, otherwise "4:25 pm". */
export function kickoffText(e: BoardEvent): string {
  if (hour24(e.time, e.ampm) >= 18) return `${e.time} tonight`;
  return `${e.time} ${e.ampm}`;
}
