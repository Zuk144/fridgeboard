/** Past / current / next for today's timeline, the Next Up pick, and countdown words. Pure. */
import type { BoardEvent } from '../../shared/payload';

export type EventState = 'past' | 'now' | 'future';

const endOf = (e: BoardEvent) => (e.end != null ? e.end : (e.start || 0) + 3600000);

export function eventState(e: BoardEvent, now: number): EventState {
  if (e.allDay || e.start == null) return 'future';
  if (endOf(e) <= now) return 'past';
  if (e.start <= now) return 'now';
  return 'future';
}

/** The next timed event to start (today's list only), or null when nothing is left. */
export function pickNextUp(timed: BoardEvent[], now: number): BoardEvent | null {
  let best: BoardEvent | null = null;
  for (const e of timed) {
    if (e.allDay || e.start == null || e.start <= now) continue;
    if (!best || e.start < (best.start as number)) best = e;
  }
  return best;
}

/** "in 50 min", "in 4h 40m", "in 2h", "now". Rounds up so 3:40:00 → 4:30 reads "in 50 min". */
export function countdownText(msUntil: number): string {
  const mins = Math.ceil(msUntil / 60000 - 1e-9);
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

export type RowState = 'past' | 'now' | 'next' | 'later';

export type TimelineRow =
  | { kind: 'event'; e: BoardEvent; state: RowState; highlight: boolean }
  | { kind: 'done'; count: number }
  | { kind: 'more'; count: number };

/**
 * Rows for a day's timeline that fit in `maxRows`. Past events get crossed out; the current event
 * (or, if none, the next one) gets the highlighter. When it doesn't fit, earlier finished events
 * fold into one "done" row first, then the tail folds into "+N more".
 */
export function planTimeline(timed: BoardEvent[], now: number, maxRows: number): TimelineRow[] {
  const max = Math.max(1, Math.floor(maxRows));
  let nextMarked = false;
  const anyNow = timed.some((e) => eventState(e, now) === 'now');
  const rows = timed.map((e) => {
    const s = eventState(e, now);
    let state: RowState = s === 'future' ? 'later' : s;
    if (s === 'future' && !nextMarked) {
      state = 'next';
      nextMarked = true;
    }
    return { kind: 'event' as const, e, state, highlight: state === 'now' || (state === 'next' && !anyNow) };
  });
  if (rows.length <= max) return rows;

  const past = rows.filter((r) => r.state === 'past');
  const rest = rows.filter((r) => r.state !== 'past');
  // Keep the most recent finished events that still fit, behind one "N done earlier" row.
  const keepPast = max - 1 - rest.length;
  if (keepPast >= 0) {
    const shown = past.slice(past.length - keepPast);
    return ([{ kind: 'done', count: past.length - shown.length }] as TimelineRow[]).concat(shown, rest);
  }
  let head: TimelineRow[] = past.length ? [{ kind: 'done', count: past.length }] : [];
  let room = max - head.length - 1;
  if (room < 1) {
    head = [];
    room = max - 1;
  }
  if (room < 1) return [{ kind: 'more', count: rest.length }];
  return head.concat(rest.slice(0, room), [{ kind: 'more', count: rest.length - room }]);
}
