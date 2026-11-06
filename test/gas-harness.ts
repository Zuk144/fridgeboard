/**
 * Runs apps-script/Code.gs in Node against fake Google services (Sheets, Calendar, Cache,
 * Properties, Lock, UrlFetch, Content), so the Google side can be tested without Google.
 * The fakes implement only what Code.gs calls.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const CODE = readFileSync(fileURLToPath(new URL('../apps-script/Code.gs', import.meta.url)), 'utf8');

type Cell = unknown;
const pad = (n: number) => (n < 10 ? '0' : '') + n;

/** Utilities.formatDate with the subset of Java patterns Code.gs uses. */
export function formatDate(date: Date, tz: string, pattern: string): string {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  }).formatToParts(date)) parts[p.type] = p.value;
  const H = Number(parts.hour) % 24;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, H, +parts.minute, +parts.second);
  const off = Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const abs = Math.abs(off);
  const h12 = H % 12 === 0 ? 12 : H % 12;
  const map: Record<string, string> = {
    yyyy: parts.year, MM: parts.month, dd: parts.day, HH: pad(H), H: String(H), hh: pad(h12), h: String(h12),
    mm: parts.minute, a: H < 12 ? 'AM' : 'PM', Z: (off < 0 ? '-' : '+') + pad(Math.floor(abs / 60)) + pad(abs % 60),
    EEE: parts.weekday,
  };
  return pattern.replace(/yyyy|MM|dd|HH|hh|EEE|H|h|mm|a|Z/g, (t) => map[t]);
}

export class FakeRange {
  constructor(private sh: FakeSheet, private r: number, private c: number, private nr = 1, private nc = 1) {}
  getValues(): Cell[][] {
    const out: Cell[][] = [];
    for (let i = 0; i < this.nr; i++) {
      const row: Cell[] = [];
      for (let j = 0; j < this.nc; j++) {
        const v = this.sh.rows[this.r - 1 + i]?.[this.c - 1 + j];
        row.push(v === undefined || v === null ? '' : v);
      }
      out.push(row);
    }
    return out;
  }
  getValue() { return this.getValues()[0][0]; }
  setValues(v: Cell[][]) {
    v.forEach((row, i) => row.forEach((val, j) => this.sh.set(this.r + i, this.c + j, val)));
    return this;
  }
  setValue(v: Cell) { this.sh.set(this.r, this.c, v); return this; }
  insertCheckboxes() {
    for (let i = 0; i < this.nr; i++) {
      for (let j = 0; j < this.nc; j++) {
        const cur = this.sh.rows[this.r - 1 + i]?.[this.c - 1 + j];
        if (cur === undefined || cur === '' || cur === null) this.sh.set(this.r + i, this.c + j, false);
        this.sh.checkboxes.add(`${this.r + i}:${this.c + j}`);
      }
    }
    return this;
  }
  getSheet() { return this.sh; }
  getRow() { return this.r; }
  getColumn() { return this.c; }
  setDataValidation() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
}

export class FakeSheet {
  rows: Cell[][] = [];
  checkboxes = new Set<string>();
  constructor(public name: string) {}
  getName() { return this.name; }
  set(r: number, c: number, v: Cell) {
    while (this.rows.length < r) this.rows.push([]);
    this.rows[r - 1][c - 1] = v;
  }
  getLastRow() {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if ((this.rows[i] || []).some((v) => v !== undefined && v !== '' && v !== null)) return i + 1;
    }
    return 0;
  }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, (r || []).length), 0); }
  getRange(r: number, c: number, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  appendRow(vals: Cell[]) { this.rows[this.getLastRow()] = [...vals]; return this; }
  deleteRow(n: number) { this.rows.splice(n - 1, 1); return this; }
  setFrozenRows() { return this; }
  setColumnWidth() { return this; }
  hideColumns() { return this; }
  /** Rows as objects keyed by the header row. */
  table(): Record<string, Cell>[] {
    const [head, ...rest] = this.rows;
    return rest.filter((r) => r && r.length).map((r) => Object.fromEntries((head as string[]).map((h, i) => [h, r[i]])));
  }
}

export class FakeSpreadsheet {
  sheets = new Map<string, FakeSheet>();
  getSheetByName(n: string) { return this.sheets.get(n) || null; }
  insertSheet(n: string) { const s = new FakeSheet(n); this.sheets.set(n, s); return s; }
}

export interface FakeEventSpec {
  title: string;
  /** Timed: absolute instants. */
  start?: Date;
  end?: Date;
  /** All-day: the Date objects Google hands back (midnight in some zone). */
  allDayStart?: Date;
  allDayEnd?: Date;
  description?: string;
  transparent?: boolean;
}

export interface FakeCalendarSpec {
  id: string;
  name: string;
  tz: string;
  primary?: boolean;
  events: FakeEventSpec[];
}

