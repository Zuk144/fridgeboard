/**
 * The board end to end without a browser: every fixture (built by the real Code.gs) through the
 * layout and every module, plus the stage size, config switches and reply checks.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Board } from '../shared/payload';
import { SCENARIOS, makeFixture } from './fixtures/boards';
import { buildCtx, planBoard } from '../src/context';
import { planLayout, stageFor, TODAY_MIN, type Box, type SlotId } from '../src/logic/layout';
import { tvFit, tvGamesNow, tvTitle } from '../src/logic/tv';
import { DEFAULT_TOGGLES, type Toggles } from '../src/modules/types';
import { togglesFrom } from '../src/config';
import { checkBoard, ApiProblem } from '../src/api';
import { renderNight } from '../src/screens/night';
import { renderOverlay } from '../src/screens/overlays';
import { needSummary } from '../src/modules/kitchen';
import { shortTime } from '../src/modules/week';
import { parseConfig } from '../scripts/config';

const FRIDGE = stageFor(720, 1229);

function render(name: string, opts: { toggles?: Toggles; stage?: ReturnType<typeof stageFor>; now?: number } = {}) {
  const f = makeFixture(name)!;
  const now = opts.now ?? f.now;
  const ctx = buildCtx(f.board, now, { stage: opts.stage || FRIDGE, toggles: opts.toggles || DEFAULT_TOGGLES, offline: f.offline, problem: '' });
  const plan = planBoard(f.board, now, ctx);
  const html = plan.parts.map((p) => p.html).join('\n');
  return { f, ctx, plan, html, ids: plan.parts.map((p) => p.id) };
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('stage', () => {
  it('draws the fridge at 1080 units wide with the height its browser gives', () => {
    expect(FRIDGE).toMatchObject({ W: 1080, H: 1844, offX: 0, offY: 0 });
    expect(FRIDGE.scale).toBeCloseTo(2 / 3, 5);
    expect(stageFor(720, 1280)).toMatchObject({ W: 1080, H: 1920 });
    // A laptop gets the same portrait page, letterboxed.
    const laptop = stageFor(1920, 1080);
    expect(laptop).toMatchObject({ W: 1080, H: 1600 });
    expect(laptop.offX).toBeGreaterThan(0);
    // A squat portrait window letterboxes instead of squashing the layout.
    const ipad = stageFor(820, 1000);
    expect(ipad.H).toBe(1600);
    expect(ipad.offX).toBeGreaterThan(0);
  });
});

describe('layout', () => {
  const all: SlotId[] = ['stale', 'header', 'game', 'away', 'today', 'nextup', 'week', 'tv', 'weather', 'kitchen'];

  for (const stage of [FRIDGE, stageFor(720, 1280), stageFor(820, 1000)]) {
    it(`keeps every box on the page and apart (${stage.W}x${stage.H})`, () => {
      const L = planLayout(stage, new Set(all), { tvRows: 4 });
      const boxes = Object.entries(L) as [SlotId, Box][];
      for (const [, b] of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(stage.W);
        expect(b.y + b.h).toBeLessThanOrEqual(stage.H);
        expect(b.h).toBeGreaterThan(0);
      }
      for (const [ia, a] of boxes) {
        for (const [ib, b] of boxes) {
          if (ia >= ib || ia === 'nextup' || ib === 'nextup') continue; // the sticky sits on Today on purpose
          expect(overlaps(a, b), `${ia} vs ${ib}`).toBe(false);
        }
      }
      expect(overlaps(L.nextup!, L.today!)).toBe(true);
    });
  }

  it('gives the room of a module that is off to Today', () => {
    const full = planLayout(FRIDGE, new Set<SlotId>(['header', 'today', 'week', 'weather', 'kitchen']));
    const noWeek = planLayout(FRIDGE, new Set<SlotId>(['header', 'today', 'weather', 'kitchen']));
    const bare = planLayout(FRIDGE, new Set<SlotId>(['header', 'today']));
    const withGame = planLayout(FRIDGE, new Set<SlotId>(['header', 'game', 'today', 'week', 'weather', 'kitchen']));
    expect(noWeek.today!.h).toBeGreaterThan(full.today!.h + 400);
    expect(bare.today!.h).toBeGreaterThan(noWeek.today!.h + 250);
    expect(withGame.today!.h).toBe(full.today!.h - 140);
    expect(noWeek.week).toBeUndefined();
  });

  it('lets the weather fill the page when the calendar is off', () => {
    const L = planLayout(FRIDGE, new Set<SlotId>(['header', 'weather', 'kitchen']));
    expect(L.today).toBeUndefined();
    expect(L.weather!.h).toBeGreaterThan(1000);
  });
});

describe('every fixture renders', () => {
  for (const name of Object.keys(SCENARIOS)) {
    it(name, () => {
      const r = render(name);
      expect(r.f.board.schemaVersion).toBe(1);
      expect(r.ctx.today).toBe(SCENARIOS[name].now.slice(0, 10));
      expect(r.ids).toContain('header');
      expect(r.html).not.toMatch(/undefined|NaN|\[object Object\]/);
      // Work trips never show their details, only "Dad's away".
      for (const word of ['Denver', 'Marriott', 'UA 123', 'UA 456', 'Flight', 'Hotel', 'Quarterly', 'Dentist']) {
        expect(r.html).not.toContain(word);
      }
      const night = renderNight(r.f.board, r.f.now, r.ctx);
      expect(night).not.toMatch(/undefined|NaN/);
      const agenda = renderOverlay({ kind: 'agenda', day: r.ctx.tomorrow }, r.f.board, r.f.now, r.ctx);
      expect(agenda).toContain('data-act="close"');
      expect(agenda).not.toMatch(/undefined|NaN|Denver|Flight/);
    });
  }

  it('game day before kickoff: tape, late tag, sticky and the countdown tag', () => {
    const r = render('gameday');
    expect(r.ids).toEqual(['header', 'game', 'today', 'week', 'weather', 'kitchen', 'nextup']);
    expect(r.html).toContain('8:20 tonight');
    expect(r.html).toContain('in 4h 40m');
    expect(r.html).toContain('LATE GAME');
    expect(r.html).toContain('11 days to Thanksgiving');
    expect(r.html).toContain('in 50 min');
    expect(r.html).toContain('Jacket weather');
    expect(r.html).toContain('updated 6 min ago');
  });

  it('during the game the tape reads Game on', () => {
    const r = render('gameon');
    expect(r.html).toContain('Game on!');
    expect(r.html).toContain('kicked off 4:25');
  });

  it('an empty day still says something useful', () => {
    const r = render('empty');
    expect(r.html).toContain('Nothing on today');
    expect(r.html).toContain('coming up');
    expect(r.html).toContain('Veterans Day');
    expect(r.ids).not.toContain('game');
    expect(r.html).toContain('all stocked up');
  });

  it("a travel day shows the banner and the trip arrow", () => {
    const r = render('travel');
    expect(r.ids).toContain('away');
    expect(r.html).toContain("Dad&#39;s away Tue–Thu, back tomorrow night");
    expect(r.html).toContain('trip-arrow');
  });

  it('after the peek hour Tonight shrinks and Tomorrow grows', () => {
    const r = render('peek');
    expect(r.ctx.peek).toBe(true);
    expect(r.html).toContain('Tonight');
    expect(r.html).toContain('Tomorrow');
    expect(r.html).toContain('Coffee with Jen');
  });

  it('night mode shows the clock and the next morning only', () => {
    const r = render('night');
    expect(r.ctx.theme).toBe('night');
    const n = renderNight(r.f.board, r.f.now, r.ctx);
    expect(n).toContain('11:30');
    expect(n).toContain('Tomorrow');
    expect(n).toContain('Coffee with Jen');
  });

  it('stale and offline boards say so', () => {
    const stale = render('stale');
    expect(stale.ids[0]).toBe('stale');
    expect(stale.html).toContain('Heads up: this is from 12:25 pm (3 h ago)');
    expect(stale.html).toContain('Offline · last updated 12:25 pm');
    const off = render('offline');
    expect(off.ids).not.toContain('stale');
    expect(off.html).toContain('Offline · last updated 3:15 pm');
  });

  it('turning modules off reflows the page', () => {
    const r = render('gameday', { toggles: togglesFrom({ modules: { weather: false, kitchen: false, week: false } }) });
    expect(r.ids).toEqual(['header', 'game', 'today', 'nextup']);
    expect(r.html).not.toContain('Next 12 hours');
    expect(r.html).not.toContain('Jacket weather');
    const cal = render('gameday', { toggles: togglesFrom({ modules: { calendar: false } }) });
    expect(cal.ids).toEqual(['header', 'weather', 'kitchen']);
  });

});

describe('On TV tonight', () => {
  it('lists games under This Week, in two columns, matchup · time · network', () => {
    const r = render('tv-thursday');
    expect(r.ids).toContain('tv');
    const tv = r.plan.parts.find((p) => p.id === 'tv')!;
    expect(tv.box.y).toBe(r.plan.layout.week!.y + r.plan.layout.week!.h);
    expect(tv.box.y + tv.box.h).toBe(r.plan.layout.weather!.y);
    expect(tv.html).toContain('On TV tonight');
    expect(tv.html).toContain('Bears @ Packers');
    expect(tv.html).toContain('8:15');
    expect(tv.html).toContain('Prime Video');
    expect(tv.html).toMatch(/Celtics @ 76ers<\/span><span class="tv-dot">·<\/span><span class="tv-live hand">on now/);
  });

  it('hides the card when nothing is on, when switched off, and for an older script', () => {
    expect(render('tv-none').ids).not.toContain('tv');
    expect(render('weekday').ids).not.toContain('tv');
    expect(render('tv-saturday', { toggles: togglesFrom({ modules: { tv: false } }) }).ids).not.toContain('tv');
    const f = makeFixture('tv-thursday')!;
    const old: Board = JSON.parse(JSON.stringify(f.board));
    delete old.tv;
    const ctx = buildCtx(old, f.now, { stage: FRIDGE, toggles: DEFAULT_TOGGLES, offline: false, problem: '' });
    expect(planBoard(old, f.now, ctx).parts.map((p) => p.id)).not.toContain('tv');
  });

  it('never squeezes Today below its minimum; it shows fewer games and "+N more"', () => {
    for (const name of ['tv-thursday', 'tv-saturday', 'tv-sunday']) {
      for (const stage of [FRIDGE, stageFor(720, 1280)]) {
        const r = render(name, { stage });
        expect(r.plan.layout.today!.h, `${name} ${stage.H}`).toBeGreaterThanOrEqual(TODAY_MIN);
      }
    }
    const sat = render('tv-saturday');
    expect(sat.plan.layout.tv!.h).toBeLessThanOrEqual(58 + 3 * 48 + 14);
    expect(sat.html).toContain('+5 more on TV'); // 8 sent, 6 fit, plus 3 the script left out
    // Game day at 1229: one row, and the Steelers game is one of the two.
    const sun = render('tv-sunday');
    const tv = sun.plan.parts.find((p) => p.id === 'tv')!.html;
    expect(tv).toContain('Steelers @ Bengals');
    expect(tv).toMatch(/tv-match tv-fav" style="background:#FFB612;color:#101820">Steelers @ Bengals/);
    expect(tv).toContain('+8 more on TV');
    expect(render('tv-sunday', { stage: stageFor(720, 1280) }).plan.layout.tv!.h).toBeGreaterThan(sun.plan.layout.tv!.h);
  });

  it('writes college ranks and shows the first network when two columns are tight', () => {
    const tv = render('tv-saturday').plan.parts.find((p) => p.id === 'tv')!.html;
    expect(tv).toContain('<span class="tv-rank">#9</span>Penn State @ <span class="tv-rank">#3</span>Michigan');
    expect(tv).toMatch(/Michigan<\/span>.*3:30.*<span class="tv-net">ABC<\/span>/);
    expect(tv).toContain('On TV today');
  });

  it('keeps an old board honest: drops games long over, marks started ones on now', () => {
    const f = makeFixture('tv-thursday')!;
    const later = f.now + 3 * 3600000; // 10:45 pm
    const names = tvGamesNow(f.board, later, '2026-11-12').map((g) => g.away);
    expect(names).toEqual(['Bears', 'Nuggets']); // the 7:30 NBA game is over
    expect(tvGamesNow(f.board, f.now + 2 * 86400000, '2026-11-14')).toEqual([]);
  });

  it('fits the family\'s games first and keeps start order; titles tonight vs today', () => {
    const g = (away: string, time: string, ampm: string, start: number, fav?: string) => ({ league: 'nfl', away, home: 'X', start, day: 'd', time, ampm, network: 'CBS', live: false, fav }) as never;
    const games = [g('A', '1:00', 'pm', 1), g('B', '4:25', 'pm', 2), g('C', '8:20', 'pm', 3, 'steelers')];
    expect(tvFit(games, 2)).toMatchObject({ shown: [games[0], games[2]], cut: 1 });
    expect(tvTitle([games[2]])).toBe('On TV tonight');
    expect(tvTitle(games)).toBe('On TV today');
  });

  it('says so when the listings did not come through', () => {
    const f = makeFixture('tv-thursday')!;
    const b: Board = JSON.parse(JSON.stringify(f.board));
    b.tv = { error: 'espn_http_500', games: [], more: 0 };
    const ctx = buildCtx(b, f.now, { stage: FRIDGE, toggles: DEFAULT_TOGGLES, offline: false, problem: '' });
    const html = planBoard(b, f.now, ctx).parts.find((p) => p.id === 'tv')!.html;
    expect(html).toContain("didn't come through");
    expect(html).not.toContain('espn_http_500');
  });

  it('escapes team and network names', () => {
    const f = makeFixture('tv-thursday')!;
    const b: Board = JSON.parse(JSON.stringify(f.board));
    b.tv!.games[0].away = '<img src=x>';
    b.tv!.games[0].network = '<b>TNT</b>';
    const ctx = buildCtx(b, f.now, { stage: FRIDGE, toggles: DEFAULT_TOGGLES, offline: false, problem: '' });
    const html = planBoard(b, f.now, ctx).parts.find((p) => p.id === 'tv')!.html;
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>TNT');
  });
});

describe('safety', () => {
  it('escapes event titles from Google (anyone can send an invite)', () => {
    const f = makeFixture('weekday')!;
    const evil = '<img src=x onerror=alert(1)>';
    const board: Board = JSON.parse(JSON.stringify(f.board));
    board.events.filter((e) => e.day === '2026-11-12').forEach((e) => (e.title = evil));
    board.kitchen = { count: 1, names: ['<b>milk</b>'] };
    const ctx = buildCtx(board, f.now, { stage: FRIDGE, toggles: DEFAULT_TOGGLES, offline: false, problem: '' });
    const html = planBoard(board, f.now, ctx).parts.map((p) => p.html).join('') + renderOverlay({ kind: 'agenda', day: '2026-11-12' }, board, f.now, ctx) + renderOverlay({ kind: 'kitchen' }, board, f.now, ctx);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>milk');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('small helpers', () => {
  it('summarizes the kitchen list', () => {
    expect(needSummary({ count: 6, names: ['Milk', 'Eggs', 'Bananas', 'Coffee', 'Bread', 'Cereal'] })).toEqual({ names: ['milk', 'eggs', 'bananas'], more: 3 });
    expect(needSummary({ count: 0, names: [] })).toEqual({ names: [], more: 0 });
  });

  it('writes week times in planner shorthand', () => {
    expect(shortTime('6:00')).toBe('6');
    expect(shortTime('10:00')).toBe('10');
    expect(shortTime('4:30')).toBe('4:30');
  });
});

describe('module switches from DASH_CONFIG', () => {
  afterEach(() => vi.restoreAllMocks());

  it('defaults to everything on and turns the calendar off as a whole', () => {
    expect(togglesFrom(null)).toEqual(DEFAULT_TOGGLES);
    expect(togglesFrom({ modules: { kitchen: false } })).toEqual({ ...DEFAULT_TOGGLES, kitchen: false });
    expect(togglesFrom({ modules: { calendar: false } })).toMatchObject({ calendar: false, week: false, gameday: false, weather: true });
  });

  it('accepts known switches and rejects anything else by name, never echoing secrets', () => {
    const base = { endpointUrl: 'https://script.google.com/macros/s/FAKE_deployment-id_123/exec', key: 'a'.repeat(64) };
    expect(parseConfig(JSON.stringify({ ...base, modules: { kitchen: false } })).modules).toEqual({ kitchen: false });
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`); }) as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => parseConfig(JSON.stringify({ ...base, modules: { photos: true } }))).toThrow('exit 1');
    expect(() => parseConfig(JSON.stringify({ ...base, modules: { kitchen: 'no' } }))).toThrow('exit 1');
    expect(() => parseConfig(JSON.stringify({ ...base, modules: [] }))).toThrow('exit 1');
    expect(exit).toHaveBeenCalledTimes(3);
    const said = err.mock.calls.map((c) => String(c[0])).join('\n');
    expect(said).toContain('DASH_CONFIG.modules');
    expect(said).not.toContain('FAKE_deployment');
    expect(said).not.toContain('a'.repeat(64));
  });
});

describe('script replies', () => {
  it('accepts a board, and turns a bad key or a newer schema into a clear problem', () => {
    const b = makeFixture('weekday')!.board;
    expect(checkBoard(JSON.parse(JSON.stringify(b))).generatedAt).toBe(b.generatedAt);
    expect(() => checkBoard({ ok: false, error: 'bad_key' })).toThrow(ApiProblem);
    try {
      checkBoard({ ...b, schemaVersion: 2 });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiProblem).code).toBe('schema');
      expect((e as Error).message).toContain('version 2');
    }
    expect(() => checkBoard({ ok: true, schemaVersion: 1 })).toThrow(ApiProblem);
    expect(() => checkBoard('nope')).toThrow(ApiProblem);
  });
});
