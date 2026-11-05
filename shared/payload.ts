/**
 * The one data contract between the Google side (apps-script/Code.gs) and the dashboard.
 * Code.gs is plain Apps Script and can't import this file, so tests check its output against
 * these shapes. Bump SCHEMA_VERSION on any breaking change; the dashboard refuses unknown majors.
 */
export const SCHEMA_VERSION = 1;

export type CalendarKind = 'personal' | 'family' | 'sports' | 'holidays' | 'travel' | 'other';

export interface CalendarInfo {
  key: string;
  label: string;
  kind: CalendarKind;
  color: string;
  /** Second team color for sports (black for the Steelers). Empty otherwise. */
  accent: string;
}

/** Local calendar date, "YYYY-MM-DD", in the board's time zone. */
export type DayKey = string;

export interface BoardEvent {
  title: string;
  /** Calendar keys; more than one when the same event sits on two calendars. */
  cals: string[];
  kind: CalendarKind;
  allDay: boolean;
  /** Counts toward busy time. Sports and holidays never do. */
  busy: boolean;
  day: DayKey;
  /** All-day: exclusive end date, as in iCal. Timed: the local date the event ends. */
  endDay: DayKey;
  /** Epoch ms; null for all-day events. */
  start: number | null;
  end: number | null;
  /** Local start like "4:30", plus "am"/"pm". Timed events only. */
  time?: string;
  ampm?: string;
  endTime?: string;
  /** Sports kickoff at 8 pm or later. */
  late?: boolean;
}

/** A trip, stripped to dates. No titles, places or notes ever reach the fridge. */
export interface AwayRange {
  start: number;
  end: number;
  firstDay: DayKey;
  lastDay: DayKey;
  /** "9:15 pm" when the trip ends with a timed event (a flight home), else "". */
  backTime: string;
  label: string;
}

export type WeatherIcon = 'sun' | 'moon' | 'partly' | 'partly-night' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherDay {
  day: DayKey;
  dow: string;
  hi: number;
  lo: number;
  pop: number;
  icon: WeatherIcon;
  text: string;
  sunrise?: string;
  sunset?: string;
}

export interface Weather {
  error?: string;
  now?: { temp: number; feels: number; text: string; icon: WeatherIcon };
  today?: WeatherDay | null;
  hours?: { t: number; label: string; temp: number; pop: number; icon: WeatherIcon }[];
  days?: WeatherDay[];
  call?: { kind: 'jacket' | 'rain' | 'jacket-rain' | 'tshirt'; text: string };
}

export interface KitchenSummary {
  count: number;
  /** Newest first, at most six. */
  names: string[];
}

/** From the Sheet's Settings tab, so the family can tune them from a phone. */
export interface DisplaySettings {
  nightStartHour: number;
  nightEndHour: number;
  tomorrowPeekHour: number;
  staleAfterMinutes: number;
}

export interface Board {
  ok: true;
  schemaVersion: number;
  generatedAt: number;
  serverTime: number;
  timezone: string;
  /** Offset of the board's time zone at generatedAt, in minutes (EST is -300). */
  tzOffsetMin: number;
  today: DayKey;
  calendars: CalendarInfo[];
  events: BoardEvent[];
  away: AwayRange[];
  weather: Weather;
  kitchen: KitchenSummary;
  display: DisplaySettings;
  errors: { cal: string; error: string }[];
}

export interface KitchenItem {
  id: string;
  name: string;
  category: string;
  emoji: string;
  sortOrder: number;
}

export interface NeededItem {
  itemId: string;
  name: string;
  addedAt: number;
  source: string;
}

export interface KitchenState {
  ok: true;
  items: KitchenItem[];
  needed: NeededItem[];
  serverTime: number;
  added?: boolean;
  undone?: boolean;
  cleared?: boolean;
  itemId?: string;
  error?: string;
}

export interface ApiError {
  ok: false;
  error: string;
}

/** What the fridge needs to reach the Google side. Ships only inside the encrypted config. */
export interface FridgeConfig {
  schemaVersion: number;
  endpointUrl: string;
  key: string;
}
