/** Pure dashboard logic: days, week, next up, game state, night/peek, away, holidays, freshness. */
import { describe, it, expect } from 'vitest';
import type { AwayRange, BoardEvent } from '../shared/payload';
import { at } from './gas-harness';
import { addDays, clockFace, daysBetween, longDate, makeClock, offsetClock, relativeDay, wallToEpoch } from '../src/logic/time';
import { bucketDay, firstAfter, isOnDay, rollingWeek } from '../src/logic/days';
import { countdownText, eventState, pickNextUp, planTimeline } from '../src/logic/nextup';
import { gameState, kickoffText, pickGame } from '../src/logic/game';
import { burnInShift, isNight, isPeek, nightLookahead } from '../src/logic/modes';
import { awayArrowText, awayBanner, awayOn, awaySpan, backText, partOfDay } from '../src/logic/away';
import { holidayCountdown, majorName } from '../src/logic/holidays';
import { agoText, freshness, whenText } from '../src/logic/freshness';
import { contrast, readableInk } from '../src/logic/ink';

const NY = 'America/New_York';
const clock = makeClock(NY, -300);
const t = (local: string) => at(local, NY).getTime();

function timed(title: string, day: string, start: string, end: string, extra: Partial<BoardEvent> = {}): BoardEvent {
  const s = t(`${day}T${start}`);
  const e = t(`${day}T${end}`);
  const f = clockFace(clock(s));
  return { title, cals: ['family'], kind: 'family', allDay: false, busy: true, day, endDay: day, start: s, end: e, time: f.time, ampm: f.ampm, endTime: clockFace(clock(e)).time, ...extra };
}

function allDay(title: string, day: string, endDay: string, extra: Partial<BoardEvent> = {}): BoardEvent {
  return { title, cals: ['family'], kind: 'family', allDay: true, busy: false, day, endDay, start: null, end: null, ...extra };
}

describe('time', () => {
  it('reads wall time in New York through both 2026 DST changes', () => {
    expect(clock(Date.parse('2026-03-08T06:59:00Z'))).toMatchObject({ dayKey: '2026-03-08', hour: 1, minute: 59 });
    expect(clock(Date.parse('2026-03-08T07:00:00Z'))).toMatchObject({ hour: 3, minute: 0 });
    expect(clock(Date.parse('2026-11-01T05:30:00Z'))).toMatchObject({ hour: 1, minute: 30 });
    expect(clock(Date.parse('2026-11-01T06:30:00Z'))).toMatchObject({ hour: 1, minute: 30 });
    expect(clock(Date.parse('2026-11-16T04:59:00Z'))).toMatchObject({ dayKey: '2026-11-15', hour: 23, dow: 0 });
  });

  it('falls back to the board offset when Intl cannot do the zone', () => {
    const bad = makeClock('Not/AZone', -300);
    expect(bad(Date.parse('2026-11-15T20:40:00Z'))).toMatchObject({ dayKey: '2026-11-15', hour: 15, minute: 40 });
    expect(offsetClock(-240)(Date.parse('2026-07-04T03:30:00Z'))).toMatchObject({ dayKey: '2026-07-03', hour: 23 });
  });

  it('turns a local wall time into the right instant (the dev ?now= override)', () => {
    expect(wallToEpoch(2026, 11, 15, 19, 30, clock)).toBe(t('2026-11-15T19:30'));
    expect(wallToEpoch(2026, 7, 4, 9, 0, clock)).toBe(Date.parse('2026-07-04T13:00:00Z'));
  });

  it('does day math on keys and writes dates like a person would', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(daysBetween('2026-11-15', '2026-11-26')).toBe(11);
    expect(longDate('2026-11-15')).toBe('Sunday, November 15');
    expect(clockFace(clock(t('2026-11-15T00:05')))).toEqual({ time: '12:05', ampm: 'am' });
    expect(clockFace(clock(t('2026-11-15T12:00')))).toEqual({ time: '12:00', ampm: 'pm' });
    expect(relativeDay('2026-11-15', '2026-11-16')).toBe('tomorrow');
    expect(relativeDay('2026-11-15', '2026-11-18')).toBe('Wednesday');
    expect(relativeDay('2026-11-15', '2026-11-25')).toBe('Nov 25');
  });
});

