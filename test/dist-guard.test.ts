import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Nothing readable may be published: no payloads, no calendar files, no plain config.
// Runs against dist/ when it exists (CI builds before testing).
const DIST = fileURLToPath(new URL('../dist', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('dist guard', () => {
  it('publishes no payloads, calendar files, or plain config', () => {
    if (!existsSync(DIST)) return;
    const files = walk(DIST);
    const bad = files.filter((f) => /(^|[\\/])(payload\.json|.*\.payload\.json|config\.json|dashboard\.json|\.env.*)$/.test(f) || /\.ics$/i.test(f));
    expect(bad).toEqual([]);
  });

  it('publishes no secret calendar links or script keys', () => {
    if (!existsSync(DIST)) return;
    for (const f of walk(DIST).filter((x) => /\.(html|js|json|css|txt)$/.test(x))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/calendar\/ical\/[^"'\s]+\/private-/);
      expect(text, f).not.toMatch(/script\.google\.com\/macros\/s\/AKfy/);
    }
  });
});
