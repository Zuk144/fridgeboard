import { describe, it, expect } from 'vitest';
import { encryptJson, decryptJson, deriveKey, exportKey, importKey, decryptWithKey, SITE_SALT_B64 } from '../shared/crypto';
import { parseConfig } from '../scripts/config';

const cfg = { schemaVersion: 1, endpointUrl: 'https://script.google.com/macros/s/FAKE_deployment-id_123/exec', key: 'a'.repeat(64) };

describe('shared crypto', () => {
  it('round-trips with the passphrase and in the file format the fridge expects', async () => {
    const file = await encryptJson(cfg, 'correct horse battery staple', 1000);
    expect(Object.keys(file).sort()).toEqual(['ciphertext', 'iterations', 'iv', 'salt', 'v']);
    expect(file.salt).toBe(SITE_SALT_B64);
    expect(JSON.stringify(file)).not.toContain('script.google.com');
    expect(await decryptJson(file, 'correct horse battery staple')).toEqual(cfg);
  });

  it('rejects a wrong passphrase', async () => {
    const file = await encryptJson(cfg, 'right one', 1000);
    await expect(decryptJson(file, 'wrong one')).rejects.toThrow();
  });

  it('a stored key keeps working after a redeploy (fresh IV, same salt)', async () => {
    const stored = await exportKey(await deriveKey('fridge pass', SITE_SALT_B64, 1000));
    const key = await importKey(JSON.parse(JSON.stringify(stored)));
    const first = await encryptJson(cfg, 'fridge pass', 1000);
    const second = await encryptJson({ ...cfg, key: 'b'.repeat(64) }, 'fridge pass', 1000);
    expect(second.iv).not.toBe(first.iv);
    expect(await decryptWithKey(first, key)).toEqual(cfg);
    expect((await decryptWithKey<typeof cfg>(second, key)).key).toBe('b'.repeat(64));
  });
});

describe('config validation', () => {
  it('accepts a real-looking config', () => {
    expect(parseConfig(JSON.stringify({ endpointUrl: cfg.endpointUrl, key: cfg.key }))).toEqual(cfg);
  });
});
