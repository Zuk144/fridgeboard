/**
 * The page is drawn on a stage in design units and scaled to the viewport. The fridge is portrait:
 * 1080 units wide, with a height that follows the viewport (its 720 x 1229 CSS px at DPR 1.5 is
 * 1080 x 1843 units, and 1080 x 1920 when its browser bars hide). A wider screen, like a laptop,
 * gets the same portrait page, letterboxed.
 *
 * planLayout() turns the set of active modules into boxes. Turning a module off (or a band like
 * the game tape having nothing to show) gives its room to the Today panel, which flexes.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Stage {
  /** Design units. */
  W: number;
  H: number;
  /** CSS px per design unit. */
  scale: number;
  /** Letterbox offsets in CSS px. */
  offX: number;
  offY: number;
}

const PAGE_W = 1080;
const MIN_H = 1600;
const MAX_H = 2200;

export function stageFor(vw: number, vh: number): Stage {
  const W = PAGE_W;
  let scale = vw / W;
  let H = Math.round(vh / scale);
  let offX = 0;
  let offY = 0;
  if (H < MIN_H) {
    H = MIN_H;
    scale = vh / H;
    offX = Math.round((vw - W * scale) / 2);
  } else if (H > MAX_H) {
    H = MAX_H;
    offY = Math.round((vh - H * scale) / 2);
  }
  return { W, H, scale, offX, offY };
}

export type SlotId = 'stale' | 'header' | 'game' | 'away' | 'today' | 'nextup' | 'week' | 'weather' | 'kitchen';

export type Layout = Partial<Record<SlotId, Box>>;

/** Boxes for the active slots. `active` holds every slot that has something to show. */
export function planLayout(stage: Pick<Stage, 'W' | 'H'>, on: Set<SlotId>): Layout {
  const { W, H } = stage;
  const L: Layout = {};
  let y = 40;
  if (on.has('stale')) {
    L.stale = { x: 24, y: 64, w: W - 48, h: 64 };
    y += 96;
  }
  L.header = { x: 0, y, w: W, h: 384 };
  y += 384;
  const calendar = on.has('today');
  if (calendar && on.has('game')) {
    L.game = { x: 0, y, w: W, h: 140 };
    y += 140;
  }
  if (calendar && on.has('away')) {
    L.away = { x: 0, y, w: W, h: 82 };
    y += 82;
  }
  const bottomH = 300;
  const hasW = on.has('weather');
  const hasK = on.has('kitchen');
  if (!calendar) {
    // No calendar: the weather takes the middle of the page, the list sits beside it.
    if (hasW) L.weather = { x: 0, y, w: hasK ? 700 : W, h: H - y - 20 };
    if (hasK) L.kitchen = { x: hasW ? 700 : W - 380, y: y + 10, w: 380, h: 290 };
    return L;
  }
  let bottomY = H;
  if (hasW || hasK) {
    bottomY = H - bottomH;
    if (hasW) L.weather = { x: 0, y: bottomY, w: hasK ? 700 : W, h: bottomH - 10 };
    if (hasK) L.kitchen = { x: hasW ? 700 : W - 380, y: bottomY, w: 380, h: bottomH - 10 };
  }
  let weekTop = bottomY;
  if (on.has('week')) {
    const weekH = 420;
    weekTop = bottomY - weekH;
    L.week = { x: 0, y: weekTop, w: W, h: weekH };
  }
  L.today = { x: 0, y, w: W, h: weekTop - y };
  if (on.has('nextup')) {
    L.nextup = { x: 690, y: y + 26, w: 350, h: Math.min(392, L.today.h - 44) };
  }
  return L;
}
