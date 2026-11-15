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
  return tv.games.filter((g) => {
    // A final (the family's team) stays for the rest of its day.
    if (g.final) return g.day === today;
    return now < g.start + (RUNS_MS[g.league] || RUNS_MS.nfl) && (g.day === today || now >= g.start);
  });
}

export function isOnNow(g: TvGame, now: number): boolean {
  return !g.final && (g.live || now >= g.start);
}

/** Any game on right now, so the fridge checks for new scores more often. */
export function anyGameOn(b: Board, now: number, today: DayKey): boolean {
  return tvGamesNow(b, now, today).some((g) => isOnNow(g, now));
}

export function hasScore(g: TvGame): boolean {
  return typeof g.awayScore === 'number' && typeof g.homeScore === 'number';
}

/**
 * Rows the band would like: up to four games get a full-width line each (room for the score and
 * clock), more go two to a row; one row for the "didn't come through" note.
 */
export function tvRowsWanted(b: Board, now: number, today: DayKey): number {
  if (b.tv && b.tv.error) return 1;
  const n = Math.min(tvGamesNow(b, now, today).length, 8);
  return n <= 4 ? n : Math.ceil(n / 2);
}

/**
 * What fits in `slots`: the family's teams first, then games on now, then by start time; shown
 * in start order.
 */
export function tvFit(games: TvGame[], slots: number, now = 0): { shown: TvGame[]; cut: number } {
  if (games.length <= slots) return { shown: games, cut: 0 };
  const keep = new Set<TvGame>(games.filter((g) => g.fav).slice(0, slots));
  for (const g of games) if (keep.size < slots && now && isOnNow(g, now)) keep.add(g);
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
