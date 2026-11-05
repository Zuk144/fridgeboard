/** The dashboard's modules, in paint order. The layout decides where each one goes. */
import type { DashModule } from './types';
import { headerModule } from './header';
import { gamedayModule } from './gameday';
import { awayModule } from './away';
import { todayModule } from './today';
import { nextupModule } from './nextup';
import { weekModule } from './week';
import { weatherModule } from './weather';
import { kitchenModule } from './kitchen';
import { esc } from '../ui/html';

/** Amber banner when the board is older than staleAfterMinutes. Never quietly shows old info. */
export const staleModule: DashModule = {
  id: 'stale',
  needs: [],
  active(_board, _now, ctx) {
    return ctx.fresh.stale || !!ctx.problem;
  },
  render(_board, _now, ctx) {
    if (ctx.problem) return `<div class="stale-banner problem">${esc(ctx.problem)}</div>`;
    return `<div class="stale-banner">${esc(ctx.fresh.banner)}</div>`;
  },
};

export const MODULES: DashModule[] = [
  staleModule,
  headerModule,
  gamedayModule,
  awayModule,
  todayModule,
  weekModule,
  weatherModule,
  kitchenModule,
  nextupModule,
];
