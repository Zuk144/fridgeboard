/**
 * Fake boards for the dashboard: the real Code.gs runs in the harness against fake calendars,
 * fake weather and a fake kitchen list, so every fixture matches what the live script sends.
 * Everything here is made up except public sports and holiday dates (frame §5.5).
 *
 * Used by the unit tests and, in `npm run dev` only, by `?fixture=<name>` (vite.config.ts serves
 * them from /__fixture/<name>). Nothing here is bundled into the published site.
 */
import { loadCode, at, type FakeCalendarSpec, type FakeEventSpec } from '../gas-harness';
import type { Board } from '../../shared/payload';
import { TV_DAYS, espnFetch } from './espn';

const NY = 'America/New_York';

function ev(title: string, day: string, start: string, end: string, extra: Partial<FakeEventSpec> = {}): FakeEventSpec {
  const endDay = end < start ? nextDay(day) : day;
  return { title, start: at(`${day}T${start}`), end: at(`${endDay}T${end}`), ...extra };
}

function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** All-day block [first, endExclusive), handed back the way Google does for a calendar in `tz`. */
function allDay(title: string, first: string, endExclusive: string, tz = NY, extra: Partial<FakeEventSpec> = {}): FakeEventSpec {
  const mid = (d: string) => (tz === 'UTC' ? new Date(`${d}T00:00:00Z`) : at(`${d}T00:00`, tz));
  return { title, allDayStart: mid(first), allDayEnd: mid(endExclusive), ...extra };
}

const dad: FakeCalendarSpec = {
  id: 'dad@example.com', name: 'dad@example.com', tz: NY, primary: true,
  events: [
    ev('Trash out', '2026-11-09', '19:00', '19:15'),
    ev('Lunch with Mike', '2026-11-12', '12:00', '13:00'),
    ev('Costco run', '2026-11-14', '11:30', '12:15'),
    ev('Grandma & Grandpa over', '2026-11-15', '13:00', '15:30'),
    ev('Taco night', '2026-11-15', '18:00', '19:00'),
    ev('Coffee with Jen', '2026-11-16', '08:00', '08:45'),
    ev('Quarterly review prep', '2026-11-16', '10:00', '11:00'),
    ev('Trash out', '2026-11-16', '19:00', '19:15'),
    // A work trip: only its dates may reach the fridge.
    ev('Flight to Denver UA 123', '2026-11-17', '07:00', '09:30'),
    allDay('Hotel: Marriott Denver Tech Center', '2026-11-17', '2026-11-19'),
    ev('Flight home UA 456', '2026-11-19', '18:00', '21:15'),
    ev('Movie marathon', '2026-11-20', '21:30', '00:30'),
    ev('Trash out', '2026-11-23', '19:00', '19:15'),
    ev('Pick up the turkey', '2026-11-25', '17:00', '17:30'),
    ev('Trash out', '2026-11-30', '19:00', '19:15'),
  ],
};

