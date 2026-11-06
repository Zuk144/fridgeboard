import { describe, it, expect, beforeEach } from 'vitest';
import { loadCode, at, type Harness, type FakeCalendarSpec, type FakeFetch } from './gas-harness';
import type { Board, KitchenState, TvGame } from '../shared/payload';
import { TV_DAYS, T, espnFetch } from './fixtures/espn';

const NY = 'America/New_York';
const utcMidnight = (d: string) => new Date(`${d}T00:00:00Z`);
const nyMidnight = (d: string) => at(`${d}T00:00`, NY);

// Fake family data shaped like the real calendars (the Family calendar's own zone is UTC).
// Public sports and holiday entries use the reference games and holidays in DASHBOARD_FRAME §5.5.
function calendars(): FakeCalendarSpec[] {
  return [
    {
      id: 'me@example.com', name: 'me@example.com', tz: NY, primary: true,
      events: [
        { title: 'Grandma & Grandpa over', start: at('2026-11-15T13:00'), end: at('2026-11-15T15:30') },
        { title: 'Taco night', start: at('2026-11-15T18:00'), end: at('2026-11-15T19:00') },
        { title: 'Movie marathon', start: at('2026-11-16T22:00'), end: at('2026-11-17T01:00') },
        { title: 'Quarterly review prep', start: at('2026-11-16T10:00'), end: at('2026-11-16T11:00') },
        { title: 'Flight to Denver UA 123', start: at('2026-11-17T07:00'), end: at('2026-11-17T09:30') },
        { title: 'Hotel: Marriott Denver Tech Center', allDayStart: nyMidnight('2026-11-17'), allDayEnd: nyMidnight('2026-11-19') },
        { title: 'Flight home UA 456', start: at('2026-11-19T18:00'), end: at('2026-11-19T21:15') },
      ],
    },
    {
      id: 'family0001@group.calendar.google.com', name: 'Family', tz: 'UTC',
      events: [
        { title: 'Taco night', start: at('2026-11-15T18:00'), end: at('2026-11-15T19:00') },
        { title: 'Piano lesson', start: at('2026-11-15T16:30'), end: at('2026-11-15T17:15') },
        { title: 'Book fair', allDayStart: utcMidnight('2026-11-17'), allDayEnd: utcMidnight('2026-11-18') },
        { title: 'Grandma visiting', allDayStart: utcMidnight('2026-11-20'), allDayEnd: utcMidnight('2026-11-23') },
        { title: 'Way later', start: at('2026-12-20T10:00'), end: at('2026-12-20T11:00') },
      ],
    },
    {
      id: 'appt0001@group.calendar.google.com', name: 'Appointment', tz: NY,
      events: [{ title: 'Dentist - kids', start: at('2026-11-16T15:15'), end: at('2026-11-16T16:00') }],
    },
    {
      id: 'en.usa#holiday@group.v.calendar.google.com', name: 'Holidays in United States', tz: NY,
      events: [
        { title: 'Veterans Day', allDayStart: nyMidnight('2026-11-11'), allDayEnd: nyMidnight('2026-11-12'), description: 'Public holiday', transparent: true },
        { title: 'Thanksgiving Day', allDayStart: nyMidnight('2026-11-26'), allDayEnd: nyMidnight('2026-11-27'), description: 'Public holiday', transparent: true },
        { title: 'Black Friday', allDayStart: nyMidnight('2026-11-27'), allDayEnd: nyMidnight('2026-11-28'), description: 'Observance\nTo hide observances, go to Google Calendar Settings > Holidays in United States', transparent: true },
      ],
    },
    {
      id: 'nfl_-m-05tfm_%50ittsburgh+%53teelers#sports@group.v.calendar.google.com', name: 'Pittsburgh Steelers', tz: NY,
      events: [
        { title: 'Steelers @ Bengals', start: at('2026-11-15T20:20'), end: at('2026-11-15T23:20'), transparent: true },
        { title: 'Steelers @ Eagles', start: at('2026-11-22T16:25'), end: at('2026-11-22T19:25'), transparent: true },
        { title: 'Broncos @ Steelers', start: at('2026-11-27T15:00'), end: at('2026-11-27T18:00'), transparent: true },
      ],
    },
    {
      id: 'nfl_-m-07l2m_%54ennessee+%54itans#sports@group.v.calendar.google.com', name: 'Tennessee Titans', tz: NY,
      events: [{ title: 'Titans @ Colts', start: at('2026-11-15T13:00'), end: at('2026-11-15T16:00'), transparent: true }],
    },
    { id: 'i_1.2.3.4#sunrise@group.v.calendar.google.com', name: 'Sunrise and sunset', tz: NY, events: [] },
  ];
}

