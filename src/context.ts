/**
 * Pure steps between a board and HTML: the render context for `now`, and which modules show
 * where. The App adds the DOM and timers on top; tests call these directly.
 */
import type { Board } from '../shared/payload';
import { MODULES } from './modules';
import type { BaseCtx, Toggles } from './modules/types';
import { addDays, makeClock, type Clock } from './logic/time';
import { isNight, isPeek } from './logic/modes';
import { freshness } from './logic/freshness';
import { readableInk } from './logic/ink';
import { planLayout, type Box, type Layout, type SlotId, type Stage } from './logic/layout';

export const PAPER = { day: '#F5EFE1', night: '#1B1E25' };

export function inksFor(b: Board, theme: 'day' | 'night'): Record<string, string> {
  const inks: Record<string, string> = {};
  for (const c of b.calendars) {
    const base = c.kind === 'sports' ? c.accent || '#101820' : c.color;
    inks[c.key] = readableInk(base, PAPER[theme], 4.5);
  }
  return inks;
}

export interface CtxOptions {
  stage: Stage;
  toggles: Toggles;
  offline: boolean;
  problem: string;
  /** Pass memoized ones from the App; built here when missing. */
  clock?: Clock;
  inks?: (theme: 'day' | 'night') => Record<string, string>;
}

export function buildCtx(b: Board, now: number, o: CtxOptions): BaseCtx {
  const clock = o.clock || makeClock(b.timezone, b.tzOffsetMin);
  const local = clock(now);
  const theme = isNight(local.hour, b.display) ? 'night' : 'day';
  return {
    now, clock, local,
    today: local.dayKey,
    tomorrow: addDays(local.dayKey, 1),
    stage: o.stage,
    theme,
    peek: isPeek(local.hour, b.display),
    fresh: freshness(b.generatedAt, now, o.offline, b.display.staleAfterMinutes, clock),
    inks: o.inks ? o.inks(theme) : inksFor(b, theme),
    toggles: o.toggles,
    problem: o.problem,
  };
}

export interface Part {
  id: SlotId;
  box: Box;
  html: string;
}

/** Which modules have something to show, where they go, and their HTML. */
export function planBoard(b: Board, now: number, ctx: BaseCtx): { layout: Layout; parts: Part[] } {
  const active = new Set<SlotId>();
  for (const m of MODULES) {
    if (!m.needs.every((t) => ctx.toggles[t])) continue;
    if (m.active && !m.active(b, now, ctx)) continue;
    active.add(m.id);
  }
  const layout = planLayout(ctx.stage, active);
  const parts: Part[] = [];
  for (const m of MODULES) {
    const box = layout[m.id];
    if (!box || !active.has(m.id)) continue;
    parts.push({ id: m.id, box, html: m.render(b, now, { ...ctx, box, layout }) });
  }
  return { layout, parts };
}
