/** Shared bits for drawing events: ink color, two-calendar dots, sports pills, tints. */
import type { Board, BoardEvent, CalendarInfo } from '../../shared/payload';
import type { BaseCtx } from '../modules/types';
import { esc } from './html';

export function calOf(board: Board, key: string): CalendarInfo | undefined {
  for (const c of board.calendars) if (c.key === key) return c;
  return undefined;
}

/** Ink for an event: its first calendar's readable ink. */
export function inkOf(e: BoardEvent, ctx: BaseCtx): string {
  return ctx.inks[e.cals[0]] || 'var(--ink)';
}

/** Translucent wash of a calendar color, for chips. */
export function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(95,94,90,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Color dots when the same event sits on more than one calendar. */
export function dots(e: BoardEvent, ctx: BaseCtx): string {
  if (e.cals.length < 2) return '';
  return `<span class="dots">${e.cals.map((k) => `<i style="background:${ctx.inks[k] || 'var(--pencil)'}"></i>`).join('')}</span>`;
}

/** Team colors for a sports event: [tape/pill background, text]. Text and colors only, no logos. */
export function teamColors(board: Board, e: BoardEvent): [string, string] {
  const c = calOf(board, e.cals[0]);
  return [c && c.color ? c.color : '#FFB612', c && c.accent ? c.accent : '#101820'];
}

/** Black-and-gold pill, e.g. "on TV" or "8:20 Steelers". */
export function pill(board: Board, e: BoardEvent, text: string, cls = ''): string {
  const [bg, fg] = teamColors(board, e);
  return `<span class="pill ${cls}" style="background:${fg};color:${bg}">${esc(text)}</span>`;
}

/** Calendar label for a sports event ("Steelers"). */
export function teamLabel(board: Board, e: BoardEvent): string {
  const c = calOf(board, e.cals[0]);
  return c ? c.label : 'Game';
}

/** All-day chip with a wash of the calendar's color. */
export function chip(board: Board, e: BoardEvent, ctx: BaseCtx, cls = 'chip'): string {
  const c = calOf(board, e.cals[0]);
  const ink = inkOf(e, ctx);
  return `<span class="${cls}" style="color:${ink};background:${tint(c ? c.color : '#5F5E5A', ctx.theme === 'night' ? 0.28 : 0.14)}">${esc(e.title)}</span>`;
}
