/**
 * "On TV tonight" rules on the fridge side. The script already picked the games (national
 * networks, the college Top 25 rule, finished games dropped, capped at 8); this only keeps an old
 * board honest and decides what fits.
 */
import type { Board, DayKey, TvGame, TvLeague } from '../../shared/payload';

/** How long after kickoff a game still counts as on, when the board is too old to know. */
const RUNS_MS: Record<TvLeague, number> = { nfl: 4 * 3600000, cfb: 4 * 3600000, nba: 3 * 3600000 };

/** Games still worth listing at `now`: today's, plus any still on from last night. */
export function tvGamesNow(b: Board, now: number, today: DayKey): TvGame[] {
  const tv = b.tv;
  if (!tv || tv.error || !Array.isArray(tv.games)) return [];
  return tv.games.filter((g) => now < g.start + (RUNS_MS[g.league] || RUNS_MS.nfl) && (g.day === today || now >= g.start));
}

export function isOnNow(g: TvGame, now: number): boolean {
  return g.live || now >= g.start;
}

/** Rows the band would like: two games a row, or one row for the "didn't come through" note. */
export function tvRowsWanted(b: Board, now: number, today: DayKey): number {
  if (b.tv && b.tv.error) return 1;
  return Math.ceil(Math.min(tvGamesNow(b, now, today).length, 8) / 2);
}

/** What fits in `slots`: the family's teams first, then by start time; shown in start order. */
export function tvFit(games: TvGame[], slots: number): { shown: TvGame[]; cut: number } {
  if (games.length <= slots) return { shown: games, cut: 0 };
  const fav = games.filter((g) => g.fav).slice(0, slots);
  const keep = new Set<TvGame>(fav);
  for (const g of games) if (keep.size < slots) keep.add(g);
  return { shown: games.filter((g) => keep.has(g)), cut: games.length - keep.size };
}

/** "tonight" when everything listed starts at 5 pm or later, otherwise "today". */
export function tvTitle(games: TvGame[]): string {
  const evening = games.every((g) => {
    const h = parseInt(g.time, 10) % 12;
    return g.ampm === 'pm' && h >= 5;
  });
  return evening ? 'On TV tonight' : 'On TV today';
}
