/**
 * Build step: DASH_CONFIG + DASH_PASSPHRASE (GitHub Secrets) → dist/config.enc.json.
 *
 * DASH_CONFIG is JSON: { "endpointUrl": "https://script.google.com/macros/s/…/exec", "key": "…" }.
 * Without the secrets (before setup) it writes nothing and the fridge shows a "not set up" note.
 * Never prints config values: errors name the field, not its contents.
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { encryptJson, DEFAULT_ITERATIONS } from '../shared/crypto';
import { parseConfig, fail } from './config';

function readLocalEnv(): Record<string, string> {
  if (!existsSync('.env.local')) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^'(.*)'$/, '$1');
  }
  return out;
}

async function main() {
  const local = readLocalEnv();
  const raw = process.env.DASH_CONFIG || local.DASH_CONFIG || '';
  const pass = process.env.DASH_PASSPHRASE || local.DASH_PASSPHRASE || '';
  if (!raw || !pass) {
    console.log('encrypt-config: DASH_CONFIG or DASH_PASSPHRASE not set yet; skipping (the fridge will show setup steps).');
    return;
  }
  if (pass.length < 8) fail('DASH_PASSPHRASE should be at least 8 characters.');
  const cfg = parseConfig(raw);
  const iterations = Number(process.env.DASH_ITERATIONS) || DEFAULT_ITERATIONS;
  const file = await encryptJson(cfg, pass, iterations);
  if (!existsSync('dist')) mkdirSync('dist');
  writeFileSync('dist/config.enc.json', JSON.stringify(file));
  console.log(`encrypt-config: wrote dist/config.enc.json (${iterations} iterations).`);
}

main().catch(() => fail('encryption failed.'));