describe('day bucketing and the rolling week', () => {
  const events = [
    allDay('No school', '2026-11-25', '2026-11-28'),
    allDay('Thanksgiving Day', '2026-11-26', '2026-11-27', { kind: 'holidays', cals: ['holidays'] }),
    timed('Dinner', '2026-11-26', '15:00', '19:00'),
    timed('Breakfast', '2026-11-26', '08:00', '09:00'),
    timed('Movie marathon', '2026-11-20', '21:30', '23:59', { endDay: '2026-11-21' }),
  ];

  it('covers all-day days up to but not including the end date', () => {
    expect(isOnDay(events[0], '2026-11-25')).toBe(true);
    expect(isOnDay(events[0], '2026-11-27')).toBe(true);
    expect(isOnDay(events[0], '2026-11-28')).toBe(false);
    expect(isOnDay(allDay('Odd', '2026-11-25', '2026-11-25'), '2026-11-25')).toBe(true);
  });

  it('puts holidays first, then timed events by start; cross-midnight stays on its start day', () => {
    const b = bucketDay(events, '2026-11-26');
    expect(b.allDay.map((e) => e.title)).toEqual(['Thanksgiving Day', 'No school']);
    expect(b.timed.map((e) => e.title)).toEqual(['Breakfast', 'Dinner']);
    expect(bucketDay(events, '2026-11-21').timed).toEqual([]);
  });

  it('rolls seven days from today across a month end', () => {
    const w = rollingWeek(events, '2026-11-26');
    expect(w.map((d) => d.day)).toEqual(['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
    expect(w[1].allDay.map((e) => e.title)).toEqual(['No school']);
    expect(w[2].allDay).toEqual([]);
  });

  it('finds the first thing after today for the coming-up card', () => {
    expect(firstAfter(events, '2026-11-21')!.title).toBe('No school');
    expect(firstAfter(events, '2026-11-25')!.title).toBe('Thanksgiving Day');
    expect(firstAfter(events, '2026-11-26')).toBeNull();
  });
});

describe('next up and the timeline', () => {
  const day = [
    timed('Pancakes', '2026-11-15', '09:00', '10:00'),
    timed('Soccer', '2026-11-15', '10:30', '11:45'),
    timed('Grandma over', '2026-11-15', '13:00', '15:30'),
    timed('Piano', '2026-11-15', '16:30', '17:15'),
    timed('Tacos', '2026-11-15', '18:00', '19:00'),
    timed('Steelers @ Bengals', '2026-11-15', '20:20', '23:20', { kind: 'sports' }),
  ];

  it('picks the next event to start and words the countdown', () => {
    const now = t('2026-11-15T15:40');
    expect(pickNextUp(day, now)!.title).toBe('Piano');
    expect(countdownText(day[3].start! - now)).toBe('in 50 min');
    expect(countdownText(day[5].start! - now)).toBe('in 4h 40m');
    expect(countdownText(2 * 3600000)).toBe('in 2h');
    expect(countdownText(59 * 1000)).toBe('in 1 min');
    expect(countdownText(0)).toBe('now');
    expect(pickNextUp(day, t('2026-11-15T21:00'))).toBeNull();
  });

  it('knows past, now and future', () => {
    const now = t('2026-11-15T16:45');
    expect(eventState(day[0], now)).toBe('past');
    expect(eventState(day[3], now)).toBe('now');
    expect(eventState(day[4], now)).toBe('future');
  });

  it('highlights the next event, or the current one while it is on', () => {
    const rows = planTimeline(day, t('2026-11-15T15:40'), 10);
    expect(rows.filter((r) => r.kind === 'event' && r.highlight).map((r) => r.kind === 'event' && r.e.title)).toEqual(['Piano']);
    const during = planTimeline(day, t('2026-11-15T16:45'), 10);
    expect(during.filter((r) => r.kind === 'event' && r.highlight).map((r) => r.kind === 'event' && r.e.title)).toEqual(['Piano']);
    expect(during.find((r) => r.kind === 'event' && r.e.title === 'Tacos')).toMatchObject({ state: 'next', highlight: false });
  });

  it('folds older finished events first, then the tail, when space runs out', () => {
    const now = t('2026-11-15T15:40');
    const five = planTimeline(day, now, 5);
    expect(five.map((r) => (r.kind === 'event' ? r.e.title : `${r.kind}:${r.count}`))).toEqual(['done:2', 'Grandma over', 'Piano', 'Tacos', 'Steelers @ Bengals']);
    const three = planTimeline(day, t('2026-11-15T08:00'), 3);
    expect(three.map((r) => (r.kind === 'event' ? r.e.title : `${r.kind}:${r.count}`))).toEqual(['Pancakes', 'Soccer', 'more:4']);
    expect(planTimeline(day, now, 1)).toEqual([{ kind: 'more', count: 3 }]);
  });
});

describe('game day', () => {
  const game = timed('Steelers @ Bengals', '2026-11-15', '20:20', '23:20', { kind: 'sports', cals: ['steelers'], busy: false, late: true });
  const early = timed('Steelers @ Eagles', '2026-11-22', '16:25', '19:25', { kind: 'sports', cals: ['steelers'], busy: false });

  it('counts down, then reads Game on for three hours, then drops off', () => {
    expect(gameState(game, t('2026-11-15T15:40'))).toBe('before');
    expect(gameState(game, t('2026-11-15T20:20'))).toBe('on');
    expect(gameState(game, t('2026-11-15T23:19'))).toBe('on');
    expect(gameState(game, t('2026-11-15T23:20'))).toBe('after');
    expect(pickGame([game], '2026-11-15', t('2026-11-15T15:40'))).toMatchObject({ state: 'before' });
    expect(pickGame([game], '2026-11-15', t('2026-11-15T23:30'))).toBeNull();
    expect(pickGame([game], '2026-11-16', t('2026-11-16T10:00'))).toBeNull();
  });

  it('prefers a game that is on over the next one', () => {
    const later = { ...game, title: 'Late one', start: t('2026-11-22T20:15'), end: t('2026-11-22T23:15'), day: '2026-11-22' };
    expect(pickGame([later, early], '2026-11-22', t('2026-11-22T17:30'))!.e.title).toBe('Steelers @ Eagles');
    expect(pickGame([later, early], '2026-11-22', t('2026-11-22T19:30'))!.e.title).toBe('Late one');
  });

  it('says tonight for evening kickoffs', () => {
    expect(kickoffText(game)).toBe('8:20 tonight');
    expect(kickoffText(early)).toBe('4:25 pm');
  });
});

describe('night mode, tomorrow peek, burn-in', () => {
  const d = { nightStartHour: 22, nightEndHour: 6, tomorrowPeekHour: 18, staleAfterMinutes: 120 };

  it('wraps the night window past midnight', () => {
    expect([21, 22, 23, 0, 3, 5, 6, 7].map((h) => isNight(h, d))).toEqual([false, true, true, true, true, true, false, false]);
    expect(isNight(13, { nightStartHour: 12, nightEndHour: 14 })).toBe(true);
    expect(isNight(14, { nightStartHour: 12, nightEndHour: 14 })).toBe(false);
    expect(isNight(3, { nightStartHour: 0, nightEndHour: 0 })).toBe(false);
  });

  it('peeks at tomorrow from the peek hour to midnight', () => {
    expect([17, 18, 19, 23, 0, 9].map((h) => isPeek(h, d))).toEqual([false, true, true, true, false, false]);
  });

  it('looks ahead to tomorrow at night and to the same day after midnight', () => {
    expect(nightLookahead(clock(t('2026-11-15T23:30')))).toEqual({ day: '2026-11-16', label: 'Tomorrow' });
    expect(nightLookahead(clock(t('2026-11-16T02:00')))).toEqual({ day: '2026-11-16', label: 'Today' });
  });

  it('drifts a few pixels each hour', () => {
    const a = burnInShift(t('2026-11-15T10:05'));
    const b = burnInShift(t('2026-11-15T11:05'));
    expect(a).not.toEqual(b);
    expect(burnInShift(t('2026-11-15T10:59'))).toEqual(a);
    for (let h = 0; h < 24; h++) {
      const s = burnInShift(t('2026-11-15T00:00') + h * 3600000);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(5);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(5);
    }
  });
});

describe("Dad's away", () => {
  const trip: AwayRange = { start: t('2026-11-17T00:00'), end: t('2026-11-19T21:15'), firstDay: '2026-11-17', lastDay: '2026-11-19', backTime: '9:15 pm', label: "Dad's away" };

  it('words the banner for each day of the trip', () => {
    expect(awayOn([trip], '2026-11-16')).toBeNull();
    expect(awayOn([trip], '2026-11-18')).toBe(trip);
    expect(awayBanner(trip, '2026-11-17')).toBe("Dad's away Tue–Thu, back Thursday night");
    expect(awayBanner(trip, '2026-11-18')).toBe("Dad's away Tue–Thu, back tomorrow night");
    expect(awayBanner(trip, '2026-11-19')).toBe("Dad's away Tue–Thu, back tonight");
  });

  it('handles day trips, all-day trips and long trips', () => {
    const day = { ...trip, firstDay: '2026-11-20', lastDay: '2026-11-20', backTime: '1:30 pm' };
    expect(awayBanner(day, '2026-11-20')).toBe("Dad's away today, back this afternoon");
    expect(awayBanner({ ...trip, backTime: '' }, '2026-11-17')).toBe("Dad's away Tue–Thu");
    expect(awayBanner({ ...trip, lastDay: '2026-11-28', backTime: '' }, '2026-11-17')).toBe("Dad's away Nov 17–Nov 28");
    expect(backText({ ...trip, backTime: '6:30 pm' }, '2026-11-17')).toBe('back Thursday evening');
    expect(partOfDay('9:15 am')).toBe('morning');
    expect(partOfDay('')).toBe('');
  });

  it('places the week arrow and clips it to the week', () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays('2026-11-15', i));
    expect(awaySpan(trip, days)).toEqual({ from: 2, to: 4, clipStart: false, clipEnd: false });
    const days2 = Array.from({ length: 7 }, (_, i) => addDays('2026-11-18', i));
    expect(awaySpan(trip, days2)).toEqual({ from: 0, to: 1, clipStart: true, clipEnd: false });
    expect(awaySpan(trip, Array.from({ length: 7 }, (_, i) => addDays('2026-11-21', i)))).toBeNull();
    expect(awayArrowText(trip)).toBe("Dad's away · back Thu night");
  });
});

