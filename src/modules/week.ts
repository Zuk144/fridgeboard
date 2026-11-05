/**
 * This Week: a hand-ruled grid of the next 7 days starting today. Tap a day for its full agenda.
 * Trips show as a dashed pencil arrow with a plane across the days away.
 */
import type { Board, BoardEvent } from '../../shared/payload';
import type { Ctx, DashModule } from './types';
import { rollingWeek, type DayBucket } from '../logic/days';
import { awayArrowText, awaySpan } from '../logic/away';
import { DOW_SHORT, dayNum, dowOf } from '../logic/time';
import { at, esc } from '../ui/html';
import { inkOf, pill, teamLabel, tint, calOf } from '../ui/events';
import { dayCircle, tripArrow } from '../ui/icons';

const LINE = 31;

function entry(board: Board, e: BoardEvent, ctx: Ctx): string {
  if (e.kind === 'sports' && !e.allDay) {
    return `<div class="e">${pill(board, e, `${e.time} ${teamLabel(board, e)}`)}</div>`;
  }
  const ink = inkOf(e, ctx);
  if (e.allDay) {
    const c = calOf(board, e.cals[0]);
    return `<div class="e e-all" style="color:${ink};background:${tint(c ? c.color : '#5F5E5A', ctx.theme === 'night' ? 0.26 : 0.13)}">${esc(e.title)}</div>`;
  }
  return `<div class="e" style="color:${ink}">${esc(e.time)} ${esc(e.title)}</div>`;
}

function column(board: Board, b: DayBucket, i: number, x: number, w: number, h: number, maxLines: number, ctx: Ctx): string {
  const isToday = i === 0;
  const all = b.allDay.concat(b.timed);
  let lines = '';
  if (all.length <= maxLines) {
    lines = all.map((e) => entry(board, e, ctx)).join('');
  } else {
    const keep = Math.max(0, maxLines - 1);
    lines = all.slice(0, keep).map((e) => entry(board, e, ctx)).join('') + `<div class="e pencil">+${all.length - keep} more</div>`;
  }
  return `<div class="wk${isToday ? ' wk-today' : ''}" data-act="day" data-day="${b.day}" style="${at(x, 0, w, h)}">` +
    `<div class="d">${DOW_SHORT[dowOf(b.day)]}</div>` +
    `<div class="num hand">${dayNum(b.day)}${isToday ? dayCircle() : ''}</div>` +
    `<div class="es">${lines}</div></div>`;
}

export const weekModule: DashModule = {
  id: 'week',
  needs: ['calendar', 'week'],
  render(board, _now, ctx) {
    const land = ctx.stage.orient === 'landscape';
    const box = ctx.box;
    const week = rollingWeek(board.events, ctx.today);
    const days = week.map((b) => b.day);
    const gridX = land ? 10 : 48;
    const gridTop = land ? 84 : 92;
    const gridW = box.w - gridX * 2;
    const gridH = box.h - gridTop - 14;
    const colW = gridW / 7;

    let trip = '';
    let reserve = 0;
    for (const r of board.away || []) {
      const span = awaySpan(r, days);
      if (!span) continue;
      reserve = 84;
      const x = span.from * colW + 10;
      const w = (span.to - span.from + 1) * colW - 20;
      trip = `<div class="trip" style="${at(x, gridH - 80, Math.max(w, 120), 80)}">${tripArrow(Math.max(Math.round(w), 120), span.clipStart, span.clipEnd)}<div class="trip-text">${esc(awayArrowText(r))}</div></div>`;
      break;
    }
    const maxLines = Math.max(1, Math.floor((gridH - 108 - reserve) / LINE));
    let cols = '';
    let seps = '';
    week.forEach((b, i) => {
      cols += column(board, b, i, i * colW, colW, gridH, maxLines, ctx);
      if (i > 0) seps += `<div class="wsep" style="${at(i * colW, 8, 2, gridH - 16)}"></div>`;
    });
    return `<div class="sec-title hand" style="${at(land ? 20 : 70, 0)}font-size:${land ? 64 : 72}px;line-height:80px">This week</div>` +
      `<div class="grid" style="${at(gridX, gridTop, gridW, gridH)}">${seps}${cols}${trip}</div>`;
  },
};
