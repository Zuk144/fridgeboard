/**
 * localStorage on the fridge, wrapped so a blocked or full store never breaks the page.
 * Holds the derived unlock key (JWK, never the passphrase), the encrypted config (so an offline
 * reboot can still unlock), and the last good board (so an offline fridge still shows it).
 */
const KEY = 'fb.key';
const ENC = 'fb.enc';
const BOARD = 'fb.board';

function get(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function set(k: string, v: string): void {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* storage full or blocked: the page still works, it just won't remember */
  }
}

function del(k: string): void {
  try {
    window.localStorage.removeItem(k);
  } catch {
    /* nothing to do */
  }
}

function getJson<T>(k: string): T | null {
  const raw = get(k);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const store = {
  getKey: () => getJson<JsonWebKey>(KEY),
  setKey: (jwk: JsonWebKey) => set(KEY, JSON.stringify(jwk)),
  getEnc: () => get(ENC),
  setEnc: (text: string) => set(ENC, text),
  getBoard: <T>() => getJson<T>(BOARD),
  setBoard: (b: unknown) => set(BOARD, JSON.stringify(b)),
  /** "Forget this device". */
  forget: () => {
    del(KEY);
    del(ENC);
    del(BOARD);
  },
};
