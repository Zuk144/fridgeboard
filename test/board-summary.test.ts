import { describe, it, expect } from 'vitest';
import { loadCode, at } from './gas-harness';
import { TV_DAYS, espnFetch } from './fixtures/espn';
import { summarizeBoard } from '../scripts/board-summary';
import type { Board } from '../shared/payload';

describe('script-check summary', () => {
  it('reports counts without leaking titles, labels or places', () => {
    const h = loadCode({
      calendars: [
        { id: 'me@example.com', name: 'me@example.com', tz: 'America/New_York', primary: true, events: [
          { title: 'Secret surprise party', start: at('2026-11-15T18:00'), end: at('2026-11-15T20:00') },
          { title: 'Flight to Denver', start: at('2026-11-17T07:00'), end: at('2026-11-17T09:00') },
        ] },
      ],
      weather: { current: { temperature_2m: 50, apparent_temperature: 48, weather_code: 0, is_day: 1 },
        hourly: { time: [at('2026-11-15T15:00').getTime() / 1000], temperature_2m: [50], precipitation_probability: [0], weather_code: [0] },
        daily: { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [], sunrise: [], sunset: [] } },
      fetch: espnFetch(TV_DAYS.sunday),
    });
    h.fn('setup');
    const sh = h.ss.getSheetByName('Settings')!;
    sh.rows.find((r) => r[0] === 'lat')![1] = 35.2;
    sh.rows.find((r) => r[0] === 'lon')![1] = -85.2;
    const board = h.fn('board_', {}, at('2026-11-15T15:40').getTime()) as Board;
    const s = summarizeBoard(board, 1);
    expect(s.ok).toBe(true);
    expect(s.line).toBe('schema 1 · 1 calendars · 1 events · 1 trips · weather ok · 10 games on TV · list 0 needed');
    for (const word of ['Secret', 'surprise', 'Denver', 'Flight', 'Me', 'example', 'Steelers', 'NBC']) expect(s.line).not.toContain(word);
  });

  it('flags schema drift, calendar errors and missing weather', () => {
    const s = summarizeBoard({
      ok: true, schemaVersion: 2, calendars: [], events: [], away: [],
      weather: { error: 'no_location' }, kitchen: { count: 0, names: [] },
      errors: [{ cal: 'family', error: 'not_found' }],
    } as unknown as Board, 1);
    expect(s.ok).toBe(false);
    expect(s.line).toContain('schema 2 (expected 1)');
    expect(s.line).toContain('1 calendar error(s): not_found');
    expect(s.line).toContain('weather error no_location');
    expect(s.line).not.toContain('family');
    expect(s.line).toContain('tv not in board (old script)');
  });

  it('reports the TV list as a count or an error code, never failing the check for it', () => {
    const base = { ok: true, schemaVersion: 1, calendars: [], events: [], away: [], errors: [], kitchen: { count: 0, names: [] },
      weather: { now: { temp: 1 }, hours: [{}] } } as unknown as Board;
    const one = summarizeBoard({ ...base, tv: { games: [{ away: 'Bears' }], more: 0 } } as unknown as Board, 1);
    expect(one).toMatchObject({ ok: true });
    expect(one.line).toContain('1 game on TV');
    expect(one.line).not.toContain('Bears');
    const part = summarizeBoard({ ...base, tv: { games: [], more: 0, failed: ['nba'] } } as unknown as Board, 1);
    expect(part.line).toContain('0 games on TV (nba failed)');
    const err = summarizeBoard({ ...base, tv: { error: 'espn_http_500', games: [], more: 0 } } as unknown as Board, 1);
    expect(err).toMatchObject({ ok: true });
    expect(err.line).toContain('tv error espn_http_500');
  });
});
