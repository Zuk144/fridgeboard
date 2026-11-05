/**
 * Round-trips the published config with the same WebCrypto code the fridge uses.
 *   npm run decrypt-check                 → checks dist/config.enc.json
 *   npm run decrypt-check -- <url-or-path> → checks the deployed file
 * Needs DASH_PASSPHRASE (env or .env.local). Prints only pass/fail and the endpoint's host.
 */
import { readFileSync, existsSync } from 'node:fs';
import { decryptJson, type EncFile } from '../shared/crypto';
import type { FridgeConfig } from '../shared/payload';

async function main() {
  const src = process.argv[2] || 'dist/config.enc.json';
  let pass = process.env.DASH_PASSPHRASE || '';
  if (!pass && existsSync('.env.local')) {
    const m = /^\s*DASH_PASSPHRASE\s*=\s*(.*)$/m.exec(readFileSync('.env.local', 'utf8'));
    if (m) pass = m[1].trim().replace(/^'(.*)'$/, '$1');
  }
  if (!pass) throw new Error('DASH_PASSPHRASE is not set');
  const text = /^https?:/.test(src) ? await (await fetch(`${src}?cb=${Date.now()}`)).text() : readFileSync(src, 'utf8');
  const cfg = await decryptJson<FridgeConfig>(JSON.parse(text) as EncFile, pass);
  if (!cfg.endpointUrl || !cfg.key) throw new Error('decrypted, but fields are missing');
  console.log(`decrypt-check: PASS (endpoint host ${new URL(cfg.endpointUrl).host})`);
}

main().catch((e: Error) => {
  console.error(`decrypt-check: FAIL (${e.name === 'OperationError' ? 'wrong passphrase or damaged file' : e.message})`);
  process.exit(1);
});
