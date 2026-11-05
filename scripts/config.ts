import { SCHEMA_VERSION, MODULE_SWITCHES, type FridgeConfig, type ModuleSwitch } from '../shared/payload';

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
  const out: FridgeConfig = { schemaVersion: SCHEMA_VERSION, endpointUrl: url, key };
  if (obj.modules !== undefined) out.modules = parseModules(obj.modules);
  return out;
}

/** Optional on/off switches, e.g. "modules": {"kitchen": false}. Names the field, never a value. */
function parseModules(m: unknown): FridgeConfig['modules'] {
  if (!m || typeof m !== 'object' || Array.isArray(m)) fail('DASH_CONFIG.modules should be an object like {"kitchen": false}.');
  const out: Partial<Record<ModuleSwitch, boolean>> = {};
  for (const [name, on] of Object.entries(m as Record<string, unknown>)) {
    if (!(MODULE_SWITCHES as readonly string[]).includes(name)) fail(`DASH_CONFIG.modules has an unknown switch "${name.slice(0, 20)}" (known: ${MODULE_SWITCHES.join(', ')}).`);
    if (typeof on !== 'boolean') fail(`DASH_CONFIG.modules.${name} should be true or false.`);
    out[name as ModuleSwitch] = on;
  }
  return out;
}