// The real Family calendar's own time zone is UTC; the script must not shift its all-day dates.
const family: FakeCalendarSpec = {
  id: 'family0001@group.calendar.google.com', name: 'Family', tz: 'UTC',
  events: [
    allDay('Picture day', '2026-11-10', '2026-11-11', 'UTC'),
    ev('Taco night', '2026-11-10', '18:00', '19:00'),
    ev('Soccer practice', '2026-11-11', '17:30', '18:45'),
    ev('Drop off science project', '2026-11-12', '08:00', '08:30'),
    ev('Piano lesson', '2026-11-12', '16:30', '17:15'),
    ev('Scouts', '2026-11-12', '18:30', '19:30'),
    ev('Pizza + movie night', '2026-11-13', '18:30', '21:00'),
    allDay('Bake sale at school', '2026-11-14', '2026-11-15', 'UTC'),
    ev('Swim lessons', '2026-11-14', '08:00', '08:45'),
    ev('Soccer game · Field 3', '2026-11-14', '09:00', '10:15'),
    ev('Haircuts', '2026-11-14', '10:30', '11:00'),
    ev("Lunch at Nonna's", '2026-11-14', '12:30', '13:30'),
    ev("Ava's birthday party", '2026-11-14', '14:00', '16:00'),
    ev('Piano recital', '2026-11-14', '16:30', '17:30'),
    ev('Dinner with the Parks', '2026-11-14', '18:00', '19:30'),
    ev('Family movie night', '2026-11-14', '19:45', '21:30'),
    ev('Pancake breakfast', '2026-11-15', '09:00', '10:00'),
    ev('Soccer game · Field 3', '2026-11-15', '10:30', '11:45'),
    ev('Piano lesson', '2026-11-15', '16:30', '17:15'),
    ev('Taco night', '2026-11-15', '18:00', '19:00'),
    allDay('Book fair', '2026-11-17', '2026-11-18', 'UTC'),
    ev('Taco night', '2026-11-17', '18:00', '19:00'),
    ev('Soccer practice', '2026-11-18', '17:30', '18:45'),
    ev('Piano lesson', '2026-11-19', '16:30', '17:15'),
    allDay('Grandma visiting', '2026-11-20', '2026-11-23', 'UTC'),
    ev('Pizza night', '2026-11-20', '18:30', '19:30'),
    ev('Soccer game · Field 3', '2026-11-21', '09:00', '10:15'),
    ev("Leo's party", '2026-11-21', '14:00', '16:00'),
    ev('Brunch with Grandma', '2026-11-22', '11:00', '12:30'),
    ev('Scouts', '2026-11-23', '18:00', '19:00'),
    allDay('Half day at school', '2026-11-24', '2026-11-25', 'UTC'),
    ev('Taco night', '2026-11-24', '18:00', '19:00'),
    allDay('No school', '2026-11-25', '2026-11-28', 'UTC'),
    ev("Thanksgiving dinner at Aunt Rose's", '2026-11-26', '15:00', '19:00'),
    ev('Christmas tree farm', '2026-11-28', '10:00', '12:00'),
    ev('Piano lesson', '2026-12-03', '16:30', '17:15'),
  ],
};

const appointments: FakeCalendarSpec = {
  id: 'appt0001@group.calendar.google.com', name: 'Appointment', tz: NY,
  events: [
    ev('Dentist - kids', '2026-11-16', '15:15', '16:00'),
    ev('Physical - Dad', '2026-11-24', '09:00', '09:30'),
  ],
};

const PUBLIC = 'Public holiday';
const OBS = 'Observance\nTo hide observances, go to Google Calendar Settings > Holidays in United States';
const holidays: FakeCalendarSpec = {
  id: 'en.usa#holiday@group.v.calendar.google.com', name: 'Holidays in United States', tz: NY,
  events: [
    allDay('Daylight Saving Time ends', '2026-11-01', '2026-11-02', NY, { description: OBS, transparent: true }),
    allDay('Veterans Day', '2026-11-11', '2026-11-12', NY, { description: PUBLIC, transparent: true }),
    allDay('Thanksgiving Day', '2026-11-26', '2026-11-27', NY, { description: PUBLIC, transparent: true }),
    allDay('Black Friday', '2026-11-27', '2026-11-28', NY, { description: OBS, transparent: true }),
    allDay('Christmas Eve', '2026-12-24', '2026-12-25', NY, { description: OBS, transparent: true }),
    allDay('Christmas Day', '2026-12-25', '2026-12-26', NY, { description: PUBLIC, transparent: true }),
  ],
};

// Public schedule (frame §5.5): times as published, Eastern.
const steelers: FakeCalendarSpec = {
  id: 'nfl_-m-05tfm_%50ittsburgh+%53teelers#sports@group.v.calendar.google.com', name: 'Pittsburgh Steelers', tz: NY,
  events: [
    ev('Steelers @ Bengals', '2026-11-15', '20:20', '23:20', { transparent: true }),
    ev('Steelers @ Eagles', '2026-11-22', '16:25', '19:25', { transparent: true }),
    ev('Broncos @ Steelers', '2026-11-27', '15:00', '18:00', { transparent: true }),
  ],
};

interface WeatherPreset {
  /** Mean temperature and swing over the day (peak mid-afternoon). */
  base: number;
  amp: number;
  code: number;
  isDay: 0 | 1;
  /** Rain chance by hour index from the scenario day's midnight. */
  pop: (i: number) => number;
  days: [code: number, hi: number, lo: number, pop: number][];
}

