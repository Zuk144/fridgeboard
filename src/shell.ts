/**
 * The stage: a fixed-width page (1080 design units in portrait) scaled to the viewport, with the
 * planner's ring binding across the top. Both the unlock screen and the board draw into it.
 */
import { stageFor, type Stage } from './logic/layout';

export class Shell {
  readonly root: HTMLElement;
  readonly el: HTMLDivElement;
  stage: Stage;
  private shift = { x: 0, y: 0 };
  private bindingFor = '';

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = '<div class="stage"></div>';
    this.el = root.firstChild as HTMLDivElement;
    this.stage = this.measure();
  }

  measure(): Stage {
    const de = document.documentElement;
    return stageFor(window.innerWidth || de.clientWidth || 1080, window.innerHeight || de.clientHeight || 1920);
  }

  /** Sizes and places the stage. Returns true when the design size changed. */
  fit(shiftX = this.shift.x, shiftY = this.shift.y): boolean {
    const st = this.measure();
    const changed = st.W !== this.stage.W || st.H !== this.stage.H;
    this.stage = st;
    this.shift = { x: shiftX, y: shiftY };
    const s = this.el.style;
    s.width = `${st.W}px`;
    s.height = `${st.H}px`;
    s.transform = `translate(${Math.round(st.offX + shiftX * st.scale)}px,${Math.round(st.offY + shiftY * st.scale)}px) scale(${st.scale})`;
    this.el.className = `stage${this.theme === 'night' ? ' theme-night' : ' theme-day'}`;
    return changed;
  }

  theme: 'day' | 'night' = 'day';

  setTheme(t: 'day' | 'night'): void {
    if (t === this.theme) return;
    this.theme = t;
    this.fit();
  }

  /** Paper, punched holes and rings for the current width. */
  binding(): string {
    let html = '<div class="sheet"></div><div class="binding">';
    for (let x = 70; x <= this.stage.W - 60; x += 134) html += `<div class="hole" style="left:${x}px"></div><div class="ring" style="left:${x + 5}px"></div>`;
    return html + '</div>';
  }

  /** Replaces the whole page (unlock and note screens). */
  show(html: string): void {
    this.fit();
    this.bindingFor = '';
    this.el.innerHTML = this.binding() + html;
  }

  /** Makes sure the board's containers exist; rebuilds them when the stage size changed. */
  ensureBoard(): { slots: HTMLElement; overlay: HTMLElement; night: HTMLElement; fresh: boolean } {
    const sig = `${this.stage.W}`;
    let fresh = false;
    if (this.bindingFor !== sig || !this.el.querySelector('.slots')) {
      this.el.innerHTML = `${this.binding()}<div class="slots"></div><div class="ov-host"></div><div class="night-host"></div>`;
      this.bindingFor = sig;
      fresh = true;
    }
    return {
      slots: this.el.querySelector('.slots') as HTMLElement,
      overlay: this.el.querySelector('.ov-host') as HTMLElement,
      night: this.el.querySelector('.night-host') as HTMLElement,
      fresh,
    };
  }
}
