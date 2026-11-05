/** Calendar titles come from Google and anyone can send an invite, so every string is escaped. */
export function esc(v: unknown): string {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline style for an absolutely placed box (design units). */
export function at(x: number, y: number, w?: number, h?: number): string {
  let s = `left:${Math.round(x)}px;top:${Math.round(y)}px;`;
  if (w != null) s += `width:${Math.round(w)}px;`;
  if (h != null) s += `height:${Math.round(h)}px;`;
  return s;
}
