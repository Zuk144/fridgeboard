/** Game day: a strip of team-colored washi tape with hazard ends. Text and colors only, no logos. */
import type { DashModule } from './types';
import { pickGame, kickoffText } from '../logic/game';
import { countdownText } from '../logic/nextup';
import { esc } from '../ui/html';
import { teamColors } from '../ui/events';
import { football } from '../ui/icons';

export const gamedayModule: DashModule = {
  id: 'game',
  needs: ['calendar', 'gameday'],
  active(board, now, ctx) {
    return !!pickGame(board.events, ctx.today, now);
  },
  render(board, now, ctx) {
    const g = pickGame(board.events, ctx.today, now);
    if (!g) return '';
    const [bg, fg] = teamColors(board, g.e);
    const land = ctx.stage.orient === 'landscape';
    const late = g.e.late ? `<span class="late-tag" style="background:${fg};color:${bg}">LATE GAME</span>` : '';
    const right = g.state === 'on'
      ? `<div class="hand tape-when">Game on!</div><div class="tape-sub">kicked off ${esc(g.e.time)}${late}</div>`
      : `<div class="hand tape-when">${esc(kickoffText(g.e))}</div><div class="tape-sub">${esc(countdownText((g.e.start as number) - now))}${late}</div>`;
    const stripes = `repeating-linear-gradient(135deg,${fg} 0,${fg} 13px,rgba(0,0,0,0) 13px,rgba(0,0,0,0) 26px)`;
    const style = `background-color:${bg};color:${fg};background-image:${stripes},${stripes},linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 40%,rgba(0,0,0,.06))`;
    const title = g.e.title.length > 22 && !land ? ' small' : '';
    return `<div class="tape ${g.state === 'on' ? 'tape-on' : ''}" style="${style}" data-act="day" data-day="${ctx.today}">` +
      `<div class="tape-ball">${football(land ? 54 : 64, fg)}</div>` +
      `<div class="hand tape-title${title}">${esc(g.e.title)}</div>` +
      `<div class="tape-right">${right}</div></div>`;
  },
};
