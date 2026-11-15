/**
 * Holiday countdown: a kraft-paper card between Today and This Week for the next major holiday in
 * the board's window. "11 days to Thanksgiving" with the number in red pen, "Thanksgiving is
 * tomorrow!" the day before, and "Happy Thanksgiving!" on the day. Tapping it opens that day.
 * When the card can't fit, the small tag next to "Today" carries the countdown instead.
 */
import type { DashModule } from './types';
import { holidayCard } from '../logic/holidays';
import { DOW_LONG, dowOf } from '../logic/time';
import { esc } from '../ui/html';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${DOW_LONG[dowOf(day)]}, ${MONTHS[m - 1]} ${d}`;
}

export const countdownModule: DashModule = {
  id: 'countdown',
  needs: ['calendar'],
  active(board, _now, ctx) {
    return !!holidayCard(board.events, ctx.today);
  },
  render(board, _now, ctx) {
    const c = holidayCard(board.events, ctx.today);
    if (!c) return '';
    let main: string;
    if (c.days === 0) main = `<span class="cd-big">Happy ${esc(c.name)}!</span>`;
    else if (c.days === 1) main = `<span class="cd-big">${esc(c.name)} is tomorrow!</span>`;
    else main = `<span class="cd-num">${c.days}</span><span class="cd-words">days to ${esc(c.name)}</span>`;
    const when = c.days === 0 ? 'today' : shortDate(c.day);
    return `<div class="cd-card" data-act="day" data-day="${c.day}"><span class="kraft-hole cd-hole"></span>` +
      `<div class="hand cd-main">${main}</div><div class="pencil cd-when">${esc(when)}</div></div>`;
  },
};
