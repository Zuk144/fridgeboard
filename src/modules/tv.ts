/**
 * "On TV tonight": the NFL, NBA and college football games on national TV today, as a short
 * hand-lettered list under This Week. Matchup · time · network name; once a game starts, the
 * score sits next to each team and the game clock ("Q3 8:24") replaces the time. The family's
 * teams keep their final score for the rest of the day. Games of the family's teams
 * (ticked sports calendars) wear their team colors. Text and colors only, no logos.
 */
import type { Board, TvGame } from '../../shared/payload';
import type { DashModule } from './types';
import { TV_HEAD, TV_ROW } from '../logic/layout';
import { hasScore, isOnNow, tvFit, tvGamesNow, tvTitle } from '../logic/tv';
import { at, esc } from '../ui/html';
import { calOf } from '../ui/events';
import { tvSet } from '../ui/icons';

function team(name: string, rank?: number, score?: number, lead = false): string {
  const sc = typeof score === 'number' ? ` <span class="tv-sc${lead ? ' lead' : ''}">${score}</span>` : '';
  return (rank ? `<span class="tv-rank">#${rank}</span>` : '') + esc(name) + sc;
}

function gameLine(board: Board, g: TvGame, now: number, narrow: boolean): string {
  const scored = hasScore(g) && (g.final || isOnNow(g, now));
  const a = scored ? (g.awayScore as number) : undefined;
  const h = scored ? (g.homeScore as number) : undefined;
  const match = `${team(g.away, g.awayRank, a, scored && a! > h!)} @ ${team(g.home, g.homeRank, h, scored && h! > a!)}`;
  let style = '';
  if (g.fav) {
    const c = calOf(board, g.fav);
    style = ` style="background:${c && c.color ? c.color : '#FFB612'};color:${c && c.accent ? c.accent : '#101820'}"`;
  }
  const head = `<span class="tv-match${g.fav ? ' tv-fav' : ''}"${style}>${match}</span><span class="tv-dot">·</span>`;
  // Over: the final score is the news, nothing left to tune in to.
  if (g.final) return head + `<span class="tv-final hand">${esc(g.clock || 'Final')}</span>`;
  const when = isOnNow(g, now)
    ? `<span class="tv-live hand">${esc(g.clock || 'on now')}</span>`
    : `<span class="tv-time">${esc(g.time)}${g.ampm === 'am' ? ' am' : ''}</span>`;
  return head + `${when}<span class="tv-dot">·</span><span class="tv-net">${esc(narrow ? g.network.split(' / ')[0] : g.network)}</span>`;
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
    const fit = tvFit(games, rows * 2, now);
    const more = fit.cut + (tv.more || 0);
    // One full-width line per game when they fit that way (room for score and clock), else two columns.
    const cols = fit.shown.length > rows ? 2 : 1;
    const perCol = Math.ceil(fit.shown.length / cols) || 1;
    const gap = 26;
    const colW = cols === 2 ? (w - gap) / 2 : w;
    let html = `<div class="tv-head" style="${at(x0, 0, w, TV_HEAD)}"><span class="hand sec-small">${tvSet(40)}${esc(tvTitle(fit.shown))}</span>` +
      (more ? `<span class="pencil tv-more">+${more} more on TV</span>` : '') + '</div>';
    fit.shown.forEach((g, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      html += `<div class="tv-g" style="${at(x0 + col * (colW + gap), TV_HEAD + row * TV_ROW, colW, TV_ROW)}">${gameLine(board, g, now, cols === 2)}</div>`;
    });
    return html;
  },
};
