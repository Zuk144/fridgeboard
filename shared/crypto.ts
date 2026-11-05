/**
 * Passphrase encryption shared by the build (Node 20+, which has WebCrypto) and the fridge
 * browser, so both sides run the exact same code.
 *
 * AES-256-GCM, key from PBKDF2-SHA256. The salt is fixed per site (below) and the IV is random
 * per publish. A fixed salt matters: the fridge stores the derived key after the first unlock, and
 * a new salt on every deploy would make it ask for the passphrase again after each one.
 * Salts aren't secret; the passphrase is.
 */

export const SITE_SALT_B64 = 'UdFztEyUdx3bqoElYU/Big==';
export const DEFAULT_ITERATIONS = 150_000;

export interface EncFile {
  v: 1;
  salt: string;
  iv: string;
  iterations: number;
  ciphertext: string;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error('WebCrypto is not available here');
  return c.subtle;
}

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Derives the AES key. Extractable so the fridge can keep it (as JWK) instead of the passphrase. */
export async function deriveKey(passphrase: string, saltB64 = SITE_SALT_B64, iterations = DEFAULT_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(value: unknown, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<EncFile> {
  const key = await deriveKey(passphrase, SITE_SALT_B64, iterations);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { v: 1, salt: SITE_SALT_B64, iv: toB64(iv), iterations, ciphertext: toB64(new Uint8Array(ct)) };
}

export async function decryptWithKey<T = unknown>(file: EncFile, key: CryptoKey): Promise<T> {
  if (!file || file.v !== 1) throw new Error('Unknown encrypted file version');
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) }, key, fromB64(file.ciphertext));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export async function decryptJson<T = unknown>(file: EncFile, passphrase: string): Promise<T> {
  return decryptWithKey<T>(file, await deriveKey(passphrase, file.salt, file.iterations));
}

export async function exportKey(key: CryptoKey): Promise<JsonWebKey> {
  return subtle().exportKey('jwk', key);
}

export async function importKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle().importKey('jwk', jwk, { name: 'AES-GCM' }, false, ['decrypt']);
}
