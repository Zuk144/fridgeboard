/**
 * "We're out": a torn notepad sheet with what the house needs, from board.kitchen. Tapping it
 * opens a simple placeholder for now; the full tap-to-add list board is M2.5.
 */
import type { KitchenSummary } from '../../shared/payload';
import type { DashModule } from './types';
import { esc } from '../ui/html';

/** "milk, eggs +4" style summary: the newest few names plus how many more. */
export function needSummary(k: KitchenSummary | undefined, show = 3): { names: string[]; more: number } {
  if (!k || !k.count) return { names: [], more: 0 };
  const names = (k.names || []).slice(0, show).map((n) => n.toLowerCase());
  return { names, more: Math.max(0, k.count - names.length) };
}

export const kitchenModule: DashModule = {
  id: 'kitchen',
  needs: ['kitchen'],
  render(board) {
    const s = needSummary(board.kitchen);
    let list: string;
    if (!s.names.length) {
      list = '<span class="pencil">all stocked up</span>';
    } else {
      const lines: string[] = [];
      if (s.names.length >= 2 && (s.names[0] + s.names[1]).length <= 14) {
        lines.push(`${esc(s.names[0])} · ${esc(s.names[1])}`);
        s.names.slice(2).forEach((n) => lines.push(esc(n)));
      } else {
        s.names.forEach((n) => lines.push(esc(n)));
      }
      list = lines.slice(0, 3).join('<br>') + (s.more ? `<br><span class="pencil">+${s.more} more</span>` : '');
    }
    return `<div class="notepad" data-act="kitchen"><div class="torn"></div>` +
      `<div class="hand np-title">We're out</div><div class="np-list">${list}</div>` +
      '<div class="np-plus hand" aria-label="Add to the list">+</div></div>';
  },
};