// Open-Meteo shaped reply (timeformat=unixtime) for Sun Nov 15 onward.
function weather() {
  const t0 = at('2026-11-15T00:00').getTime() / 1000;
  const hours = Array.from({ length: 72 }, (_, i) => i);
  const temps = hours.map((i) => 40 + 12 * Math.sin(((i % 24) - 9) / 24 * 2 * Math.PI));
  return {
    current: { temperature_2m: 48.2, apparent_temperature: 44.6, weather_code: 3, is_day: 1 },
    hourly: {
      time: hours.map((i) => t0 + i * 3600),
      temperature_2m: temps,
      precipitation_probability: hours.map((i) => (i >= 19 && i <= 22 ? 40 : 10)),
      weather_code: hours.map(() => 3),
    },
    daily: {
      time: [0, 1, 2, 3, 4].map((d) => at(`2026-11-${15 + d}T00:00`).getTime() / 1000),
      weather_code: [3, 0, 2, 61, 3],
      temperature_2m_max: [52.4, 55, 58, 51, 49],
      temperature_2m_min: [39, 38, 44, 42, 40],
      precipitation_probability_max: [40, 0, 10, 70, 20],
      sunrise: [0, 1, 2, 3, 4].map((d) => at(`2026-11-${15 + d}T07:05`).getTime() / 1000),
      sunset: [0, 1, 2, 3, 4].map((d) => at(`2026-11-${15 + d}T17:00`).getTime() / 1000),
    },
  };
}

function setSetting(h: Harness, key: string, value: unknown) {
  const sh = h.ss.getSheetByName('Settings')!;
  const i = sh.rows.findIndex((r) => r[0] === key);
  sh.rows[i][1] = value;
}

function calRow(h: Harness, name: string) {
  return h.ss.getSheetByName('Calendars')!.rows.find((r) => r[5] === name)!;
}

function setUp(fetch?: FakeFetch): Harness {
  const h = loadCode({ calendars: calendars(), weather: weather(), geocode: { results: [{ latitude: 40.1234567, longitude: -80.7654321 }] }, fetch });
  // The real flow: run setup, type your town in Settings, run setup again.
  h.fn('setup');
  setSetting(h, 'weatherPlace', 'Springfield');
  h.fn('setup');
  setSetting(h, 'hideKeywords', 'quarterly');
  const appt = calRow(h, 'Appointment');
  appt[0] = true;
  appt[3] = 'busy';
  return h;
}

const NOW = at('2026-11-15T15:40').getTime();

describe('setup()', () => {
  it('builds the tabs, starter buttons, calendar list and a key, and is safe to run again', () => {
    const h = setUp();
    expect([...h.ss.sheets.keys()].sort()).toEqual(['Calendars', 'Items', 'Log', 'Needed', 'Settings']);
    const items = h.ss.getSheetByName('Items')!.table();
    expect(items).toHaveLength(28);
    expect(items.map((i) => i.name)).toContain("Kids' snacks");
    expect(new Set(items.map((i) => i.category))).toEqual(new Set(['Dairy', 'Produce', 'Pantry', 'Snacks', 'Drinks', 'Frozen', 'Household']));
    expect(h.props.get('FB_KEY')).toMatch(/^[0-9a-f]{64}$/);

    const cals = h.ss.getSheetByName('Calendars')!.table();
    const byName = Object.fromEntries(cals.map((c) => [c['Calendar name'], c]));
    expect(byName['me@example.com']).toMatchObject({ On: true, Label: 'Me', Kind: 'personal' });
    expect(byName['Family']).toMatchObject({ On: true, Kind: 'family' });
    expect(byName['Pittsburgh Steelers']).toMatchObject({ On: true, Label: 'Steelers', Kind: 'sports' });
    expect(byName['Tennessee Titans']).toMatchObject({ On: false, Kind: 'sports' });
    expect(byName['Holidays in United States']).toMatchObject({ On: true, Label: 'Holidays', Kind: 'holidays' });
    expect(byName['Sunrise and sunset']).toMatchObject({ On: false, Kind: 'other' });
    expect(byName['Appointment']).toMatchObject({ Kind: 'personal' });

    // Weather place was looked up and written back.
    const settings = Object.fromEntries(h.ss.getSheetByName('Settings')!.rows.slice(1).map((r) => [r[0], r[1]]));
    expect(settings.lat).toBe(40.123);
    expect(settings.lon).toBe(-80.765);

    const key = h.props.get('FB_KEY');
    h.fn('setup');
    expect(h.ss.getSheetByName('Items')!.table()).toHaveLength(28);
    expect(h.ss.getSheetByName('Calendars')!.table()).toHaveLength(7);
    expect(h.ss.getSheetByName('Settings')!.table()).toHaveLength(17);
    expect(h.props.get('FB_KEY')).toBe(key);
  });
});

