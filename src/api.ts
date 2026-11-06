/**
 * Talks to the Google script with plain fetch (the fridge probe showed it follows Apps Script's
 * redirect fine). Never logs the URL, the key, or anything the script sends back.
 */
import { SCHEMA_VERSION, type Board, type FridgeConfig } from '../shared/payload';

/** A reply that came back but can't be used: wrong key, newer script, script error. */
export class ApiProblem extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const TIMEOUT_MS = 30000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Checks a reply and turns it into a Board, or throws ApiProblem. */
export function checkBoard(data: unknown): Board {
  const d = data as Partial<Board> & { ok?: boolean; error?: string };
  if (!d || typeof d !== 'object') throw new ApiProblem('bad_reply', "The Google script sent something that isn't a board.");
  if (d.ok !== true) {
    if (d.error === 'bad_key') throw new ApiProblem('bad_key', "The Google script didn't accept the fridge's key. If the key was rotated, update the DASH_CONFIG secret and run the deploy again.");
    throw new ApiProblem(String(d.error || 'not_ok'), "The Google script hit an error. Showing the last good board; it'll try again in a few minutes.");
  }
  const major = Math.floor(Number(d.schemaVersion));
  if (major !== SCHEMA_VERSION) {
    throw new ApiProblem('schema', `The Google script sends board version ${major}, and this page reads version ${SCHEMA_VERSION}. Update Code.gs or this page so they match.`);
  }
  if (!Array.isArray(d.events) || typeof d.generatedAt !== 'number' || !d.display) {
    throw new ApiProblem('bad_reply', "The Google script's board is missing parts.");
  }
  return d as Board;
}

export async function fetchBoard(cfg: FridgeConfig, now: number): Promise<Board> {
  const url = `${cfg.endpointUrl}?action=board&k=${encodeURIComponent(cfg.key)}&cb=${now}`;
  const res = await withTimeout(fetch(url, { redirect: 'follow', credentials: 'omit' }), TIMEOUT_MS);
  if (!res.ok) throw new Error(`http ${res.status}`);
  return checkBoard(await res.json());
}