describe('holidays', () => {
  const hol = (title: string, day: string) => allDay(title, day, addDays(day, 1), { kind: 'holidays', cals: ['holidays'] });

  it('counts down to the next major holiday only', () => {
    const events = [hol('Veterans Day', '2026-11-11'), hol('Thanksgiving Day', '2026-11-26'), hol('Christmas Day', '2026-12-25')];
    expect(holidayCountdown(events, '2026-11-09')!.text).toBe('17 days to Thanksgiving');
    expect(holidayCountdown(events, '2026-11-15')!.text).toBe('11 days to Thanksgiving');
    expect(holidayCountdown(events, '2026-11-25')!.text).toBe('Thanksgiving is tomorrow');
    expect(holidayCountdown(events, '2026-11-26')!.text).toBe('29 days to Christmas');
    expect(holidayCountdown([hol('Veterans Day', '2026-11-11')], '2026-11-09')).toBeNull();
    expect(majorName("New Year's Day")).toBe("New Year's");
    expect(majorName('Christmas Eve')).toBeNull();
  });
});

describe('freshness', () => {
  const now = t('2026-11-12T15:40');

  it('says how old the board is', () => {
    expect(agoText(30 * 1000)).toBe('just now');
    expect(agoText(6 * 60000)).toBe('6 min ago');
    expect(agoText(195 * 60000)).toBe('3 h ago');
    expect(agoText(72 * 3600000)).toBe('3 days ago');
    expect(whenText(t('2026-11-12T07:40'), now, clock)).toBe('7:40 am');
    expect(whenText(t('2026-11-10T19:05'), now, clock)).toBe('Tue 7:05 pm');
    expect(whenText(t('2026-11-01T19:05'), now, clock)).toBe('Nov 1');
  });

  it('turns stale after staleAfterMinutes and says offline only when the fetch failed', () => {
    const fresh = freshness(now - 6 * 60000, now, false, 120, clock);
    expect(fresh).toMatchObject({ updated: 'updated 6 min ago', stale: false, offline: false, badge: '', banner: '' });
    expect(freshness(now - 120 * 60000, now, false, 120, clock).stale).toBe(false);
    const old = freshness(now - 121 * 60000, now, false, 120, clock);
    expect(old.stale).toBe(true);
    expect(old.banner).toContain('Waiting for fresh data');
    const off = freshness(t('2026-11-12T07:40'), now, true, 120, clock);
    expect(off.badge).toBe('Offline · last updated 7:40 am');
    expect(off.banner).toBe("Heads up: this is from 7:40 am (8 h ago). The fridge can't reach the calendar.");
    expect(freshness(now - 25 * 60000, now, true, 120, clock)).toMatchObject({ stale: false, offline: true, badge: 'Offline · last updated 3:15 pm' });
  });
});

describe('ink contrast', () => {
  it('keeps every calendar ink at 4.5:1 on day and night paper', () => {
    for (const c of ['#2A54B0', '#21663D', '#6A3EA6', '#5F5E5A', '#101820', '#FFB612', '#F7E26B', '#000000']) {
      expect(contrast(readableInk(c, '#F5EFE1'), '#F5EFE1')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(readableInk(c, '#1B1E25'), '#1B1E25')).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableInk('#2A54B0', '#F5EFE1')).toBe('#2A54B0');
    expect(contrast('#5F5E5A', '#F5EFE1')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#1E2B4A', '#F5EFE1')).toBeGreaterThanOrEqual(4.5);
  });
});
