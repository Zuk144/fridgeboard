import type { Board } from '../shared/payload';

/**
 * One line about a board, safe for a public Actions log: counts and status codes only.
 * Never titles, calendar labels, places, names, the URL, or the key.
 */
export function summarizeBoard(b: Board, expectedSchema: number): { ok: boolean; line: string } {
  const problems: string[] = [];
  if (b.schemaVersion !== expectedSchema) problems.push(`schema ${b.schemaVersion} (expected ${expectedSchema})`);
  const errs = (b.errors || []).map((e) => e.error);
  if (errs.length) problems.push(`${errs.length} calendar error(s): ${[...new Set(errs)].join(', ')}`);
  const w = b.weather || {};
  const weather = w.error ? `weather error ${w.error}` : w.now && w.hours && w.hours.length ? 'weather ok' : 'weather missing';
  if (weather !== 'weather ok') problems.push(weather);
  const parts = [
    `schema ${b.schemaVersion}`,
    `${b.calendars.length} calendars`,
    `${b.events.length} events`,
    `${b.away.length} trips`,
    weather,
    tvSummary(b),
    `list ${b.kitchen ? b.kitchen.count : '?'} needed`,
  ];
  return { ok: problems.length === 0, line: parts.join(' · ') + (problems.length ? `  ⚠ ${problems.join('; ')}` : '') };
}

/** "3 games on TV", or why there's no list. Informational: ESPN being down never fails the check. */
export function tvSummary(b: Board): string {
  const tv = b.tv;
  if (!tv) return 'tv not in board (old script)';
  if (tv.error) return `tv error ${tv.error}`;
  const n = (tv.games || []).length + (tv.more || 0);
  const failed = tv.failed && tv.failed.length ? ` (${tv.failed.join(', ')} failed)` : '';
  return `${n} game${n === 1 ? '' : 's'} on TV${failed}`;
}
