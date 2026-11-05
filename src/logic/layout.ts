/**
 * The page is drawn on a stage in design units and scaled to the viewport. Portrait (the fridge)
 * is 1080 units wide with a height that follows the viewport: the fridge's 720 x 1229 CSS px at
 * DPR 1.5 is 1080 x 1843 units, and 1080 x 1920 when its browser bars hide. Landscape is 1920 wide.
 *
 * planLayout() turns the set of active modules into boxes. Turning a module off (or a band like
 * the game tape having nothing to show) gives its room to the Today panel, which flexes.
 */

export type Orient = 'portrait' | 'landscape';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Stage {
  orient: Orient;
  /** Design units. */
  W: number;
  H: number;
  /** CSS px per design unit. */
  scale: number;
  /** Letterbox offsets in CSS px. */
  offX: number;
  offY: number;
}

const LIMITS = {
  portrait: { W: 1080, minH: 1600, maxH: 2200 },
  landscape: { W: 1920, minH: 960, maxH: 1300 },
};

export function stageFor(vw: number, vh: number): Stage {
  const orient: Orient = vw > vh ? 'landscape' : 'portrait';
  const lim = LIMITS[orient];
  const W = lim.W;
  let scale = vw / W;
  let H = Math.round(vh / scale);
  let offX = 0;
  let offY = 0;
  if (H < lim.minH) {
    H = lim.minH;
    scale = vh / H;
    offX = Math.round((vw - W * scale) / 2);
  } else if (H > lim.maxH) {
    H = lim.maxH;
    offY = Math.round((vh - H * scale) / 2);
  }
  return { orient, W, H, scale, offX, offY };
}

export type SlotId = 'stale' | 'header' | 'game' | 'away' | 'today' | 'nextup' | 'week' | 'weather' | 'kitchen';

export type Layout = Partial<Record<SlotId, Box>>;

/** Boxes for the active slots. `active` holds every slot that has something to show. */
export function planLayout(stage: Pick<Stage, 'orient' | 'W' | 'H'>, active: Set<SlotId>): Layout {
  return stage.orient === 'landscape' ? landscape(stage.W, stage.H, active) : portrait(stage.W, stage.H, active);
}

function portrait(W: number, H: number, on: Set<SlotId>): Layout {
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

function landscape(W: number, H: number, on: Set<SlotId>): Layout {
  const L: Layout = {};
  const left = 1000;
  let y = 34;
  if (on.has('stale')) {
    L.stale = { x: 24, y: 60, w: W - 48, h: 60 };
    y += 86;
  }
  L.header = { x: 0, y, w: left, h: 296 };
  let ly = y + 296;
  const calendar = on.has('today');
  const hasW = on.has('weather');
  const hasK = on.has('kitchen');
  if (!calendar) {
    if (hasW) L.weather = { x: 0, y: ly, w: left, h: H - ly - 20 };
    if (hasK) L.kitchen = { x: left + 120, y: y + 40, w: 380, h: 300 };
    return L;
  }
  if (on.has('game')) {
    L.game = { x: 0, y: ly, w: left, h: 126 };
    ly += 126;
  }
  if (on.has('away')) {
    L.away = { x: 0, y: ly, w: left, h: 76 };
    ly += 76;
  }
  L.today = { x: 0, y: ly, w: left, h: H - ly - 10 };
  if (on.has('nextup')) {
    L.nextup = { x: left - 360, y: ly + 22, w: 330, h: Math.min(370, L.today.h - 40) };
  }
  const right = W - left;
  const bottomH = 400;
  let weekBottom = H;
  if (hasW || hasK) {
    weekBottom = H - bottomH;
    if (hasW) L.weather = { x: left, y: weekBottom, w: hasK ? 600 : right, h: bottomH - 14 };
    if (hasK) L.kitchen = { x: hasW ? left + 600 : W - 380, y: weekBottom + 20, w: 320, h: bottomH - 50 };
  }
  if (on.has('week')) L.week = { x: left, y: y + 26, w: right - 20, h: weekBottom - y - 26 };
  else if (L.weather) {
    L.weather = { x: left, y, w: right - (hasK ? 360 : 20), h: H - y - 20 };
    if (L.kitchen) L.kitchen = { x: W - 360, y: y + 20, w: 340, h: 350 };
  }
  return L;
}
