/**
 * Calendar ink colors come from the Sheet, so someone could pick a color that's hard to read.
 * These helpers nudge a color darker on paper (lighter at night) until it reaches 4.5:1.
 */

function parse(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: number[]): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function lum(rgb: number[]): number {
  const c = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return 1;
  const la = lum(x);
  const lb = lum(y);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The color itself when it reads at `min`:1 on `bg`, else mixed toward black (light bg) or white (dark bg). */
export function readableInk(color: string, bg: string, min = 4.5): string {
  const c = parse(color);
  const b = parse(bg);
  if (!c || !b) return color;
  const target = lum(b) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const mixed = c.map((v, i) => v + (target[i] - v) * t);
    const hex = toHex(mixed);
    if (contrast(hex, bg) >= min) return hex;
  }
  return toHex(target);
}
