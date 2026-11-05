/**
 * The board: lays out the modules, renders them for `now`, polls the script every 5 minutes,
 * ticks the clock every minute, and handles night mode, overlays and the hidden settings.
 * Only DOM nodes whose HTML actually changed get touched, to keep repaints cheap on the fridge.
 */
import type { Board, DayKey } from '../shared/payload';
import { MODULES } from './modules';
import type { BaseCtx, Toggles } from './modules/types';
import { makeClock, type Clock } from './logic/time';
import { burnInShift, isNight } from './logic/modes';
import type { SlotId } from './logic/layout';
import { buildCtx, inksFor, planBoard } from './context';
import { renderNight } from './screens/night';
import { renderOverlay, type Overlay } from './screens/overlays';
import { renderNote } from './screens/unlock';
import { ApiProblem } from './api';
import { store } from './store';
import type { Shell } from './shell';
import { at, esc } from './ui/html';

const POLL_MS = 5 * 60000;
const WAKE_MS = 60000;
const OVERLAY_IDLE_MS = 2 * 60000;
const HOLD_MS = 1200;

export interface AppOptions {
  shell: Shell;
  toggles: Toggles;
  /** The fridge's clock. Real time in production; shifted in dev with ?now=. */
  now: () => number;
  /** A board to show right away (the last good one, or a dev fixture). */
  board: Board | null;
  /** Fetches a fresh board. Missing for dev fixtures. */
  load?: () => Promise<Board>;
  offline?: boolean;
  onForget: () => void;
}

/** What makes a new board worth re-rendering: a new build, or a changed kitchen list. */
function signature(b: Board | null): string {
  return b ? `${b.generatedAt}|${JSON.stringify(b.kitchen || null)}` : '';
}

export class App {
  private o: AppOptions;
  private board: Board | null;
  private offline: boolean;
  private problem = '';
  private failures = 0;
  private overlay: Overlay | null = null;
  private overlayAt = 0;
  private wakeUntil = 0;
  private lastTick = 0;
  private lastPoll = 0;
  private polling = false;
  private pollTimer = 0;
  private tickTimer = 0;
  private wakeTimer = 0;
  private holdTimer = 0;
  private suppressClick = false;
  private html: Record<string, string> = {};
  private slotEls: Partial<Record<SlotId, HTMLElement>> = {};
  private clockMemo: { key: string; clock: Clock } | null = null;
  private inkMemo: { key: string; inks: Record<string, string> } | null = null;

  constructor(o: AppOptions) {
    this.o = o;
    this.board = o.board;
    this.offline = !!o.offline;
  }

