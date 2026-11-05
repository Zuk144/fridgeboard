/**
 * Talks to the Google script. Plain fetch (the probe showed the fridge follows Apps Script's
 * redirect fine); JSONP via a script tag only if fetch fails with a network/CORS error.
 * Never logs the URL, the key, or anything the script sends back.
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
let preferJsonp = false;
let seq = 0;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function jsonp(url: string, ms: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const name = `fbcb${++seq}_${Date.now().toString(36)}`;
    const w = window as unknown as Record<string, unknown>;
    const s = document.createElement('script');
    let done = false;
    const finish = () => {
      done = true;
      clearTimeout(timer);
      w[name] = () => {}; // a late reply must not throw
      if (s.parentNode) s.parentNode.removeChild(s);
    };
    const timer = setTimeout(() => { if (!done) { finish(); reject(new Error('timeout')); } }, ms);
    w[name] = (data: unknown) => { if (!done) { finish(); resolve(data); } };
    s.onerror = () => { if (!done) { finish(); reject(new TypeError('jsonp failed')); } };
    s.src = `${url}&callback=${name}`;
    document.head.appendChild(s);
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
  if (!preferJsonp) {
    try {
      const res = await withTimeout(fetch(url, { redirect: 'follow', credentials: 'omit' }), TIMEOUT_MS);
      if (!res.ok) throw new Error(`http ${res.status}`);
      return checkBoard(await res.json());
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
      // Network or CORS trouble: try the JSONP door once before calling it offline.
    }
  }
  const data = await jsonp(url, TIMEOUT_MS);
  preferJsonp = true;
  return checkBoard(data);
}
