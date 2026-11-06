/**
 * Inline SVG in the planner's hand-drawn style (no icon fonts, nothing to download).
 * Colors come from CSS classes so night mode can recolor them.
 */
import type { WeatherIcon } from '../../shared/payload';

const CLOUD = 'M28 94h72a18 18 0 0 0 0-36a26 26 0 0 0-48-6a22 22 0 0 0-24 42z';
const CLOUD_UP = 'M28 74h72a18 18 0 0 0 0-36a26 26 0 0 0-48-6a22 22 0 0 0-24 42z';
const CLOUD_BIG = 'M20 92h88a22 22 0 0 0 0-44a30 30 0 0 0-56-8a26 26 0 0 0-32 52z';
const SUN_SMALL = '<g class="i-sun"><circle cx="94" cy="40" r="18"/><path d="M94 8v8M124 40h-8M116 18l-6 6M72 18l6 6"/></g>';
const MOON_SMALL = '<path class="i-moon" d="M100 14a22 22 0 1 0 22 30a17 17 0 0 1-22-30z"/>';

function body(icon: WeatherIcon): string {
  switch (icon) {
    case 'sun':
      return '<g class="i-sun"><circle cx="70" cy="56" r="22"/><path d="M70 14v12M70 86v12M28 56h12M100 56h12M40 26l8 8M92 78l8 8M100 26l-8 8M48 78l-8 8"/></g>';
    case 'moon':
      return '<path class="i-moon" d="M78 16a36 36 0 1 0 34 52a28 28 0 0 1-34-52z"/>';
    case 'partly':
      return `${SUN_SMALL}<path class="i-cloud" d="${CLOUD}"/>`;
    case 'partly-night':
      return `${MOON_SMALL}<path class="i-cloud" d="${CLOUD}"/>`;
    case 'cloud':
      return `<path class="i-cloud" d="${CLOUD_BIG}"/>`;
    case 'fog':
      return `<path class="i-cloud" d="${CLOUD_UP}"/><path class="i-fog" d="M22 88h90M36 102h86"/>`;
    case 'rain':
      return `<path class="i-cloud" d="${CLOUD_UP}"/><path class="i-rain" d="M50 86l-6 14M72 86l-6 14M94 86l-6 14"/>`;
    case 'snow':
      return `<path class="i-cloud" d="${CLOUD_UP}"/><path class="i-snow" d="M46 88v14M39 95h14M70 92v14M63 99h14M94 88v14M87 95h14"/>`;
    case 'storm':
      return `<path class="i-cloud" d="${CLOUD_UP}"/><path class="i-bolt" d="M72 80l-12 18h14l-10 16"/>`;
    default:
      return `<path class="i-cloud" d="${CLOUD_BIG}"/>`;
  }
}

/** A weather icon drawn at width w (the drawing is 140 x 112). */
export function weatherIcon(icon: WeatherIcon | undefined, w: number): string {
  const h = Math.round((w * 112) / 140);
  return `<svg class="wx-icon" width="${w}" height="${h}" viewBox="0 0 140 112" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body(icon || 'cloud')}</svg>`;
}

export function football(w: number, color: string): string {
  const h = Math.round((w * 34) / 48);
  return `<svg width="${w}" height="${h}" viewBox="0 0 48 34" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" aria-hidden="true"><g transform="rotate(-22 24 17)"><ellipse cx="24" cy="17" rx="21" ry="12"/><path d="M16 17h16M20 13.5v7M24 13v8M28 13.5v7"/></g></svg>`;
}

const PLANE = 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z';

export function plane(size: number): string {
  return `<svg class="plane" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PLANE}"/></svg>`;
}

/** Dashed pencil arrow with a plane at the start, stretched to width w. */
export function tripArrow(w: number, _clipStart: boolean, clipEnd: boolean): string {
  const end = w - 14;
  const start = 48;
  const mid = (start + end) / 2;
  const head = clipEnd ? '' : `<path d="M${end - 14} 12l16 10-16 11"/>`;
  const p = `<g transform="translate(4 4) scale(1.5)"><path d="${PLANE}"/></g>`;
  return `<svg class="trip-arrow" width="${w}" height="44" viewBox="0 0 ${w} 44" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M${start} 24 C ${mid - 40} 18, ${mid + 40} 28, ${end} 22" stroke-dasharray="10 9"/>${head}${p}</svg>`;
}

/** Red-pen underline, stretched to the width of whatever it sits under. */
export function penUnderline(): string {
  return '<svg class="pen-underline" width="100%" height="22" viewBox="0 0 540 22" preserveAspectRatio="none" fill="none" stroke-width="4" stroke-linecap="round" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M4 13 C 110 5, 240 19, 360 10 S 500 7, 534 12"/></svg>';
}

/** Red-pen loop drawn around a word, stretched to (w, h). */
export function penCircle(w: number, h: number): string {
  return `<svg class="pen-circle" width="${w}" height="${h}" viewBox="0 0 330 94" preserveAspectRatio="none" fill="none" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M30 52 C 14 18, 300 4, 318 40 C 330 74, 60 92, 22 60 C 12 50, 40 28, 80 22"/></svg>`;
}

/** Red-pen circle around today's date number in the week grid. */
export function dayCircle(): string {
  return '<svg class="day-circle" width="84" height="68" viewBox="0 0 84 68" fill="none" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M20 10 C 52 -2, 84 14, 78 38 C 72 64, 18 70, 8 44 C 2 26, 22 10, 44 8"/></svg>';
}

export function check(size: number): string {
  return `<svg class="check" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13l5 5L20 6"/></svg>`;
}

/** A little hand-drawn mug for the empty day. */
export function mug(size: number): string {
  return `<svg class="doodle" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 26h30v18a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z"/><path d="M44 30h4a7 7 0 0 1 0 14h-5"/><path d="M24 8c-3 4 3 7 0 12M33 6c-3 4 3 7 0 12"/></svg>`;
}

/** A little hand-drawn TV with rabbit ears, for "On TV tonight". */
export function tvSet(size: number): string {
  return `<svg class="tv-icon" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 6l7 9 8-11"/><rect x="5" y="15" width="38" height="25" rx="5"/><path d="M11 20.5c5-1 13-1 19 0M14 44h20"/><circle cx="37" cy="23" r="1.4"/><circle cx="37" cy="30" r="1.4"/></svg>`;
}
