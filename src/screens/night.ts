/**
 * Night mode: dark, a dim clock and the next morning's first event. Drifts further than the day
 * page every hour (burn-in), and a tap wakes the full board for 60 seconds.
 */
import type { Board } from '../../shared/payload';
import type { BaseCtx } from '../modules/types';
import { bucketDay } from '../logic/days';
import { awayBanner, awayOn } from '../logic/away';
import { burnInShift, nightLookahead } from '../logic/modes';
import { clockFace, longDate } from '../logic/time';
import { esc } from '../ui/html';

export function renderNight(board: Board, now: number, ctx: BaseCtx): string {
  const face = clockFace(ctx.local);
  const look = nightLookahead(ctx.local);
  const b = bucketDay(board.events, look.day);
  const timed = b.timed.filter((e) => (e.start || 0) > now);
  let next: string;
  if (ctx.toggles.calendar === false) {
    next = '';
  } else if (timed.length) {
    const e = timed[0];
    next = `<span class="nl">${look.label}</span> <b>${esc(e.time)} ${esc(e.ampm)}</b> ${esc(e.title)}`;
  } else if (b.allDay.length) {
    next = `<span class="nl">${look.label}</span> ${esc(b.allDay[0].title)}`;
  } else {
    next = `<span class="nl">${look.label}</span> nothing on the calendar`;
  }
  const away = ctx.toggles.calendar === false ? null : awayOn(board.away, look.day);
  const w = board.weather || {};
  const wx = ctx.toggles.weather && w.now ? `${w.now.temp}° · ${esc(w.now.text)}` : '';
  const shift = burnInShift(now, 9);
  const status = ctx.fresh.offline ? ctx.fresh.badge : ctx.fresh.stale ? ctx.fresh.banner : '';
  return `<div class="night" data-act="wake"><div class="night-inner" style="transform:translate(${shift.x}px,${shift.y}px)">` +
    `<div class="hand night-clock">${face.time}<span class="ampm">${face.ampm}</span></div>` +
    `<div class="hand night-date">${esc(longDate(ctx.today))}</div>` +
    (next ? `<div class="night-next">${next}</div>` : '') +
    (away ? `<div class="night-away">${esc(awayBanner(away, ctx.today))}</div>` : '') +
    (wx ? `<div class="night-wx">${wx}</div>` : '') +
    (status ? `<div class="night-status">${esc(status)}</div>` : '') +
    '</div><div class="night-hint">tap for the full board</div></div>';
}
