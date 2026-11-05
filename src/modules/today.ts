/**
 * Today: all-day chips on top, then a hand-ruled timeline. Past events are crossed out and fade;
 * the current (or next) event gets the yellow highlighter. After the peek hour Today shrinks to
 * "Tonight" and Tomorrow takes the room.
 */
import type { Board, BoardEvent, DayKey } from '../../shared/payload';
import type { Ctx, DashModule } from './types';
import { bucketDay } from '../logic/days';
import { eventState, planTimeline, type TimelineRow } from '../logic/nextup';
import { holidayCountdown } from '../logic/holidays';
import { DOW_LONG, dowOf } from '../logic/time';
import { at, esc } from '../ui/html';
import { chip, dots, inkOf, pill } from '../ui/events';
import { check, mug } from '../ui/icons';

interface Metrics {
  titleX: number;
  rowH: number;
  font: number;
  timeX: number;
  timeW: number;
  marginX: number;
  textX: number;
  chipH: number;
}

const PORTRAIT: Metrics = { titleX: 70, rowH: 76, font: 42, timeX: 40, timeW: 150, marginX: 210, textX: 232, chipH: 62 };
const LANDSCAPE: Metrics = { titleX: 60, rowH: 70, font: 38, timeX: 26, timeW: 140, marginX: 186, textX: 206, chipH: 56 };

function eventRow(board: Board, e: BoardEvent, cls: string, highlight: boolean, top: number, m: Metrics, right: number, ctx: Ctx): string {
  const sports = e.kind === 'sports';
  const color = sports ? 'var(--ink)' : inkOf(e, ctx);
  const text = `<span class="tx${cls === 'past' ? ' strike' : ''}">${highlight ? `<span class="hl">${esc(e.title)}</span>` : esc(e.title)}</span>`;
  const extra = sports && cls !== 'past' ? ` ${pill(board, e, e.late ? 'on TV · late' : 'on TV', 'tv')}` : '';
  return `<div class="row ${cls}" style="${at(0, top, right, m.rowH)}font-size:${m.font}px;line-height:${m.rowH}px">` +
    `<span class="t${highlight ? ' t-on' : ''}" style="${at(m.timeX, 0, m.timeW)}">${esc(e.time || '')}</span>` +
    `<span class="n" style="left:${m.textX}px;right:0;color:${color}">${text}${dots(e, ctx)}${extra}</span></div>`;
}

function timelineRows(board: Board, rows: TimelineRow[], top: number, m: Metrics, right: number, ctx: Ctx): string {
  let html = '';
  rows.forEach((r, i) => {
    const y = top + i * m.rowH;
    if (r.kind === 'event') {
      html += eventRow(board, r.e, r.state === 'past' ? 'past' : r.state, r.highlight, y, m, right, ctx);
    } else {
      const label = r.kind === 'done' ? `${check(30)} ${r.count} done earlier` : `+${r.count} more · tap for the whole day`;
      html += `<div class="row note pencil" style="${at(0, y, right, m.rowH)}line-height:${m.rowH}px"><span class="n" style="left:${m.textX}px;right:0">${label}</span></div>`;
    }
  });
  return html;
}

/** Ruled lines and the red margin from `top` to the bottom of the box. */
function paper(top: number, h: number, m: Metrics, w: number): string {
  if (h <= 0) return '';
  return `<div class="ruled" style="${at(0, top, w, h)}background-size:100% ${m.rowH}px"></div><div class="margin-line" style="${at(m.marginX, top, 2, h)}"></div>`;
}

function titleRow(text: string, size: number, x: number, tag: string, sub = ''): string {
  const tagX = Math.round(x + text.length * size * 0.42 + 46);
  return `<div class="sec-title hand" style="${at(x, 0)}font-size:${size}px;line-height:${size + 8}px">${esc(text)}${sub ? `<span class="sec-sub pencil">${esc(sub)}</span>` : ''}</div>` +
    (tag ? `<div class="kraft" style="${at(tagX, Math.round(size * 0.24))}">${tag}</div>` : '');
}

function chipsRow(board: Board, allDay: BoardEvent[], top: number, m: Metrics, width: number, ctx: Ctx): string {
  if (!allDay.length) return '';
  return `<div class="chips" style="${at(m.titleX - 6, top, width - m.titleX, m.chipH)}">${allDay.map((e) => chip(board, e, ctx)).join('')}</div>`;
}

