/** Header: big clock and date, weather now with today's hi/lo, the wear call in red pen, freshness. */
import type { Board } from '../../shared/payload';
import type { DashModule, Ctx } from './types';
import { clockFace, longDate } from '../logic/time';
import { esc } from '../ui/html';
import { penCircle, penUnderline, weatherIcon } from '../ui/icons';

function weatherNow(board: Board, ctx: Ctx): string {
  const w = board.weather || {};
  if (w.error || !w.now) return '<div class="hd-wx"><div class="pencil wx-missing">weather unavailable</div></div>';
  const land = ctx.stage.orient === 'landscape';
  const t = w.today;
  const line = `${esc(w.now.text)}${t ? ` · ${t.hi}° / ${t.lo}°` : ''}`;
  let call = '';
  if (w.call && w.call.text) {
    const fs = w.call.text.length > 14 ? 42 : 50;
    const cw = Math.round(w.call.text.length * fs * 0.44 + 84);
    call = `<div class="wear" style="height:${land ? 84 : 96}px">${penCircle(cw, land ? 84 : 94)}<div class="hand wear-text" style="font-size:${fs}px">${esc(w.call.text)}</div></div>`;
  }
  return `<div class="hd-wx"><div class="wx-top">${weatherIcon(w.now.icon, land ? 128 : 150)}<div class="hand wx-temp">${w.now.temp}°</div></div><div class="wx-line">${line}</div>${call}</div>`;
}

export const headerModule: DashModule = {
  id: 'header',
  needs: [],
  render(board, _now, ctx) {
    const face = clockFace(ctx.local);
    const fresh = ctx.fresh;
    const status = fresh.offline
      ? `<div class="hd-fresh offline">${esc(fresh.badge)}</div>`
      : `<div class="hd-fresh pencil">${esc(fresh.updated)}</div>`;
    return `<div class="hd-clock hand" data-hold="settings">${face.time}<span class="ampm">${face.ampm}</span></div>` +
      `<div class="hd-date"><span class="hand">${esc(longDate(ctx.today))}</span>${penUnderline()}</div>` +
      status +
      (ctx.toggles.weather ? weatherNow(board, ctx) : '');
  },
};