describe('board: calendar', () => {
  let h: Harness;
  let b: Board;
  beforeEach(() => {
    h = setUp();
    b = h.fn('buildBoard_', NOW);
  });
  const find = (title: string) => b.events.find((e) => e.title === title);

  it('matches the payload contract basics', () => {
    expect(b.schemaVersion).toBe(1);
    expect(b.today).toBe('2026-11-15');
    expect(b.timezone).toBe(NY);
    expect(b.tzOffsetMin).toBe(-300);
    expect(b.calendars.map((c) => c.key)).toEqual(['me', 'family', 'appointment', 'holidays', 'steelers']);
    expect(b.calendars.find((c) => c.key === 'steelers')!.accent).toBe('#101820');
    expect(b.display).toEqual({ nightStartHour: 22, nightEndHour: 6, tomorrowPeekHour: 18, staleAfterMinutes: 120 });
  });

  it('windows today through +14 days', () => {
    expect(find('Way later')).toBeUndefined();
    expect(find('Veterans Day')).toBeUndefined();
    expect(find('Thanksgiving Day')).toBeDefined();
    expect(find('Titans @ Colts')).toBeUndefined(); // calendar is off
  });

  it('keeps timed events in local time, including across midnight', () => {
    expect(find('Piano lesson')).toMatchObject({ day: '2026-11-15', time: '4:30', ampm: 'pm', endTime: '5:15', allDay: false });
    expect(find('Movie marathon')).toMatchObject({ day: '2026-11-16', endDay: '2026-11-17', time: '10:00', ampm: 'pm' });
  });

  it('keeps all-day events all-day with exclusive ends, even on a UTC calendar', () => {
    expect(find('Book fair')).toMatchObject({ allDay: true, day: '2026-11-17', endDay: '2026-11-18', start: null });
    expect(find('Grandma visiting')).toMatchObject({ allDay: true, day: '2026-11-20', endDay: '2026-11-23' });
    expect(find('Thanksgiving Day')).toMatchObject({ allDay: true, day: '2026-11-26', endDay: '2026-11-27', busy: false });
  });

  it('merges the same event on two calendars into one with both dots', () => {
    const tacos = b.events.filter((e) => e.title === 'Taco night');
    expect(tacos).toHaveLength(1);
    expect(tacos[0].cals).toEqual(['me', 'family']);
  });

  it('hides holiday observances', () => {
    expect(find('Black Friday')).toBeUndefined();
  });

  it('treats sports as never busy and tags late kickoffs', () => {
    expect(find('Steelers @ Bengals')).toMatchObject({ busy: false, late: true, time: '8:20', kind: 'sports' });
    expect(find('Steelers @ Eagles')!.late).toBeUndefined();
    expect(find('Broncos @ Steelers')).toMatchObject({ day: '2026-11-27', busy: false });
  });

  it('shows busy-only calendars as Busy and drops hidden words', () => {
    expect(find('Busy')).toMatchObject({ day: '2026-11-16', time: '3:15', cals: ['appointment'], busy: true });
    expect(b.events.some((e) => /quarterly/i.test(e.title))).toBe(false);
  });

  it('turns travel into dates only and leaks nothing about the trip', () => {
    expect(b.away).toEqual([{
      start: nyMidnight('2026-11-17').getTime(), // the all-day hotel block starts the trip at midnight
      end: at('2026-11-19T21:15').getTime(),
      firstDay: '2026-11-17',
      lastDay: '2026-11-19',
      backTime: '9:15 pm',
      label: "Dad's away",
    }]);
    const json = JSON.stringify(b);
    for (const word of ['Denver', 'Marriott', 'UA 123', 'Flight', 'Hotel', 'Dentist', 'Quarterly']) {
      expect(json).not.toContain(word);
    }
  });

  it('sorts by day, all-day first, then start time', () => {
    const today = b.events.filter((e) => e.day === '2026-11-15').map((e) => e.title);
    expect(today).toEqual(['Grandma & Grandpa over', 'Piano lesson', 'Taco night', 'Steelers @ Bengals']);
    const nov17 = b.events.filter((e) => e.day === '2026-11-17').map((e) => e.title);
    expect(nov17).toEqual(['Book fair']);
  });

  it('reports a calendar it cannot open instead of failing', () => {
    h.setCalendars(calendars().filter((c) => c.name !== 'Family'));
    const b2: Board = h.fn('buildBoard_', NOW);
    expect(b2.errors).toEqual([{ cal: 'family', error: 'not_found' }]);
    expect(b2.events.length).toBeGreaterThan(0);
  });
});

