import { SCHEMA_VERSION, type FridgeConfig } from '../shared/payload';

export function fail(msg: string): never {
  console.error(`encrypt-config: ${msg}`);
  process.exit(1);
}

/** Validates DASH_CONFIG. Error messages name the field, never its value. */
export function parseConfig(raw: string): FridgeConfig {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw);
  } catch {
    fail('DASH_CONFIG is not valid JSON (check for a missing quote or comma).');
  }
  const url = obj.endpointUrl;
  const key = obj.key;
  if (typeof url !== 'string' || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
    fail('DASH_CONFIG.endpointUrl should look like https://script.google.com/macros/s/…/exec');
  }
  if (typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)) {
    fail('DASH_CONFIG.key should be the 64-character key from showKey() in the Google script.');
  }
  return { schemaVersion: SCHEMA_VERSION, endpointUrl: url, key };
}