function emptyNote(top: number, m: Metrics, right: number, what: string, hint: string): string {
  return `<div class="row empty" style="${at(0, top, right, m.rowH * 3)}"><span class="n" style="left:${m.textX}px;right:0">` +
    `<span class="hand empty-big">${esc(what)}</span> ${mug(Math.round(m.rowH * 0.8))}` +
    (hint ? `<span class="pencil empty-hint">${esc(hint)}</span>` : '') + '</span></div>';
}

interface SectionOpts {
  day: DayKey;
  title: string;
  sub?: string;
  titleSize: number;
  tag: string;
  y: number;
  h: number;
  /** 'today' shows past rows crossed out; 'tonight' keeps only what's left; 'ahead' shows all plain. */
  mode: 'today' | 'tonight' | 'ahead';
  emptyText: string;
  emptyHint: string;
  showChips: boolean;
}

function section(board: Board, now: number, ctx: Ctx, m: Metrics, o: SectionOpts): string {
  const box = ctx.box;
  const right = ctx.layout.nextup ? ctx.layout.nextup.x - 24 : box.w - 40;
  const bucket = bucketDay(board.events, o.day);
  const titleH = o.titleSize + 18;
  const chipsTop = titleH;
  const hasChips = o.showChips && bucket.allDay.length > 0;
  const rowsTop = titleH + (hasChips ? m.chipH + 10 : 4);
  const room = Math.max(1, Math.floor((o.h - rowsTop - 6) / m.rowH));
  let timed = bucket.timed;
  if (o.mode === 'tonight') timed = timed.filter((e) => eventState(e, now) !== 'past');
  let body: string;
  if (!timed.length) {
    body = emptyNote(rowsTop, m, right, o.emptyText, o.emptyHint);
  } else if (o.mode === 'ahead') {
    const rows: TimelineRow[] = planTimeline(timed, -Infinity, room).map((r) => (r.kind === 'event' ? { kind: 'event', e: r.e, state: 'later', highlight: false } : r));
    body = timelineRows(board, rows, rowsTop, m, right, ctx);
  } else {
    body = timelineRows(board, planTimeline(timed, now, room), rowsTop, m, right, ctx);
  }
  const inner = paper(rowsTop, o.h - rowsTop, m, box.w) +
    titleRow(o.title, o.titleSize, m.titleX, o.tag, o.sub) +
    (hasChips ? chipsRow(board, bucket.allDay, chipsTop, m, right, ctx) : '') +
    body;
  return `<div class="section" data-act="day" data-day="${o.day}" style="${at(0, o.y, box.w, o.h)}">${inner}</div>`;
}

export const todayModule: DashModule = {
  id: 'today',
  needs: ['calendar'],
  render(board, now, ctx) {
    const land = ctx.stage.orient === 'landscape';
    const m = land ? LANDSCAPE : PORTRAIT;
    const cd = holidayCountdown(board.events, ctx.today);
    const tag = cd ? `<span class="kraft-hole"></span>${esc(cd.text)}` : '';
    const H = ctx.box.h;
    if (!ctx.peek) {
      return section(board, now, ctx, m, {
        day: ctx.today, title: 'Today', titleSize: land ? 80 : 92, tag, y: 0, h: H, mode: 'today', showChips: true,
        emptyText: 'Nothing on today', emptyHint: 'Put plans on the Family calendar and they show up here.',
      });
    }
    // Tomorrow peek: a short "Tonight" on top, Tomorrow gets the rest.
    const left = bucketDay(board.events, ctx.today).timed.filter((e) => eventState(e, now) !== 'past').length;
    const tonightRows = Math.max(1, Math.min(left, 2));
    const tonightH = (land ? 72 : 82) + 4 + (left ? tonightRows : 1) * m.rowH + 8;
    return section(board, now, ctx, m, {
      day: ctx.today, title: 'Tonight', titleSize: land ? 60 : 66, tag, y: 0, h: tonightH, mode: 'tonight', showChips: false,
      emptyText: 'All done for today', emptyHint: '',
    }) + section(board, now, ctx, m, {
      day: ctx.tomorrow, title: 'Tomorrow', sub: DOW_LONG[dowOf(ctx.tomorrow)], titleSize: land ? 80 : 92, tag: '', y: tonightH + 8, h: H - tonightH - 8, mode: 'ahead', showChips: true,
      emptyText: 'Nothing on tomorrow', emptyHint: '',
    });
  },
};
