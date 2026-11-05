/** Full-screen sheets over the board: a day's agenda, the kitchen placeholder, fridge settings. */
import type { Board, BoardEvent, DayKey } from '../../shared/payload';
import type { BaseCtx } from '../modules/types';
import { bucketDay } from '../logic/days';
import { awayBanner, awayOn } from '../logic/away';
import { holidayCountdown } from '../logic/holidays';
import { eventState } from '../logic/nextup';
import { clockFace, daysBetween, longDate } from '../logic/time';
import { at, esc } from '../ui/html';
import { calOf, chip, dots, inkOf, pill } from '../ui/events';

export type Overlay =
  | { kind: 'agenda'; day: DayKey }
  | { kind: 'kitchen' }
  | { kind: 'settings'; confirm: boolean };

const closeX = '<div class="ov-close" data-act="close" role="button" aria-label="Close"><svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke-width="6" stroke-linecap="round" aria-hidden="true"><path d="M10 11 C 22 22, 34 33, 46 45"/><path d="M45 10 C 33 23, 22 33, 11 46"/></svg></div>';
const closeBig = '<div class="ov-done hand" data-act="close" role="button">Close</div>';

function range(e: BoardEvent, ctx: BaseCtx): string {
  if (e.end == null) return `${e.time} ${e.ampm}`;
  const end = clockFace(ctx.clock(e.end));
  return end.ampm === e.ampm && e.endDay === e.day ? `${e.time} – ${end.time} ${end.ampm}` : `${e.time} ${e.ampm} – ${end.time} ${end.ampm}`;
}

function agenda(board: Board, day: DayKey, now: number, ctx: BaseCtx): string {
  const W = ctx.stage.W;
  const H = ctx.stage.H;
  const b = bucketDay(board.events, day);
  const n = daysBetween(ctx.today, day);
  const rel = n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 1 ? `in ${n} days` : n === -1 ? 'yesterday' : `${-n} days ago`;
  const title = longDate(day);
  const away = awayOn(board.away, day);
  const cd = day === ctx.today ? holidayCountdown(board.events, day) : null;
  let y = 250;
  let html = closeX + `<div class="ov-title hand" style="${at(70, 60)}${title.length > 21 ? 'font-size:80px;' : ''}">${esc(title)}</div>`;
  html += `<div class="ov-sub pencil" style="${at(76, 176)}">${esc(rel)}${cd ? ` · ${esc(cd.text)}` : ''}</div>`;
  if (away) {
    html += `<div class="ov-away hand" style="${at(70, y)}">${esc(awayBanner(away, ctx.today))}</div>`;
    y += 80;
  }
  if (b.allDay.length) {
    html += `<div class="ov-chips" style="${at(64, y, W - 128)}">${b.allDay.map((e) => chip(board, e, ctx, 'chip big')).join('')}</div>`;
    y += 80 * Math.ceil(b.allDay.length / 3);
  }
  const bottom = H - 230;
  if (!b.timed.length) {
    html += `<div class="ov-empty hand" style="${at(70, y + 20)}">${b.allDay.length ? 'Nothing else planned.' : 'Nothing on the calendar.'}</div>`;
  } else {
    const n = b.timed.length;
    const cols = n * 64 > bottom - y ? 2 : 1;
    const perCol = Math.ceil(n / cols);
    const rowH = Math.max(64, Math.min(100, Math.floor((bottom - y) / perCol)));
    const colW = (W - 120) / cols;
    b.timed.forEach((e, i) => {
      const c = Math.floor(i / perCol);
      const r = i % perCol;
      const past = day === ctx.today && eventState(e, now) === 'past';
      const labels = e.cals.map((k) => (calOf(board, k) || { label: k }).label).join(' + ');
      const title = e.kind === 'sports' ? `${esc(e.title)} ${pill(board, e, e.late ? 'on TV · late' : 'on TV', 'tv')}` : esc(e.title);
      html += `<div class="ag-row${past ? ' past' : ''}${cols === 2 ? ' two' : ''}" style="${at(60 + c * colW, y + r * rowH, colW - 20, rowH)}">` +
        `<div class="ag-time pencil">${esc(range(e, ctx))}</div>` +
        `<div class="ag-title" style="color:${e.kind === 'sports' ? 'var(--ink)' : inkOf(e, ctx)}"><span class="${past ? 'strike' : ''}">${title}</span>${dots(e, ctx)}</div>` +
        `<div class="ag-cal pencil">${esc(labels)}</div></div>`;
    });
  }
  return `<div class="overlay paper">${html}${closeBig}</div>`;
}

function kitchen(board: Board): string {
  const k = board.kitchen || { count: 0, names: [] };
  const names = (k.names || []).map((n) => `<li>${esc(n.toLowerCase())}</li>`).join('');
  const more = k.count > (k.names || []).length ? `<li class="pencil">+${k.count - k.names.length} more</li>` : '';
  return `<div class="overlay paper">${closeX}` +
    `<div class="ov-title hand" style="${at(70, 60)};color:var(--red)">We're out</div>` +
    `<div class="ov-body"><div class="ov-pad">${k.count ? `<ul>${names}${more}</ul>` : '<p class="pencil">Nothing on the list right now.</p>'}</div>` +
    `<p class="ov-text">Tap-to-add buttons for the fridge are coming in the next update. For now, add things on a phone: open the Fridgeboard Sheet, Needed tab.</p></div>` +
    `${closeBig}</div>`;
}

function settings(confirm: boolean): string {
  return `<div class="overlay paper">${closeX}` +
    `<div class="ov-title hand" style="${at(70, 60)}">This fridge</div>` +
    '<div class="ov-note" style="top:250px">Forget this device removes the stored unlock key and the saved calendar from this fridge. You\'ll need the passphrase again.</div>' +
    '<div class="ov-btn hand" data-act="reload" role="button" style="top:520px">Reload now</div>' +
    `<div class="ov-btn hand danger${confirm ? ' armed' : ''}" data-act="forget" role="button" style="top:680px">${confirm ? 'Tap again to forget' : 'Forget this device'}</div>` +
    `${closeBig}</div>`;
}

export function renderOverlay(o: Overlay, board: Board, now: number, ctx: BaseCtx): string {
  if (o.kind === 'agenda') return agenda(board, o.day, now, ctx);
  if (o.kind === 'kitchen') return kitchen(board);
  return settings(o.confirm);
}
