/**
 * Weather: the next 12 hours as an inline SVG strip (temperature line plus rain-chance bars),
 * sunrise and sunset, and a 3-day outlook with icons.
 */
import type { Weather } from '../../shared/payload';
import type { DashModule } from './types';
import { at, esc } from '../ui/html';
import { weatherIcon } from '../ui/icons';

type Hour = NonNullable<Weather['hours']>[number];

/** Smooth path through points (Catmull-Rom turned into cubic Béziers). */
function smooth(pts: [number, number][]): string {
  if (!pts.length) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** The 12-hour strip as SVG, w x h design units. */
export function hourStrip(hours: Hour[], w: number, h: number): string {
  if (!hours.length) return '';
  const n = hours.length;
  const step = w / n;
  const barMax = Math.max(24, Math.round(h * 0.36));
  const lineTop = 26;
  const lineBottom = Math.max(lineTop + 16, h - barMax - 30);
  const temps = hours.map((x) => x.temp);
  const lo = Math.min.apply(null, temps);
  const hi = Math.max.apply(null, temps);
  const span = Math.max(hi - lo, 6);
  const y = (t: number) => lineTop + ((hi - t) / span) * (lineBottom - lineTop);
  const pts: [number, number][] = hours.map((x, i) => [i * step + step / 2, y(x.temp)]);
  let bars = '';
  let wet = -1;
  hours.forEach((x, i) => {
    const bh = Math.max(3, Math.round((Math.min(100, Math.max(0, x.pop)) / 100) * barMax));
    bars += `<rect x="${(i * step + step / 2 - 10).toFixed(1)}" y="${h - 10 - bh}" width="20" height="${bh}"/>`;
    if (x.pop >= 30 && (wet < 0 || x.pop > hours[wet].pop)) wet = i;
  });
  const first = pts[0];
  const last = pts[n - 1];
  let labels = `<text x="${Math.max(4, first[0] - 10).toFixed(0)}" y="${Math.max(20, first[1] - 10).toFixed(0)}">${hours[0].temp}°</text>`;
  if (n > 1) labels += `<text x="${(last[0] - 22).toFixed(0)}" y="${Math.max(20, last[1] - 12).toFixed(0)}">${hours[n - 1].temp}°</text>`;
  if (wet >= 0) labels += `<text class="wx-pop" x="${(wet * step + step / 2 - 20).toFixed(0)}" y="${h - 16 - Math.round((hours[wet].pop / 100) * barMax)}">${hours[wet].pop}%</text>`;
  return `<svg class="strip" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" aria-hidden="true">` +
    `<g class="wx-bars" stroke-width="2">${bars}</g>` +
    `<path class="wx-line" d="${smooth(pts)}" stroke-width="4" stroke-linecap="round"/>` +
    `<g class="wx-labels" font-size="22">${labels}</g></svg>`;
}

export const weatherModule: DashModule = {
  id: 'weather',
  needs: ['weather'],
  render(board, _now, ctx) {
    const w = board.weather || {};
    const box = ctx.box;
    const x0 = ctx.stage.orient === 'landscape' ? 30 : 70;
    const cw = box.w - x0 - 30;
    if (w.error || !w.hours || !w.hours.length) {
      return `<div class="sec-title hand" style="${at(x0, 10)}font-size:44px;line-height:48px">Weather</div><div class="pencil" style="${at(x0, 70)}font-size:30px">The forecast didn't come through. It'll try again on the next update.</div>`;
    }
    const hours = w.hours.slice(0, 12);
    const chartH = Math.max(110, Math.min(360, box.h - 146));
    const step = cw / hours.length;
    const sun = w.today && w.today.sunrise ? `<span class="pencil wx-sun">sunrise ${esc(w.today.sunrise)} · sunset ${esc(w.today.sunset || '')}</span>` : '';
    let ticks = '';
    hours.forEach((x, i) => {
      if (i % 2 === 0) ticks += `<span style="left:${Math.round(i * step + step / 2 - 14)}px">${esc(x.label)}</span>`;
    });
    const days = (w.days || []).slice(0, 3);
    const outlook = days.map((d) =>
      `<div class="day3"><b class="hand">${esc(d.dow)}</b>${weatherIcon(d.icon, 42)}<span>${d.hi}°/${d.lo}°</span>${d.pop >= 30 ? ` <span class="wx-pop">${d.pop}%</span>` : ''}</div>`,
    ).join('');
    return `<div class="wx-head" style="${at(x0, 2, cw, 48)}"><span class="hand sec-small">Next 12 hours</span>${sun}</div>` +
      `<div class="wx-chart" style="${at(x0, 52)}">${hourStrip(hours, Math.round(cw), chartH)}</div>` +
      `<div class="wx-ticks pencil" style="${at(x0, 50 + chartH, cw, 28)}">${ticks}</div>` +
      `<div class="wx-days" style="${at(x0, 82 + chartH, cw, 54)}">${outlook}</div>`;
  },
};