function fakeEvent(e: FakeEventSpec) {
  const allDay = !!e.allDayStart;
  const s = allDay ? e.allDayStart! : e.start!;
  const en = allDay ? e.allDayEnd! : e.end!;
  return {
    getTitle: () => e.title,
    isAllDayEvent: () => allDay,
    getAllDayStartDate: () => new Date(e.allDayStart!.getTime()),
    getAllDayEndDate: () => new Date(e.allDayEnd!.getTime()),
    getStartTime: () => new Date(s.getTime()),
    getEndTime: () => new Date(en.getTime()),
    getDescription: () => e.description || '',
    getTransparency: () => (e.transparent ? 'TRANSPARENT' : 'OPAQUE'),
    _s: s.getTime(),
    _e: en.getTime(),
  };
}

function fakeCalendar(c: FakeCalendarSpec) {
  const evs = c.events.map(fakeEvent);
  return {
    getId: () => c.id,
    getName: () => c.name,
    getTimeZone: () => c.tz,
    isMyPrimaryCalendar: () => !!c.primary,
    getEvents: (a: Date, b: Date) => evs.filter((e) => e._s < b.getTime() && e._e > a.getTime()),
  };
}

export interface Harness {
  ss: FakeSpreadsheet;
  props: Map<string, string>;
  cache: Map<string, string>;
  fetched: string[];
  /** Call any top-level function in Code.gs. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (name: string, ...args: unknown[]) => any;
  /** Simulate an HTTP GET/POST to the web app and parse the JSON reply. */
  get: (params: Record<string, string>) => unknown;
  post: (body: unknown, params?: Record<string, string>) => unknown;
  setCalendars: (cals: FakeCalendarSpec[]) => void;
}

/** A fake HTTP answer for UrlFetchApp. Return undefined to fall through to the weather fakes. */
export type FakeFetch = (url: string) => { code: number; text: string } | undefined;

export function loadCode(opts: { calendars?: FakeCalendarSpec[]; weather?: unknown; geocode?: unknown; fetch?: FakeFetch } = {}): Harness {
  const ss = new FakeSpreadsheet();
  const props = new Map<string, string>();
  const cache = new Map<string, string>();
  const fetched: string[] = [];
  let cals = (opts.calendars || []).map((c) => ({ spec: c, cal: fakeCalendar(c) }));

  const sandbox: Record<string, unknown> = {
    Date, JSON, Math, console: { log: () => {}, error: () => {} },
    Utilities: { formatDate, getUuid: () => randomUUID() },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      newDataValidation: () => {
        const b = { requireValueInList: () => b, build: () => ({}) };
        return b;
      },
    },
    CalendarApp: {
      getCalendarById: (id: string) => cals.find((c) => c.spec.id === id)?.cal || null,
      getAllCalendars: () => cals.map((c) => c.cal),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => (props.has(k) ? props.get(k)! : null),
        setProperty: (k: string, v: string) => { props.set(k, v); },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => (cache.has(k) ? cache.get(k)! : null),
        put: (k: string, v: string) => { cache.set(k, v); },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    UrlFetchApp: {
      fetch: (url: string) => {
        fetched.push(url);
        const custom = opts.fetch ? opts.fetch(url) : undefined;
        if (custom) return { getResponseCode: () => custom.code, getContentText: () => custom.text };
        if (url.includes('site.api.espn.com')) return { getResponseCode: () => 200, getContentText: () => '{"events":[]}' };
        const body = url.includes('geocoding') ? (opts.geocode ?? { results: [] }) : (opts.weather ?? {});
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
      },
    },
    ContentService: {
      MimeType: { JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: (s: string) => {
        const o = { content: s, mime: '', setMimeType(m: string) { o.mime = m; return o; } };
        return o;
      },
    },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(CODE, ctx, { filename: 'Code.gs' });

  const fn = (name: string, ...args: unknown[]) => {
    const f = (ctx as Record<string, unknown>)[name];
    if (typeof f !== 'function') throw new Error(`no function ${name} in Code.gs`);
    return (f as (...a: unknown[]) => unknown)(...args);
  };
  const parse = (out: { content: string }) => JSON.parse(out.content);
  return {
    ss, props, cache, fetched, fn,
    get: (params) => parse(fn('doGet', { parameter: params }) as { content: string }),
    post: (body, params = {}) => parse(fn('doPost', { parameter: params, postData: { contents: JSON.stringify(body), type: 'text/plain' } }) as { content: string }),
    setCalendars: (next) => { cals = next.map((c) => ({ spec: c, cal: fakeCalendar(c) })); },
  };
}

/** A Date for a wall-clock time in a zone, e.g. at('2026-11-15T20:20', 'America/New_York'). */
export function at(local: string, tz = 'America/New_York'): Date {
  const [d, t = '00:00'] = local.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  let guess = Date.UTC(y, m - 1, day, hh, mm);
  for (let i = 0; i < 3; i++) {
    const z = formatDate(new Date(guess), tz, 'Z');
    const off = (z[0] === '-' ? -1 : 1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5)));
    guess = Date.UTC(y, m - 1, day, hh, mm) - off * 60000;
  }
  return new Date(guess);
}