  start(): void {
    const el = this.o.shell.el;
    el.addEventListener('click', (e) => this.onClick(e));
    el.addEventListener('pointerdown', (e) => this.onHoldStart(e));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.addEventListener(t, () => this.cancelHold()));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    let resizeT = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = window.setTimeout(() => this.render(), 120);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.render();
      if (Date.now() - this.lastPoll > 60000) this.poll();
    });
    this.lastTick = Date.now();
    this.render();
    this.scheduleTick();
    if (this.o.load) this.poll();
  }

  /* ---------------------------------------------------------------- data */

  async poll(): Promise<void> {
    if (!this.o.load || this.polling) return;
    this.polling = true;
    clearTimeout(this.pollTimer);
    const before = `${signature(this.board)}|${this.offline}|${this.problem}`;
    let next = POLL_MS;
    try {
      const b = await this.o.load();
      this.offline = false;
      this.problem = '';
      this.failures = 0;
      if (signature(b) !== signature(this.board)) {
        this.board = b;
        store.setBoard(b);
      }
    } catch (e) {
      if (e instanceof ApiProblem) {
        this.problem = e.message;
        this.offline = false;
      } else {
        this.offline = true;
        this.failures++;
        next = Math.min(POLL_MS, 60000 * Math.pow(2, this.failures - 1));
      }
    }
    this.polling = false;
    this.lastPoll = Date.now();
    if (`${signature(this.board)}|${this.offline}|${this.problem}` !== before) this.render();
    this.pollTimer = window.setTimeout(() => this.poll(), next);
  }

  private scheduleTick(): void {
    clearTimeout(this.tickTimer);
    const delay = 60000 - (this.o.now() % 60000) + 40;
    this.tickTimer = window.setTimeout(() => {
      const real = Date.now();
      // A gap much longer than a minute means the screen slept: fetch right away.
      if (real - this.lastTick > 3 * 60000) this.poll();
      this.lastTick = real;
      if (this.overlay && real - this.overlayAt > OVERLAY_IDLE_MS) this.overlay = null;
      this.render();
      this.scheduleTick();
    }, delay);
  }

  /* ---------------------------------------------------------------- render */

  private clockFor(b: Board): Clock {
    const key = `${b.timezone}|${b.tzOffsetMin}`;
    if (!this.clockMemo || this.clockMemo.key !== key) this.clockMemo = { key, clock: makeClock(b.timezone, b.tzOffsetMin) };
    return this.clockMemo.clock;
  }

  private inksFor(b: Board, theme: 'day' | 'night'): Record<string, string> {
    const key = `${theme}|${b.calendars.map((c) => `${c.key}${c.color}${c.accent}`).join(',')}`;
    if (!this.inkMemo || this.inkMemo.key !== key) this.inkMemo = { key, inks: inksFor(b, theme) };
    return this.inkMemo.inks;
  }

  private baseCtx(b: Board, now: number): BaseCtx {
    return buildCtx(b, now, {
      stage: this.o.shell.stage,
      toggles: this.o.toggles,
      offline: this.offline,
      problem: this.problem,
      clock: this.clockFor(b),
      inks: (theme) => this.inksFor(b, theme),
    });
  }

  private put(key: string, el: HTMLElement, html: string): void {
    if (this.html[key] === html) return;
    this.html[key] = html;
    el.innerHTML = html;
  }

  render(): void {
    const now = this.o.now();
    const shell = this.o.shell;
    const shift = burnInShift(now);
    if (shell.fit(shift.x, shift.y)) this.resetDom();
    const b = this.board;
    if (!b) {
      const msg = this.problem
        ? renderNote('The calendar didn\'t come through', `<p>${esc(this.problem)}</p>`)
        : this.offline
          ? renderNote('Can\'t reach the calendar', '<p>The fridge couldn\'t get the board from Google yet. It keeps trying every minute or so.</p>')
          : renderNote('Getting the calendar…', '<p>Asking Google for today\'s board.</p>');
      if (this.html.waiting !== msg) {
        this.html = { waiting: msg };
        shell.show(msg);
      }
      return;
    }
    const ctx = this.baseCtx(b, now);
    shell.setTheme(ctx.theme);
    const dom = shell.ensureBoard();
    if (dom.fresh) {
      this.html = {};
      this.slotEls = {};
      for (const m of MODULES) {
        const s = document.createElement('section');
        s.className = `slot slot-${m.id}`;
        dom.slots.appendChild(s);
        this.slotEls[m.id] = s;
      }
    }

    const sleeping = ctx.theme === 'night' && now >= this.wakeUntil;
    if (sleeping) {
      this.overlay = null;
      this.put('night', dom.night, renderNight(b, now, ctx));
      this.put('ov', dom.overlay, '');
      dom.slots.style.display = 'none';
      return;
    }
    this.put('night', dom.night, '');
    dom.slots.style.display = '';

    const shown = new Set<SlotId>();
    for (const part of planBoard(b, now, ctx).parts) {
      const el = this.slotEls[part.id];
      if (!el) continue;
      shown.add(part.id);
      const style = at(part.box.x, part.box.y, part.box.w, part.box.h);
      if (this.html[`${part.id}:style`] !== style) {
        this.html[`${part.id}:style`] = style;
        el.setAttribute('style', style);
      }
      this.put(part.id, el, part.html);
    }
    for (const m of MODULES) {
      const el = this.slotEls[m.id];
      if (!el || shown.has(m.id)) continue;
      if (this.html[`${m.id}:style`] !== 'display:none') {
        this.html[`${m.id}:style`] = 'display:none';
        el.setAttribute('style', 'display:none');
      }
      this.put(m.id, el, '');
    }
    this.put('ov', dom.overlay, this.overlay ? renderOverlay(this.overlay, b, now, ctx) : '');
  }

  /** Forget what's on screen so the next render rewrites every slot. */
  private resetDom(): void {
    this.html = {};
  }

  /* ---------------------------------------------------------------- input */

  private onClick(e: Event): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const now = this.o.now();
    const real = Date.now();
    this.overlayAt = real;
    const b = this.board;
    const night = !!b && isNight(this.clockFor(b)(now).hour, b.display);
    if (night) {
      const wasAsleep = now >= this.wakeUntil;
      this.wakeUntil = now + WAKE_MS;
      clearTimeout(this.wakeTimer);
      this.wakeTimer = window.setTimeout(() => this.render(), WAKE_MS + 50);
      if (wasAsleep) {
        this.render();
        return;
      }
    }
    const t = (e.target as Element).closest ? (e.target as Element).closest('[data-act]') : null;
    if (!t) return;
    const act = t.getAttribute('data-act');
    if (act === 'day') this.overlay = { kind: 'agenda', day: t.getAttribute('data-day') as DayKey };
    else if (act === 'kitchen') this.overlay = { kind: 'kitchen' };
    else if (act === 'close') this.overlay = null;
    else if (act === 'reload') {
      window.location.reload();
      return;
    } else if (act === 'forget') {
      if (this.overlay && this.overlay.kind === 'settings' && this.overlay.confirm) {
        this.o.onForget();
        return;
      }
      this.overlay = { kind: 'settings', confirm: true };
    }
    this.render();
  }

  private onHoldStart(e: Event): void {
    this.suppressClick = false;
    const t = (e.target as Element).closest ? (e.target as Element).closest('[data-hold]') : null;
    if (!t) return;
    this.cancelHold();
    this.holdTimer = window.setTimeout(() => {
      this.suppressClick = true;
      this.overlay = { kind: 'settings', confirm: false };
      this.overlayAt = Date.now();
      this.render();
    }, HOLD_MS);
  }

  private cancelHold(): void {
    clearTimeout(this.holdTimer);
  }

  /** Dev and tests: open an overlay directly. */
  open(o: Overlay | null): void {
    this.overlay = o;
    this.overlayAt = Date.now();
    this.render();
  }
}
