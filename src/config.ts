/**
 * Unlocking: fetch config.enc.json, open it with the stored key or the typed passphrase, and keep
 * the derived key (JWK) so the fridge never needs the passphrase again. Same shared/crypto.ts the
 * build uses to encrypt.
 */
import { decryptWithKey, deriveKey, exportKey, importKey, type EncFile } from '../shared/crypto';
import type { FridgeConfig } from '../shared/payload';
import { DEFAULT_TOGGLES, type ToggleId, type Toggles } from './modules/types';
import { store } from './store';

export type EncResult = { file: EncFile } | { missing: true } | { network: true };

export async function loadEncFile(now: number): Promise<EncResult> {
  let text: string | null = null;
  try {
    const res = await fetch(`config.enc.json?cb=${now}`, { cache: 'no-store' });
    if (res.status === 404) return { missing: true };
    if (res.ok) text = await res.text();
  } catch {
    text = null;
  }
  if (text) {
    try {
      const file = JSON.parse(text) as EncFile;
      store.setEnc(text);
      return { file };
    } catch {
      /* fall through to the saved copy */
    }
  }
  const saved = store.getEnc();
  if (saved) {
    try {
      return { file: JSON.parse(saved) as EncFile };
    } catch {
      /* broken copy */
    }
  }
  return { network: true };
}

export function hasCrypto(): boolean {
  return !!(window.crypto && window.crypto.subtle);
}

function checkConfig(cfg: FridgeConfig): FridgeConfig {
  if (!cfg || typeof cfg.endpointUrl !== 'string' || typeof cfg.key !== 'string') throw new Error('config fields missing');
  return cfg;
}

/** Opens the config with the key this fridge saved. Null when there's no key or it no longer fits. */
export async function openWithStoredKey(file: EncFile): Promise<FridgeConfig | null> {
  const jwk = store.getKey();
  if (!jwk) return null;
  try {
    const key = await importKey(jwk);
    return checkConfig(await decryptWithKey<FridgeConfig>(file, key));
  } catch {
    return null;
  }
}

/** Opens the config with a typed passphrase and remembers the derived key. Throws when wrong. */
export async function openWithPassphrase(file: EncFile, passphrase: string): Promise<FridgeConfig> {
  const key = await deriveKey(passphrase, file.salt, file.iterations);
  const cfg = checkConfig(await decryptWithKey<FridgeConfig>(file, key));
  store.setKey(await exportKey(key));
  return cfg;
}

/** DASH_CONFIG.modules → on/off switches; anything not mentioned stays on. */
export function togglesFrom(cfg: Pick<FridgeConfig, 'modules'> | null | undefined): Toggles {
  const t: Toggles = { ...DEFAULT_TOGGLES };
  const m = (cfg && cfg.modules) || {};
  (Object.keys(t) as ToggleId[]).forEach((k) => {
    if (typeof m[k] === 'boolean') t[k] = m[k] as boolean;
  });
  if (!t.calendar) {
    t.week = false;
    t.gameday = false;
  }
  return t;
}
