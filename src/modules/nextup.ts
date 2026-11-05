/**
 * Next Up: a tilted yellow sticky with the countdown in red pen, for the next thing today.
 * When nothing is left today the sticky goes away; on an empty day a pale "coming up" index card
 * shows the next thing on the calendar instead, so the page never looks abandoned.
 */
import type { Board, BoardEvent } from '../../shared/payload';
import type { BaseCtx, DashModule } from './types';
import { bucketDay, firstAfter } from '../logic/days';
import { countdownText, pickNextUp } from '../logic/nextup';
import { DOW_LONG, daysBetween, dowOf } from '../logic/time';
import { esc } from '../ui/html';

function nextToday(board: Board, now: number, ctx: BaseCtx): BoardEvent | null {
  return pickNextUp(bucketDay(board.events, ctx.today).timed, now);
}

function comingUp(board: Board, now: number, ctx: BaseCtx): BoardEvent | null {
  if (ctx.peek) return null; // the Tomorrow section already shows it
  return firstAfter(board.events, ctx.today);
}

function titleSize(title: string, big: number): number {
  if (title.length > 24) return Math.round(big * 0.72);
  if (title.length > 14) return Math.round(big * 0.85);
  return big;
}

export const nextupModule: DashModule = {
  id: 'nextup',
  needs: ['calendar'],
  active(board, now, ctx) {
    return !!(nextToday(board, now, ctx) || comingUp(board, now, ctx));
  },
  render(board, now, ctx) {
    const small = ctx.box.h < 330;
    const next = nextToday(board, now, ctx);
    if (next) {
      const ts = titleSize(next.title, small ? 56 : 66);
      return `<div class="sticky${small ? ' compact' : ''}" data-act="day" data-day="${ctx.today}"><div class="sticky-tape"></div>` +
        `<div class="hand sticky-label">next up</div>` +
        `<div class="hand sticky-title" style="font-size:${ts}px;line-height:${ts + 4}px">${esc(next.title)}</div>` +
        `<div class="sticky-time">${esc(next.time)} ${esc(next.ampm)}</div>` +
        `<div class="hand sticky-count">${esc(countdownText((next.start as number) - now))}</div></div>`;
    }
    const e = comingUp(board, now, ctx);
    if (!e) return '';
    const days = daysBetween(ctx.today, e.day);
    const when = days === 1 ? 'tomorrow' : DOW_LONG[dowOf(e.day)];
    const at = e.allDay ? 'all day' : `${e.time} ${e.ampm}`;
    const ts = titleSize(e.title, small ? 52 : 60);
    return `<div class="card${small ? ' compact' : ''}" data-act="day" data-day="${e.day}">` +
      `<div class="hand card-label">coming up</div>` +
      `<div class="hand card-title" style="font-size:${ts}px;line-height:${ts + 4}px">${esc(e.title)}</div>` +
      `<div class="card-time">${esc(when)} · ${esc(at)}</div>` +
      `<div class="hand card-count">${days === 1 ? 'tomorrow' : `in ${days} days`}</div></div>`;
  },
};