describe('board: daylight saving', () => {
  it('finds local midnight on both 2026 change days', () => {
    const h = loadCode();
    expect(h.fn('localMidnight_', '2026-11-01', NY).toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(h.fn('localMidnight_', '2026-11-02', NY).toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(h.fn('localMidnight_', '2026-03-08', NY).toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(h.fn('localMidnight_', '2026-03-09', NY).toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(h.fn('addDays_', '2026-10-31', 14)).toBe('2026-11-14');
  });

  it('labels the repeated 1:30 am in November and the skipped hour in March correctly', () => {
    const fall = loadCode({ calendars: [{ id: 'me@example.com', name: 'me', tz: NY, primary: true, events: [
      { title: 'First 1:30', start: new Date('2026-11-01T05:30:00Z'), end: new Date('2026-11-01T05:45:00Z') },
      { title: 'Second 1:30', start: new Date('2026-11-01T06:30:00Z'), end: new Date('2026-11-01T06:45:00Z') },
      { title: 'Breakfast', start: at('2026-11-01T09:00'), end: at('2026-11-01T10:00') },
    ] }] });
    fall.fn('setup');
    const b: Board = fall.fn('buildBoard_', at('2026-10-31T12:00').getTime());
    const t = (x: string) => b.events.find((e) => e.title === x)!;
    expect(t('First 1:30')).toMatchObject({ day: '2026-11-01', time: '1:30', ampm: 'am' });
    expect(t('Second 1:30')).toMatchObject({ day: '2026-11-01', time: '1:30', ampm: 'am' });
    expect(t('Second 1:30').start! - t('First 1:30').start!).toBe(3600000);
    expect(t('Breakfast').start).toBe(Date.parse('2026-11-01T14:00:00Z'));

    const spring = loadCode({ calendars: [{ id: 'me@example.com', name: 'me', tz: NY, primary: true, events: [
      { title: 'Early', start: new Date('2026-03-08T07:30:00Z'), end: new Date('2026-03-08T08:00:00Z') },
    ] }] });
    spring.fn('setup');
    const b2: Board = spring.fn('buildBoard_', at('2026-03-07T12:00').getTime());
    expect(b2.events[0]).toMatchObject({ day: '2026-03-08', time: '3:30', ampm: 'am' });
    expect(b2.tzOffsetMin).toBe(-300);
  });

  it('reads all-day dates from whichever zone Google used for midnight', () => {
    const h = loadCode();
    expect(h.fn('dateKey_', utcMidnight('2026-11-20'), ['UTC', NY])).toBe('2026-11-20');
    expect(h.fn('dateKey_', nyMidnight('2026-11-20'), ['UTC', NY])).toBe('2026-11-20');
    expect(h.fn('dateKey_', utcMidnight('2026-11-20'), [NY, 'UTC'])).toBe('2026-11-20');
  });
});

describe('board: weather', () => {
  it('shapes now, the next 12 hours, today and a 3-day outlook, plus the wear call', () => {
    const h = setUp();
    const b: Board = h.fn('buildBoard_', NOW);
    const w = b.weather;
    expect(w.now).toEqual({ temp: 48, feels: 45, text: 'Cloudy', icon: 'cloud' });
    expect(w.hours).toHaveLength(12);
    expect(w.hours![0].label).toBe('3p');
    expect(w.hours![1].label).toBe('4p');
    expect(w.today).toMatchObject({ day: '2026-11-15', hi: 52, lo: 39, sunrise: '7:05', sunset: '5:00' });
    expect(w.days!.map((d) => d.dow)).toEqual(['Mon', 'Tue', 'Wed']);
    expect(w.days![2]).toMatchObject({ hi: 51, lo: 42, pop: 70, icon: 'rain' });
    expect(w.call).toEqual({ kind: 'jacket', text: 'Jacket weather' });
    expect(h.fetched.some((u) => u.includes('latitude=40.123') && u.includes('temperature_unit=fahrenheit'))).toBe(true);
  });

  it('picks the right call from thresholds', () => {
    const h = loadCode();
    const s = { jacketBelowF: 55, rainGearAbovePct: 50 };
    expect(h.fn('wearCall_', 70, 10, s).kind).toBe('tshirt');
    expect(h.fn('wearCall_', 50, 10, s).kind).toBe('jacket');
    expect(h.fn('wearCall_', 70, 60, s).kind).toBe('rain');
    expect(h.fn('wearCall_', 40, 80, s).kind).toBe('jacket-rain');
  });

  it('serves the board from cache on the next poll', () => {
    const h = setUp();
    const key = h.props.get('FB_KEY')!;
    const first = h.get({ action: 'board', k: key }) as Board;
    const fetches = h.fetched.length;
    const second = h.get({ action: 'board', k: key }) as Board;
    expect(h.fetched.length).toBe(fetches);
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(second.kitchen).toEqual({ count: 0, names: [] });
  });
});

describe('kitchen list', () => {
  let h: Harness;
  let k: string;
  const T0 = at('2026-11-15T16:00').getTime();
  beforeEach(() => {
    h = setUp();
    k = h.props.get('FB_KEY')!;
  });
  const neededRows = () => h.ss.getSheetByName('Needed')!.table();

  it('marks an item needed once, no matter how many taps', () => {
    const a: KitchenState = h.fn('need_', { itemId: 'milk' }, T0);
    const b: KitchenState = h.fn('need_', { itemId: 'milk' }, T0 + 2000);
    expect(a.added).toBe(true);
    expect(b.added).toBe(false);
    expect(b.needed.map((n) => n.itemId)).toEqual(['milk']);
    expect(neededRows()).toHaveLength(1);
    expect(h.ss.getSheetByName('Needed')!.checkboxes.has('2:5')).toBe(true);
  });

  it('adds one-off items by name and maps known names to their button', () => {
    const a: KitchenState = h.fn('need_', { name: '  Birthday   candles ' }, T0);
    expect(a.itemId).toBe('x-birthday-candles');
    expect(a.needed[0].name).toBe('Birthday candles');
    const b: KitchenState = h.fn('need_', { name: 'MILK' }, T0);
    expect(b.itemId).toBe('milk');
    expect(b.needed.map((n) => n.name)).toEqual(['Birthday candles', 'Milk']);
    expect(h.fn('need_', { name: '' }, T0)).toEqual({ ok: false, error: 'missing_item' });
  });

  it('allows undo within 30 seconds only', () => {
    h.fn('need_', { itemId: 'eggs' }, T0);
    const ok: KitchenState = h.fn('undo_', { itemId: 'eggs' }, T0 + 10000);
    expect(ok.undone).toBe(true);
    expect(ok.needed).toEqual([]);

    h.fn('need_', { itemId: 'eggs' }, T0);
    const late: KitchenState = h.fn('undo_', { itemId: 'eggs' }, T0 + 31000);
    expect(late.undone).toBe(false);
    expect(late.error).toBe('undo_expired');
    expect(late.needed.map((n) => n.itemId)).toEqual(['eggs']);
  });

  it('clears an item on "got it" and tidies the row away a day later', () => {
    h.fn('need_', { itemId: 'bread' }, T0);
    const g: KitchenState = h.fn('gotIt_', { itemId: 'bread' }, T0 + 60000);
    expect(g.cleared).toBe(true);
    expect(g.needed).toEqual([]);
    expect(neededRows()[0]['Got it']).toBe(true);
    h.fn('kitchenState_', T0 + 26 * 3600000);
    expect(neededRows()).toHaveLength(0);
    // Needing it again after buying opens a fresh entry.
    expect((h.fn('need_', { itemId: 'bread' }, T0 + 27 * 3600000) as KitchenState).added).toBe(true);
  });

  it('a "Got it" ticked on a phone stamps the time and is logged', () => {
    h.fn('need_', { itemId: 'coffee' }, T0);
    const sh = h.ss.getSheetByName('Needed')!;
    sh.getRange(2, 5).setValue(true);
    h.fn('onEdit', { range: sh.getRange(2, 5), source: h.ss });
    expect(neededRows()[0].gotAt).toBeInstanceOf(Date);
    expect((h.fn('kitchenState_', T0) as KitchenState).needed).toEqual([]);
    const log = h.ss.getSheetByName('Log')!.table();
    expect(log.map((l) => `${l.action}:${l.itemId}:${l.source}`)).toEqual(['need:coffee:fridge', 'gotit:coffee:phone']);
  });

  it('leaves retired buttons out of the board', () => {
    const items = h.ss.getSheetByName('Items')!;
    const row = items.rows.findIndex((r) => r[0] === 'chips');
    items.rows[row][5] = false;
    const st: KitchenState = h.fn('kitchenState_', T0);
    expect(st.items.find((i) => i.id === 'chips')).toBeUndefined();
    expect(st.items[0]).toMatchObject({ id: 'milk', category: 'Dairy', emoji: '🥛' });
  });

  it('the web app requires the key and takes text/plain JSON posts', () => {
    expect(h.get({ action: 'ping' })).toEqual({ ok: false, error: 'bad_key' });
    expect(h.get({ action: 'ping', k: k.slice(0, -1) + (k.endsWith('a') ? 'b' : 'a') })).toEqual({ ok: false, error: 'bad_key' });
    expect(h.get({ action: 'ping', k })).toMatchObject({ ok: true, v: 1 });
    expect(h.post({ action: 'need', itemId: 'milk', k })).toMatchObject({ ok: true, added: true });
    expect(h.post({ action: 'need', itemId: 'milk' })).toEqual({ ok: false, error: 'bad_key' });
    expect((h.get({ action: 'state', k }) as KitchenState).needed.map((n) => n.itemId)).toEqual(['milk']);
    expect((h.get({ action: 'board', k }) as Board).kitchen).toEqual({ count: 1, names: ['Milk'] });
    expect(h.get({ action: 'nope', k })).toEqual({ ok: false, error: 'unknown_action' });
    const bad = h.fn('doPost', { parameter: {}, postData: { contents: '{nope' } });
    expect(JSON.parse(bad.content)).toEqual({ ok: false, error: 'bad_json' });
  });

  it('supports a JSONP-style GET fallback with a safe callback name', () => {
    const out = h.fn('doGet', { parameter: { action: 'ping', k, callback: 'fbCb1' } });
    expect(out.content.startsWith('fbCb1({"ok":true')).toBe(true);
    const evil = h.fn('doGet', { parameter: { action: 'ping', k, callback: 'alert(1)//' } });
    expect(evil.content.startsWith('{')).toBe(true);
  });
});

describe('board: on TV tonight', () => {
  const espnUrls = (h: Harness) => h.fetched.filter((u) => u.includes('site.api.espn.com'));
  const line = (g: TvGame) => `${g.awayRank ? `#${g.awayRank} ` : ''}${g.away} @ ${g.homeRank ? `#${g.homeRank} ` : ''}${g.home} · ${g.time} · ${g.network}${g.live ? ' · live' : ''}`;
  const tvAt = (h: Harness, local: string) => (h.fn('buildBoard_', at(local).getTime()) as Board).tv!;

  it('asks ESPN for the local date, with the FBS group for college', () => {
    const h = setUp(espnFetch({}));
    // 11:30 pm Saturday in New York is already Sunday in UTC.
    tvAt(h, '2026-11-07T23:30');
    const urls = espnUrls(h);
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => u.includes('dates=20261107'))).toBe(true);
    expect(urls.find((u) => u.includes('/football/nfl/'))).toBeTruthy();
    expect(urls.find((u) => u.includes('/basketball/nba/'))).toBeTruthy();
    expect(urls.find((u) => u.includes('/college-football/'))).toContain('&groups=80&limit=300');
  });

  it('lists NFL and NBA games on national networks only, with network names', () => {
    const h = setUp(espnFetch(TV_DAYS.thursday));
    const tv = tvAt(h, '2026-11-12T19:45');
    expect(tv.error).toBeUndefined();
    // Local-only NBA games (regional sports networks) and the unranked ESPN college game are out.
    expect(tv.games.map(line)).toEqual([
      'Celtics @ 76ers · 7:30 · Prime Video · live',
      'Bears @ Packers · 8:15 · Prime Video',
      'Nuggets @ Lakers · 10:00 · Prime Video',
    ]);
    expect(tv.games.map((g) => g.league)).toEqual(['nba', 'nfl', 'nba']);
    expect(tv.more).toBe(0);
    // Never a channel number, a local station or a radio network.
    expect(JSON.stringify(tv)).not.toMatch(/WLUK|Westwood|FDSN|KJZZ|Altitude/);
  });

  it('reads networks from geoBroadcasts too, and spells them the same way', () => {
    const h = setUp(espnFetch({
      nfl: [{ away: T.chiefs, home: T.broncos, at: '2026-11-12T20:15', nets: [], geo: [{ type: 'TV', market: 'National', name: 'NFL Net' }] }],
      nba: [{ away: T.knicks, home: T.heat, at: '2026-11-12T19:30', nets: ['ESPN', 'espn'], geo: [{ type: 'Streaming', market: 'National', name: 'ESPN+' }] }],
    }));
    expect(tvAt(h, '2026-11-12T12:00').games.map(line)).toEqual(['Knicks @ Heat · 7:30 · ESPN', 'Chiefs @ Broncos · 8:15 · NFL Network']);
  });

  it('lets the Sheet replace the NFL/NBA network list', () => {
    const h = setUp(espnFetch(TV_DAYS.thursday));
    setSetting(h, 'tvNetworks', 'ESPN, nfl net, amazon prime');
    expect(tvAt(h, '2026-11-12T19:45').games).toHaveLength(3);
    setSetting(h, 'tvNetworks', 'ESPN, NBC');
    h.cache.clear();
    expect(tvAt(h, '2026-11-12T19:45').games).toEqual([]);
  });

  it('college: a Top 25 team on TV, or any game on ABC, CBS, NBC or FOX', () => {
    const h = setUp(espnFetch({ cfb: TV_DAYS.saturday.cfb }));
    const tv = tvAt(h, '2026-11-14T10:00');
    const shown = tv.games.map((g) => `${g.away} @ ${g.home}`);
    expect(shown).toContain('Ohio State @ Purdue'); // ranked, FOX
    expect(shown).toContain('Northwestern @ Iowa'); // unranked, but ABC
    expect(shown).toContain('Illinois @ Rutgers'); // ranked, BTN (Big Ten Network)
    expect(shown).toContain('Texas A&M @ Missouri'); // ranked, SEC Network
    expect(shown).not.toContain('Wake Forest @ Duke'); // unranked on ESPN
    expect(shown).not.toContain('Kansas @ Baylor'); // unranked on FS1
    expect(shown).not.toContain('Memphis @ UTSA'); // ranked, but only on ESPN+ (streaming)
    const big = tv.games.find((g) => g.away === 'Penn State')!;
    expect(line(big)).toBe('#9 Penn State @ #3 Michigan · 3:30 · ABC / ESPN2');
    expect(tv.games.find((g) => g.away === 'Northwestern')).not.toHaveProperty('awayRank');
  });

  it('drops finished games and keeps live ones, marked live', () => {
    const h = setUp(espnFetch({ nfl: TV_DAYS.sunday.nfl }));
    const tv = tvAt(h, '2026-11-15T15:40');
    const by = (away: string) => tv.games.find((g) => g.away === away);
    expect(by('Bills')).toBeUndefined(); // final
    expect(by('Lions')!.live).toBe(true);
    expect(by('Chiefs')!.live).toBe(false);
    // ESPN still says "pre" a minute after kickoff: past its start counts as on.
    const late = setUp(espnFetch({ nfl: [{ away: T.bears, home: T.packers, at: '2026-11-12T20:15', nets: ['Prime Video'], state: 'pre' }] }));
    expect(tvAt(late, '2026-11-12T20:17').games[0].live).toBe(true);
  });

  it('writes local times across both daylight-saving changes', () => {
    // Sun Nov 1, 2026: clocks fall back at 2 am. Sun Mar 14, 2027: they spring forward.
    const fall = setUp(espnFetch({ nfl: [
      { away: T.bills, home: T.jets, at: '2026-11-01T09:30', nets: ['NFL Network'] },
      { away: T.lions, home: T.vikings, at: '2026-11-01T13:00', nets: ['FOX'] },
      { away: T.cowboys, home: T.niners, at: '2026-11-01T20:20', nets: ['NBC'] },
    ] }));
    const f = tvAt(fall, '2026-11-01T08:00');
    expect(espnUrls(fall)[0]).toContain('dates=20261101');
    expect(f.games.map((g) => `${g.time} ${g.ampm}`)).toEqual(['9:30 am', '1:00 pm', '8:20 pm']);
    expect(f.games[1].start).toBe(Date.UTC(2026, 10, 1, 18, 0)); // EST, UTC-5
    const spring = setUp(espnFetch({ nba: [
      { away: T.celtics, home: T.knicks, at: '2027-03-14T13:00', nets: ['ABC'] },
      { away: T.lakers, home: T.warriors, at: '2027-03-14T20:30', nets: ['NBC'] },
    ] }));
    const s = tvAt(spring, '2027-03-14T09:00');
    expect(espnUrls(spring)[0]).toContain('dates=20270314');
    expect(s.games.map((g) => `${g.time} ${g.ampm}`)).toEqual(['1:00 pm', '8:30 pm']);
    expect(s.games[0].start).toBe(Date.UTC(2027, 2, 14, 17, 0)); // EDT, UTC-4
    expect(s.games.every((g) => g.day === '2027-03-14')).toBe(true);
  });

  it('caps the list at 8 by start time and counts the rest', () => {
    const h = setUp(espnFetch(TV_DAYS.saturday));
    const tv = tvAt(h, '2026-11-14T12:40');
    expect(tv.games).toHaveLength(8);
    expect(tv.more).toBe(3);
    const starts = tv.games.map((g) => g.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(tv.games.map((g) => g.away)).not.toContain('Warriors'); // 8:30 pm, past the cap
  });

  it('highlights games of ticked sports calendars, and never caps them away', () => {
    const h = setUp(espnFetch(TV_DAYS.sunday));
    let tv = tvAt(h, '2026-11-15T15:40');
    expect(tv.games).toHaveLength(8);
    expect(tv.more).toBe(2);
    const steelers = tv.games.find((g) => g.away === 'Steelers')!;
    expect(steelers).toMatchObject({ fav: 'steelers', time: '8:20', network: 'NBC / Peacock' });
    expect(tv.games.find((g) => g.away === 'Titans')).not.toHaveProperty('fav'); // calendar not ticked
    expect(tv.games.filter((g) => g.fav)).toHaveLength(1);
    // Tick the Titans: their game gets highlighted too.
    calRow(h, 'Tennessee Titans')[0] = true;
    h.cache.clear();
    tv = tvAt(h, '2026-11-15T15:40');
    expect(tv.games.find((g) => g.away === 'Titans')!.fav).toBe('titans');
    // A college team that shares a nickname isn't mistaken for the pros.
    expect(h.fn('favOf_', { league: 'cfb', away: 'Tennessee', home: 'Kentucky', awayFull: 'Tennessee Volunteers', homeFull: 'Kentucky Wildcats' }, h.fn('tvFavs_', h.fn('readCalendarRows_')))).toBe('');
  });

  it('caches the listing for 20 minutes, like the weather', () => {
    const h = setUp(espnFetch(TV_DAYS.thursday));
    tvAt(h, '2026-11-12T19:45');
    expect(espnUrls(h)).toHaveLength(3);
    tvAt(h, '2026-11-12T19:50');
    expect(espnUrls(h)).toHaveLength(3);
    expect([...h.cache.keys()]).toContain('fb_tv_2026-11-12_nflnbacfb');
  });

  it('follows tvLeagues, and "none" hides the card without calling ESPN', () => {
    const h = setUp(espnFetch(TV_DAYS.thursday));
    setSetting(h, 'tvLeagues', 'NBA');
    const tv = tvAt(h, '2026-11-12T19:45');
    expect(espnUrls(h)).toHaveLength(1);
    expect(tv.games.every((g) => g.league === 'nba')).toBe(true);
    setSetting(h, 'tvLeagues', 'none');
    expect(tvAt(h, '2026-11-12T19:45')).toEqual({ games: [], more: 0 });
    expect(espnUrls(h)).toHaveLength(1);
  });

  it('turns ESPN failures into tv.error without breaking the board', () => {
    const cases: [Parameters<typeof espnFetch>[0], string][] = [
      [{ nfl: { code: 500 }, nba: { code: 500 }, cfb: { code: 500 } }, 'espn_http_500'],
      [{ nfl: { code: 200, text: '<html>oops' }, nba: { code: 200, text: 'nope' }, cfb: { code: 200, text: '' } }, 'espn_bad_json'],
      [{ nfl: { code: 200, text: '{"sports":[]}' }, nba: { code: 200, text: '{"events":{}}' }, cfb: { code: 200, text: 'null' } }, 'espn_shape'],
      // Events still listed, but the fields we read moved: also a shape change.
      [{ nfl: { code: 200, text: '{"events":[{"id":"1","date":"2026-11-12T01:15Z","matchup":{}}]}' }, nba: { code: 404 }, cfb: { code: 404 } }, 'espn_shape'],
    ];
    for (const [day, error] of cases) {
      const h = setUp(espnFetch(day));
      const b = h.fn('buildBoard_', at('2026-11-12T19:45').getTime()) as Board;
      expect(b.ok).toBe(true);
      expect(b.events.length).toBeGreaterThan(0);
      expect(b.tv).toEqual({ error, games: [], more: 0 });
      expect([...h.cache.keys()].some((k) => k.startsWith('fb_tv'))).toBe(false); // errors aren't cached
    }
    const thrown = setUp((url) => {
      if (url.includes('site.api.espn.com')) throw new Error('DNS error: site.api.espn.com');
      return undefined;
    });
    expect(tvAt(thrown, '2026-11-12T19:45')).toEqual({ error: 'espn_unreachable', games: [], more: 0 });
  });

  it('keeps the leagues that worked when one fails, and tries the failed one again', () => {
    const h = setUp(espnFetch({ ...TV_DAYS.thursday, nba: { code: 503 } }));
    const tv = tvAt(h, '2026-11-12T19:45');
    expect(tv.error).toBeUndefined();
    expect(tv.failed).toEqual(['nba']);
    expect(tv.games.map((g) => g.away)).toEqual(['Bears']);
    tvAt(h, '2026-11-12T19:50');
    expect(espnUrls(h)).toHaveLength(6);
  });

  it('setup adds the TV rows to an older Settings tab', () => {
    const h = setUp();
    const sh = h.ss.getSheetByName('Settings')!;
    sh.rows = sh.rows.filter((r) => r[0] !== 'tvLeagues' && r[0] !== 'tvNetworks');
    h.fn('setup');
    const settings = Object.fromEntries(sh.rows.slice(1).map((r) => [r[0], r[1]]));
    expect(settings.tvLeagues).toBe('nfl, nba, cfb');
    expect(settings.tvNetworks).toBe('');
    expect(settings.weatherPlace).toBe('Springfield');
  });
});
