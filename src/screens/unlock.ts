/** The unlock page and the plain notes shown before there's a board (not set up, problems). */
import { esc } from '../ui/html';

export type UnlockMsg = '' | 'busy' | 'wrong' | 'changed' | 'network' | 'nocrypto' | 'short';

const MESSAGES: Record<UnlockMsg, string> = {
  '': '',
  busy: 'Unlocking…',
  wrong: "That passphrase didn't open it. Check it and try again.",
  changed: 'The passphrase changed since this fridge last unlocked. Type the new one.',
  network: "Couldn't reach the site. Check the fridge's Wi-Fi and try again.",
  nocrypto: "This browser can't do the encryption the board needs (no WebCrypto).",
  short: 'Type the passphrase first.',
};

export function unlockMessage(m: UnlockMsg): string {
  return MESSAGES[m];
}

export function renderUnlock(msg: UnlockMsg): string {
  return '<div class="unlock paper">' +
    '<div class="hand ul-title">Fridgeboard</div>' +
    '<div class="ul-sub">Type the family passphrase once.<br>This fridge remembers it after that.</div>' +
    '<form class="ul-form" autocomplete="off">' +
    '<input class="ul-input" id="ul-pass" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" placeholder="passphrase" aria-label="Passphrase">' +
    '<button class="ul-btn hand" id="ul-go" type="submit">Unlock</button></form>' +
    `<div class="ul-msg${msg && msg !== 'busy' ? ' bad' : ''}" id="ul-msg">${esc(MESSAGES[msg])}</div>` +
    '<div class="ul-foot pencil">Calendar, weather and the kitchen list, straight from Google.<br>Nothing about the family is stored on this website.</div>' +
    '</div>';
}

/** A plain paper note with a title (setup missing, bad key, newer script). */
export function renderNote(title: string, body: string): string {
  return `<div class="unlock paper"><div class="hand ul-title" style="font-size:110px">${esc(title)}</div><div class="ul-note">${body}</div></div>`;
}

export const NOT_SET_UP = renderNote(
  'Not set up yet',
  '<p>The page is here, but its encrypted settings (<code>config.enc.json</code>) haven\'t been published yet.</p>' +
  '<p>Add the <b>DASH_CONFIG</b> and <b>DASH_PASSPHRASE</b> secrets in GitHub (repo → Settings → Secrets and variables → Actions), then run the deploy again.</p>',
);
