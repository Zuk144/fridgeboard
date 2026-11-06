/**
 * This Week: a hand-ruled grid of the next 7 days starting today. Tap a day for its full agenda.
 * Trips show as a dashed pencil arrow with a plane across the days away.
 */
import type { Board, BoardEvent } from '../../shared/payload';
import type { Ctx, DashModule } from './types';
import { rollingWeek, type DayBucket } from '../logic/days';
import { eventState } from '../logic/nextup';
import { awayArrowText, awaySpan } from '../logic/away';
import { DOW_SHORT, dayNum, dowOf } from '../logic/time';
import { at, esc } from '../ui/html';
import { inkOf, pill, teamLabel, tint, calOf } from '../ui/events';
import { dayCircle, tripArrow } from '../ui/icons';

const LINE = 31;

/** How many lines an entry takes (titles wrap to two lines at most). */
function linesFor(text: string, perLine: number): number {
  return text.length > perLine ? 2 : 1;
}

/** Planner shorthand for the narrow columns: "6:00" → "6", "4:30" stays. */
export function shortTime(t: string | undefined): string {
  return String(t || '').replace(/:00$/, '');
}

function entryText(board: Board, e: BoardEvent): string {
  if (e.kind === 'sports' && !e.allDay) return `${e.time} ${teamLabel(board, e)}`;
  return e.allDay ? e.title : `${shortTime(e.time)} ${e.title}`;
}

function entry(board: Board, e: BoardEvent, ctx: Ctx): string {
  if (e.kind === 'sports' && !e.allDay) {
    return `<div class="e">${pill(board, e, entryText(board, e))}</div>`;
  }
  const ink = inkOf(e, ctx);
  if (e.allDay) {
    const c = calOf(board, e.cals[0]);
    return `<div class="e e-all" style="color:${ink};background:${tint(c ? c.color : '#5F5E5A', ctx.theme === 'night' ? 0.26 : 0.13)}">${esc(e.title)}</div>`;
  }
  return `<div class="e" style="color:${ink}"><b>${esc(shortTime(e.time))}</b> ${esc(e.title)}</div>`;
}

function column(board: Board, b: DayBucket, i: number, x: number, w: number, h: number, maxLines: number, now: number, ctx: Ctx): string {
  const isToday = i === 0;
  // Today's column shows what's still ahead; the Today panel has the rest.
  const timed = isToday ? b.timed.filter((e) => eventState(e, now) !== 'past') : b.timed;
  const all = b.allDay.concat(timed);
  const perLine = Math.max(6, Math.floor((w - 20) / 9));
  let used = 0;
  let shown = 0;
  let lines = '';
  for (let k = 0; k < all.length; k++) {
    const need = linesFor(entryText(board, all[k]), perLine);
    const left = all.length - k - 1;
    if (used + need > maxLines || (left > 0 && used + need === maxLines)) break;
    lines += entry(board, all[k], ctx);
    used += need;
    shown++;
  }
  if (shown < all.length) lines += `<div class="e pencil">+${all.length - shown} more</div>`;
  return `<div class="wk${isToday ? ' wk-today' : ''}" data-act="day" data-day="${b.day}" style="${at(x, 0, w, h)}">` +
    `<div class="d">${DOW_SHORT[dowOf(b.day)]}</div>` +
    `<div class="num hand">${dayNum(b.day)}${isToday ? dayCircle() : ''}</div>` +
    `<div class="es">${lines}</div></div>`;
}

export const weekModule: DashModule = {
  id: 'week',
  needs: ['calendar', 'week'],
  render(board, now, ctx) {
    const box = ctx.box;
    const week = rollingWeek(board.events, ctx.today);
    const days = week.map((b) => b.day);
    const gridX = 48;
    const gridTop = 92;
    const gridW = box.w - gridX * 2;
    const gridH = box.h - gridTop - 14;
    const colW = gridW / 7;

    let trip = '';
    let tripCols: [number, number] = [-1, -1];
    for (const r of board.away || []) {
      const span = awaySpan(r, days);
      if (!span) continue;
      tripCols = [span.from, span.to];
      const x = span.from * colW + 10;
      const w = (span.to - span.from + 1) * colW - 20;
      trip = `<div class="trip" style="${at(x, gridH - 80, Math.max(w, 120), 80)}">${tripArrow(Math.max(Math.round(w), 120), span.clipStart, span.clipEnd)}<div class="trip-text">${esc(w >= 250 ? awayArrowText(r) : r.label)}</div></div>`;
      break;
    }
    let cols = '';
    let seps = '';
    week.forEach((b, i) => {
      // Columns under the trip arrow leave room for it.
      const reserve = i >= tripCols[0] && i <= tripCols[1] ? 84 : 0;
      const maxLines = Math.max(1, Math.floor((gridH - 108 - reserve) / LINE));
      cols += column(board, b, i, i * colW, colW, gridH, maxLines, now, ctx);
      if (i > 0) seps += `<div class="wsep" style="${at(i * colW, 8, 2, gridH - 16)}"></div>`;
    });
    return `<div class="sec-title hand" style="${at(70, 0)}font-size:72px;line-height:80px">This week</div>` +
      `<div class="grid" style="${at(gridX, gridTop, gridW, gridH)}">${seps}${cols}${trip}</div>`;
  },
};
