/** "Dad's away Tue–Thu, back Thursday night" on each day of a trip. Dates only, never details. */
import type { DashModule } from './types';
import { awayBanner, awayOn } from '../logic/away';
import { esc } from '../ui/html';
import { plane } from '../ui/icons';

export const awayModule: DashModule = {
  id: 'away',
  needs: ['calendar'],
  active(board, _now, ctx) {
    return !!awayOn(board.away, ctx.today);
  },
  render(board, _now, ctx) {
    const r = awayOn(board.away, ctx.today);
    if (!r) return '';
    return `<div class="away-note">${plane(ctx.stage.orient === 'landscape' ? 40 : 46)}<span class="hand">${esc(awayBanner(r, ctx.today))}</span></div>`;
  },
};
