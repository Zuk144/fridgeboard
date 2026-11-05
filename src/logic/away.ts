/** "Dad's away" wording and where the trip arrow sits in the week. Pure. */
import type { AwayRange, DayKey } from '../../shared/payload';
import { DOW_LONG, DOW_SHORT, addDays, daysBetween, dowOf, shortDate } from './time';

export function awayOn(away: AwayRange[], key: DayKey): AwayRange | null {
  for (const r of away || []) if (r.firstDay <= key && key <= r.lastDay) return r;
  return null;
}

/** "9:15 pm" → "night"; "" → "". */
export function partOfDay(backTime: string): '' | 'morning' | 'afternoon' | 'evening' | 'night' {
  const m = /^(\d{1,2}):\d{2}\s*(am|pm)$/i.exec((backTime || '').trim());
  if (!m) return '';
  const h = (Number(m[1]) % 12) + (m[2].toLowerCase() === 'pm' ? 12 : 0);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

/** "Tue–Thu", "today", "on Friday", or "Nov 17–28" for long trips. */
function rangeText(r: AwayRange, today: DayKey): string {
  if (r.firstDay === r.lastDay) return r.firstDay === today ? 'today' : `on ${DOW_LONG[dowOf(r.firstDay)]}`;
  if (daysBetween(r.firstDay, r.lastDay) <= 6) return `${DOW_SHORT[dowOf(r.firstDay)]}–${DOW_SHORT[dowOf(r.lastDay)]}`;
  return `${shortDate(r.firstDay)}–${shortDate(r.lastDay)}`;
}

/** "back Thursday night", "back tonight", "back tomorrow afternoon", or "" with no flight home. */
export function backText(r: AwayRange, today: DayKey): string {
  const part = partOfDay(r.backTime);
  if (!part) return '';
  if (r.lastDay === today) {
    return part === 'night' ? 'back tonight' : `back this ${part}`;
  }
  if (r.lastDay === addDays(today, 1)) return `back tomorrow ${part}`;
  return `back ${DOW_LONG[dowOf(r.lastDay)]} ${part}`;
}

/** Banner on a day of the trip: "Dad's away Tue–Thu, back Thursday night". */
export function awayBanner(r: AwayRange, today: DayKey): string {
  const back = backText(r, today);
  return `${r.label} ${rangeText(r, today)}${back ? `, ${back}` : ''}`;
}

/** Under the week arrow: "Dad's away · back Thu night". */
export function awayArrowText(r: AwayRange): string {
  const part = partOfDay(r.backTime);
  return part ? `${r.label} · back ${DOW_SHORT[dowOf(r.lastDay)]} ${part}` : r.label;
}

/** Column span of a trip within the week's days, or null if it misses the week. */
export function awaySpan(r: AwayRange, days: DayKey[]): { from: number; to: number; clipStart: boolean; clipEnd: boolean } | null {
  if (!days.length || r.lastDay < days[0] || r.firstDay > days[days.length - 1]) return null;
  let from = 0;
  let to = days.length - 1;
  while (days[from] < r.firstDay) from++;
  while (days[to] > r.lastDay) to--;
  return { from, to, clipStart: r.firstDay < days[0], clipEnd: r.lastDay > days[days.length - 1] };
}
