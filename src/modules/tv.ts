/**
 * "On TV tonight": the NFL, NBA and college football games on national TV today, as a short
 * hand-lettered list under This Week. Matchup · time · network name. Games of the family's teams
 * (ticked sports calendars) wear their team colors. Text and colors only, no logos.
 */
import type { Board, TvGame } from '../../shared/payload';
import type { DashModule } from './types';
import { TV_HEAD, TV_ROW } from '../logic/layout';
import { isOnNow, tvFit, tvGamesNow, tvTitle } from '../logic/tv';
import { at, esc } from '../ui/html';
import { calOf } from '../ui/events';
import { tvSet } from '../ui/icons';

function team(name: string, rank?: number): string {
  return (rank ? `<span class="tv-rank">#${rank}</span>` : '') + esc(name);
}

function gameLine(board: Board, g: TvGame, now: number, narrow: boolean): string {
  const match = `${team(g.away, g.awayRank)} @ ${team(g.home, g.homeRank)}`;
  let style = '';
  if (g.fav) {
    const c = calOf(board, g.fav);
    style = ` style="background:${c && c.color ? c.color : '#FFB612'};color:${c && c.accent ? c.accent : '#101820'}"`;
  }
  const when = isOnNow(g, now)
    ? '<span class="tv-live hand">on now</span>'
    : `<span class="tv-time">${esc(g.time)}${g.ampm === 'am' ? ' am' : ''}</span>`;
  return `<span class="tv-match${g.fav ? ' tv-fav' : ''}"${style}>${match}</span>` +
    `<span class="tv-dot">·</span>${when}<span class="tv-dot">·</span><span class="tv-net">${esc(narrow ? g.network.split(' / ')[0] : g.network)}</span>`;
}

export const tvModule: DashModule = {
  id: 'tv',
  needs: ['tv'],
  active(board, now, ctx) {
    return !!(board.tv && (board.tv.error || tvGamesNow(board, now, ctx.today).length));
  },
  render(board, now, ctx) {
    const box = ctx.box;
    const x0 = 64;
    const w = box.w - x0 - 30;
    const rows = Math.max(1, Math.floor((box.h - TV_HEAD) / TV_ROW));
    const tv = board.tv;
    if (!tv) return '';
    if (tv.error) {
      return `<div class="tv-head" style="${at(x0, 0, w, TV_HEAD)}"><span class="hand sec-small">${tvSet(40)}On TV</span></div>` +
        `<div class="tv-g pencil" style="${at(x0, TV_HEAD, w, TV_ROW)}">The game listings didn't come through. It'll try again soon.</div>`;
    }
    const games = tvGamesNow(board, now, ctx.today);
    const fit = tvFit(games, rows * 2);
    const more = fit.cut + (tv.more || 0);
    const perCol = Math.ceil(fit.shown.length / 2) || 1;
    const gap = 26;
    const colW = fit.shown.length > 1 ? (w - gap) / 2 : w;
    let html = `<div class="tv-head" style="${at(x0, 0, w, TV_HEAD)}"><span class="hand sec-small">${tvSet(40)}${esc(tvTitle(fit.shown))}</span>` +
      (more ? `<span class="pencil tv-more">+${more} more on TV</span>` : '') + '</div>';
    fit.shown.forEach((g, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      html += `<div class="tv-g" style="${at(x0 + col * (colW + gap), TV_HEAD + row * TV_ROW, colW, TV_ROW)}">${gameLine(board, g, now, fit.shown.length > 1)}</div>`;
    });
    return html;
  },
};
