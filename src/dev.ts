/**
 * Dev-only switches (`npm run dev`). main.ts loads this file only when import.meta.env.DEV is
 * true, so none of it reaches the published site.
 *
 *   ?fixture=<name>   render a fake board without unlocking (names: test/fixtures/boards.ts)
 *   ?now=2026-11-15T19:30   pretend it's this local time (America/New_York); the clock keeps running
 *   ?offline=1        treat the last fetch as failed
 *   ?off=weather,kitchen   turn modules off to check the layout reflows
 *   ?open=agenda:2026-11-16 | kitchen | settings   open an overlay
 */
import type { Board } from '../shared/payload';
import { makeClock, wallToEpoch } from './logic/time';
import { togglesFrom } from './config';
import type { Toggles, ToggleId } from './modules/types';
import type { Overlay } from './screens/overlays';

export interface DevSetup {
  now?: () => number;
  fixture?: { board: Board; offline: boolean };
  toggles: Toggles;
  open?: Overlay;
  error?: string;
}

export async function devSetup(): Promise<DevSetup> {
  const q = new URLSearchParams(window.location.search);
  const modules: Partial<Record<ToggleId, boolean>> = {};
  (q.get('off') || '').split(',').filter(Boolean).forEach((k) => {
    modules[k.trim() as ToggleId] = false;
  });
  const out: DevSetup = { toggles: togglesFrom({ modules }) };

  let base: number | null = null;
  let tz = 'America/New_York';
  let offset = -300;
  const name = q.get('fixture');
  if (name) {
    const res = await fetch(`/__fixture/${encodeURIComponent(name)}`);
    if (!res.ok) {
      out.error = `No fixture "${name}". Try: ${await res.text()}`;
      return out;
    }
    const f = (await res.json()) as { board: Board; now: number; offline: boolean };
    out.fixture = { board: f.board, offline: q.has('offline') ? q.get('offline') !== '0' : f.offline };
    base = f.now;
    tz = f.board.timezone;
    offset = f.board.tzOffsetMin;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})$/.exec(q.get('now') || '');
  if (m) {
    base = wallToEpoch(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), makeClock(tz, offset));
  }
  if (base != null) {
    const start = base;
    const t0 = Date.now();
    out.now = () => start + (Date.now() - t0);
  }
  const open = q.get('open') || '';
  if (open === 'kitchen') out.open = { kind: 'kitchen' };
  else if (open === 'settings') out.open = { kind: 'settings', confirm: false };
  else if (/^agenda:\d{4}-\d{2}-\d{2}$/.test(open)) out.open = { kind: 'agenda', day: open.slice(7) };
  return out;
}
