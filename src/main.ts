/**
 * Boot: unlock (stored key, or the passphrase once) → decrypt config.enc.json → poll the Google
 * script → render the board. Shows the last good board right away when there is one.
 */
import './styles.css';
import { SCHEMA_VERSION, type Board, type FridgeConfig } from '../shared/payload';
import type { EncFile } from '../shared/crypto';
import { App } from './app';
import { Shell } from './shell';
import { checkBoard, fetchBoard } from './api';
import { hasCrypto, loadEncFile, openWithPassphrase, openWithStoredKey, togglesFrom } from './config';
import { NOT_SET_UP, renderNote, renderUnlock, unlockMessage, type UnlockMsg } from './screens/unlock';
import { store } from './store';

const root = document.getElementById('app') as HTMLElement;
const shell = new Shell(root);
let nowFn = () => Date.now();

window.addEventListener('resize', () => shell.fit());

function cachedBoard(): Board | null {
  const b = store.getBoard<Board>();
  if (!b) return null;
  try {
    return checkBoard(b);
  } catch {
    return null;
  }
}

function startBoard(cfg: FridgeConfig): void {
  const app = new App({
    shell,
    toggles: togglesFrom(cfg),
    now: () => nowFn(),
    board: cachedBoard(),
    load: () => fetchBoard(cfg, Date.now()),
    onForget: () => {
      store.forget();
      window.location.reload();
    },
  });
  app.start();
}

function showUnlock(file: EncFile, msg: UnlockMsg): void {
  shell.show(renderUnlock(msg));
  const form = shell.el.querySelector('form') as HTMLFormElement;
  const input = shell.el.querySelector('#ul-pass') as HTMLInputElement;
  const btn = shell.el.querySelector('#ul-go') as HTMLButtonElement;
  const note = shell.el.querySelector('#ul-msg') as HTMLElement;
  const say = (m: UnlockMsg) => {
    note.textContent = unlockMessage(m);
    note.className = `ul-msg${m && m !== 'busy' ? ' bad' : ''}`;
  };
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const pass = input.value;
    if (!pass) {
      say('short');
      return;
    }
    say('busy');
    btn.disabled = true;
    openWithPassphrase(file, pass).then(
      (cfg) => {
        input.value = '';
        startBoard(cfg);
      },
      () => {
        say('wrong');
        btn.disabled = false;
        input.select();
      },
    );
  });
}

async function boot(): Promise<void> {
  if (import.meta.env.DEV) {
    const { devSetup } = await import('./dev');
    const dev = await devSetup();
    if (dev.now) nowFn = dev.now;
    if (dev.error) {
      shell.show(renderNote('Dev', `<p>${dev.error}</p>`));
      return;
    }
    if (dev.fixture) {
      const app = new App({ shell, toggles: dev.toggles, now: () => nowFn(), board: dev.fixture.board, offline: dev.fixture.offline, onForget: () => window.location.reload() });
      app.start();
      if (dev.open) app.open(dev.open);
      return;
    }
  }
  if (!hasCrypto()) {
    shell.show(renderNote('Can\'t unlock here', `<p>${unlockMessage('nocrypto')}</p>`));
    return;
  }
  const enc = await loadEncFile(Date.now());
  if ('missing' in enc) {
    shell.show(NOT_SET_UP);
    return;
  }
  if ('network' in enc) {
    shell.show(renderNote('Can\'t reach the site', '<p>The fridge couldn\'t load the page\'s settings. Check the Wi-Fi; it tries again in a minute.</p>'));
    window.setTimeout(() => window.location.reload(), 60000);
    return;
  }
  const cfg = await openWithStoredKey(enc.file);
  if (cfg) {
    startBoard(cfg);
    return;
  }
  showUnlock(enc.file, store.getKey() ? 'changed' : '');
}

root.setAttribute('data-schema', String(SCHEMA_VERSION));
boot().catch(() => {
  shell.show(renderNote('Something went wrong', '<p>The page hit an unexpected error while starting. It reloads in a minute.</p>'));
  window.setTimeout(() => window.location.reload(), 60000);
});