const WEATHER: Record<string, WeatherPreset> = {
  mild: { base: 64, amp: 7, code: 1, isDay: 1, pop: () => 0, days: [[1, 71, 57, 0], [2, 66, 50, 10], [3, 58, 44, 20], [61, 52, 41, 70], [3, 50, 40, 20]] },
  partly: { base: 46, amp: 6, code: 2, isDay: 1, pop: (i) => (i % 24 > 15 && i % 24 < 20 ? 20 : 5), days: [[2, 52, 38, 20], [3, 50, 39, 10], [3, 52, 39, 40], [0, 55, 38, 0], [2, 58, 44, 10]] },
  cloudy: { base: 45, amp: 7, code: 3, isDay: 1, pop: (i) => (i >= 19 && i <= 22 ? 40 : i % 24 > 12 ? 15 : 5), days: [[3, 52, 39, 40], [0, 55, 38, 0], [2, 58, 44, 10], [61, 51, 42, 70], [3, 49, 40, 20]] },
  clearNight: { base: 42, amp: 6, code: 0, isDay: 0, pop: () => 0, days: [[3, 52, 39, 40], [0, 55, 38, 0], [2, 58, 44, 10], [61, 51, 42, 70], [3, 49, 40, 20]] },
  evening: { base: 47, amp: 6, code: 1, isDay: 0, pop: () => 5, days: [[1, 53, 40, 0], [2, 49, 37, 10], [3, 47, 36, 20], [71, 38, 29, 60], [3, 41, 30, 20]] },
  rain: { base: 47, amp: 4, code: 61, isDay: 1, pop: (i) => (i % 24 < 14 ? 80 : 45), days: [[61, 50, 44, 90], [3, 52, 41, 30], [2, 54, 40, 10], [0, 57, 42, 0], [2, 55, 43, 10]] },
  cold: { base: 35, amp: 5, code: 71, isDay: 1, pop: (i) => (i % 24 > 14 ? 35 : 10), days: [[71, 40, 29, 40], [3, 38, 27, 20], [0, 42, 30, 0], [2, 45, 33, 10], [3, 43, 31, 30]] },
};

function weatherFor(day: string, p: WeatherPreset) {
  const t0 = at(`${day}T00:00`).getTime() / 1000;
  const hours = Array.from({ length: 120 }, (_, i) => i);
  const temps = hours.map((i) => p.base + p.amp * Math.sin((((i % 24) - 9) / 24) * 2 * Math.PI));
  const days = [0, 1, 2, 3, 4];
  const dayKey = (n: number) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return {
    current: { temperature_2m: p.base + p.amp * 0.6, apparent_temperature: p.base + p.amp * 0.6 - 3, weather_code: p.code, is_day: p.isDay },
    hourly: {
      time: hours.map((i) => t0 + i * 3600),
      temperature_2m: temps,
      precipitation_probability: hours.map(p.pop),
      weather_code: hours.map((i) => (p.pop(i) >= 50 ? p.code : p.code === 0 ? 0 : Math.min(p.code, 3))),
    },
    daily: {
      time: days.map((n) => at(`${dayKey(n)}T00:00`).getTime() / 1000),
      weather_code: p.days.map((d) => d[0]),
      temperature_2m_max: p.days.map((d) => d[1]),
      temperature_2m_min: p.days.map((d) => d[2]),
      precipitation_probability_max: p.days.map((d) => d[3]),
      sunrise: days.map((n) => at(`${dayKey(n)}T07:0${Math.min(9, n + 5)}`).getTime() / 1000),
      sunset: days.map((n) => at(`${dayKey(n)}T17:0${Math.max(0, 2 - n)}`).getTime() / 1000),
    },
  };
}

export interface Scenario {
  /** Local wall time on the fridge, America/New_York. */
  now: string;
  /** How long ago the script built the board. */
  updatedMinAgo: number;
  offline?: boolean;
  weather: keyof typeof WEATHER;
  /** Kitchen items marked "we're out", oldest first. */
  kitchen: string[];
  /** Personal calendars empty, only holidays and the Steelers (how the real calendars look today). */
  sparse?: boolean;
  /** Fake ESPN scoreboards for "On TV tonight" (test/fixtures/espn.ts); none = no games anywhere. */
  tv?: keyof typeof TV_DAYS;
  note: string;
}

