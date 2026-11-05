/**
 * Deploy-time check that the Google script answers with a real board (npm run script-check).
 * Needs DASH_CONFIG (env or .env.local). The Actions log of a public repo is public, so this
 * prints counts only, masks the URL and key, and never echoes error details that might hold them.
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseConfig } from './config';
import { summarizeBoard } from './board-summary';
import { SCHEMA_VERSION, type Board } from '../shared/payload';

function fail(msg: string): never {
  console.error(`script-check: FAIL (${msg})`);
  process.exit(1);
}

async function call(url: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45000) });
  } catch (e) {
    fail(`could not reach the script: ${(e as Error).name}`);
  }
  if (!res.ok) fail(`script answered HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    fail('script did not answer with JSON (is the deployment access set to Anyone?)');
  }
}

async function main() {
  let raw = process.env.DASH_CONFIG || '';
  if (!raw && existsSync('.env.local')) {
    const m = /^\s*DASH_CONFIG\s*=\s*(.*)$/m.exec(readFileSync('.env.local', 'utf8'));
    if (m) raw = m[1].trim().replace(/^'(.*)'$/, '$1');
  }
  if (!raw) fail('DASH_CONFIG is not set');
  const cfg = parseConfig(raw);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::add-mask::${cfg.endpointUrl}`);
    console.log(`::add-mask::${cfg.key}`);
  }
  const base = `${cfg.endpointUrl}?k=${encodeURIComponent(cfg.key)}`;

  const board = await call(`${base}&action=board&fresh=1`);
  if (board.ok !== true) fail(`script answered ${String(board.error || 'not ok')}`);
  const s = summarizeBoard(board as unknown as Board, SCHEMA_VERSION);

  const state = await call(`${base}&action=state`);
  if (state.ok !== true) fail(`list answered ${String(state.error || 'not ok')}`);
  const items = Array.isArray(state.items) ? state.items.length : 0;

  console.log(`script-check: ${s.ok ? 'PASS' : 'WARN'} · ${s.line} · ${items} list buttons`);
  if (!s.ok) process.exitCode = 1;
}

main().catch(() => fail('unexpected error'));
