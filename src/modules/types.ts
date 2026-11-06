/**
 * Every panel is a module (frame §9): an id, an on/off switch from the config, a layout slot,
 * and render(board, now, ctx) that returns HTML for its box. Modules never read the clock
 * themselves; `now` and the local time come in through the context.
 */
import type { Board, DayKey, ModuleSwitch } from '../../shared/payload';
import type { Clock, LocalTime } from '../logic/time';
import type { Box, Layout, SlotId, Stage } from '../logic/layout';
import type { Freshness } from '../logic/freshness';

/** Switches in DASH_CONFIG.modules. All default to on. */
export type ToggleId = ModuleSwitch;
export type Toggles = Record<ToggleId, boolean>;

export const DEFAULT_TOGGLES: Toggles = { calendar: true, week: true, gameday: true, weather: true, kitchen: true, tv: true };

export interface BaseCtx {
  now: number;
  clock: Clock;
  local: LocalTime;
  today: DayKey;
  tomorrow: DayKey;
  stage: Stage;
  theme: 'day' | 'night';
  /** After tomorrowPeekHour: Today shrinks, Tomorrow grows. */
  peek: boolean;
  fresh: Freshness;
  /** Readable ink per calendar key for the current paper. */
  inks: Record<string, string>;
  toggles: Toggles;
  /** A problem with the script's reply (wrong key, newer schema), shown as a banner. */
  problem: string;
}

export interface Ctx extends BaseCtx {
  box: Box;
  layout: Layout;
}

export interface DashModule {
  id: SlotId;
  /** Config switches that must all be on (none = always on). */
  needs: ToggleId[];
  /** Whether it has something to show right now. Bands without content give their room away. */
  active?(board: Board, now: number, ctx: BaseCtx): boolean;
  render(board: Board, now: number, ctx: Ctx): string;
}