export const SCENARIOS: Record<string, Scenario> = {
  weekday: { now: '2026-11-12T15:40', updatedMinAgo: 6, weather: 'mild', kitchen: ['cereal', 'bread', 'coffee', 'bananas', 'eggs', 'milk'], note: 'Normal Thursday afternoon' },
  busy: { now: '2026-11-14T11:05', updatedMinAgo: 3, weather: 'partly', kitchen: ['paper-towels', 'yogurt'], note: 'Saturday with nine things on' },
  empty: { now: '2026-11-09T10:15', updatedMinAgo: 4, weather: 'partly', kitchen: [], sparse: true, note: 'Nothing today (like the real calendars now)' },
  holiday: { now: '2026-11-11T09:20', updatedMinAgo: 2, weather: 'partly', kitchen: ['milk'], note: 'Veterans Day' },
  gameday: { now: '2026-11-15T15:40', updatedMinAgo: 6, weather: 'cloudy', kitchen: ['chips', 'bananas', 'eggs', 'milk', 'juice', 'bread'], note: 'Game day, before kickoff (the mockup)' },
  gameon: { now: '2026-11-22T17:30', updatedMinAgo: 1, weather: 'evening', kitchen: ['chips', 'juice'], note: 'Steelers @ Eagles is on' },
  peek: { now: '2026-11-15T19:00', updatedMinAgo: 2, weather: 'cloudy', kitchen: ['bananas', 'eggs', 'milk'], note: 'Sunday 7 pm: Tonight shrinks, Tomorrow grows' },
  night: { now: '2026-11-15T23:30', updatedMinAgo: 3, weather: 'clearNight', kitchen: ['milk'], note: 'Night mode' },
  travel: { now: '2026-11-18T08:10', updatedMinAgo: 5, weather: 'rain', kitchen: ['coffee'], note: "Dad's away Tue-Thu" },
  thanksgiving: { now: '2026-11-24T16:15', updatedMinAgo: 2, weather: 'cold', kitchen: ['butter', 'onions', 'bread', 'ice-cream'], note: 'Thanksgiving week' },
  stale: { now: '2026-11-12T15:40', updatedMinAgo: 195, offline: true, weather: 'mild', kitchen: ['milk'], note: 'Offline for over 3 hours' },
  offline: { now: '2026-11-12T15:40', updatedMinAgo: 25, offline: true, weather: 'mild', kitchen: ['milk', 'eggs'], note: 'Offline, 25 minutes old' },
  'tv-thursday': { now: '2026-11-12T19:45', updatedMinAgo: 4, weather: 'evening', kitchen: ['milk', 'eggs'], tv: 'thursday', note: 'Thursday night: TNF on Prime, NBA on now' },
  'tv-saturday': { now: '2026-11-14T12:40', updatedMinAgo: 3, weather: 'partly', kitchen: ['paper-towels', 'yogurt'], tv: 'saturday', note: 'Busy college football Saturday (capped at 8)' },
  'tv-sunday': { now: '2026-11-15T15:40', updatedMinAgo: 6, weather: 'cloudy', kitchen: ['chips', 'bananas', 'eggs', 'milk'], tv: 'sunday', note: 'Steelers Sunday with the early games on' },
  'tv-none': { now: '2026-11-10T18:30', updatedMinAgo: 2, weather: 'evening', kitchen: ['milk'], tv: 'quiet', note: 'Nothing on national TV: no card' },
};

export interface Fixture {
  name: string;
  /** Epoch ms the fridge's clock should read. */
  now: number;
  offline: boolean;
  note: string;
  board: Board;
}

function setSetting(rows: unknown[][], key: string, value: unknown) {
  const row = rows.find((r) => r[0] === key);
  if (row) row[1] = value;
}

export function makeFixture(name: string): Fixture | null {
  const s = SCENARIOS[name];
  if (!s) return null;
  const now = at(s.now).getTime();
  const generatedAt = now - s.updatedMinAgo * 60000;
  const cals = s.sparse
    ? [{ ...dad, events: [] }, { ...family, events: [] }, holidays, steelers]
    : [dad, family, appointments, holidays, steelers];
  const h = loadCode({ calendars: cals, weather: weatherFor(s.now.slice(0, 10), WEATHER[s.weather]), fetch: espnFetch(s.tv ? TV_DAYS[s.tv] : {}) });
  h.fn('setup');
  const settings = h.ss.getSheetByName('Settings')!.rows;
  setSetting(settings, 'lat', 35.2);
  setSetting(settings, 'lon', -85.2);
  setSetting(settings, 'hideKeywords', 'quarterly');
  const calRows = h.ss.getSheetByName('Calendars')!.rows;
  for (const r of calRows) {
    if (r[1] === 'Me') r[1] = 'Dad';
    if (r[5] === 'Appointment') {
      r[0] = true;
      r[3] = 'busy';
    }
  }
  s.kitchen.forEach((id, i) => h.fn('need_', { itemId: id }, generatedAt - (s.kitchen.length - i) * 3600000));
  const board = h.fn('board_', { fresh: '1' }, generatedAt) as Board;
  board.serverTime = generatedAt;
  return { name, now, offline: !!s.offline, note: s.note, board };
}
