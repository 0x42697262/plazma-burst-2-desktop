// Remote play lockdown: what a tester's game window may not do. A tester only ever
// receives the window's pixels (desktop/remote/host.js); this keeps those pixels from
// showing anything but the game, and keeps the tester's keys and mouse inside it.
//   - No DevTools (disabled at creation, closed if opened anyway), no menu, no shortcuts
//     that reach the host's clipboard.
//   - No navigation away from the game, no new windows, no <webview>.
//   - Every permission refused (clipboard read, media, notifications, ...).
//   - The page gets PB2_REMOTE before any script: the dev console then hides "js",
//     "hooks", host paths and game names (desktop/dev/console/core/remote.js).
'use strict';

// Before the game's first script. Not enumerable, so the game's for...in walks over
// globalThis (quicksave, the anti-tamper scan) do not see it. Paste would put the host's
// clipboard in front of the tester: refused before any page handler sees it.
const REMOTE_PAGE_SCRIPT = '<script>(() => {'
  + 'Object.defineProperty(globalThis, "PB2_REMOTE", { value: true });'
  + 'const stop = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };'
  + 'window.addEventListener("paste", stop, true);'
  + 'try { for (const m of ["read", "readText"]) Object.defineProperty(navigator.clipboard, m, { value: () => Promise.reject(new Error("not in remote play")) }); } catch {}'
  + '})();</script>';

// Keys a tester may not send: { key (KeyboardEvent.key), code, ctrl, meta, shift, alt }.
// Paste reads the host's clipboard; the rest open host tools (DevTools, view source,
// print, save page) that remote windows do not have anyway.
function isBlockedKey({ key = '', code = '', ctrl = false, meta = false, shift = false } = {}) {
  const k = String(key).toLowerCase();
  const c = String(code);
  const mod = ctrl || meta;
  if (mod && (k === 'v' || c === 'KeyV')) return true;               // paste
  if (shift && (k === 'insert' || c === 'Insert')) return true;        // paste
  if (mod && shift && ['i', 'j', 'c'].includes(k)) return true;        // DevTools
  if (mod && ['u', 'p', 's', 'o'].includes(k)) return true;           // source, print, save, open
  return false;
}

// Electron's before-input-event gives { key, code, control, meta, shift, alt, type }.
const fromElectronInput = (i) => ({ key: i.key, code: i.code, ctrl: i.control, meta: i.meta, shift: i.shift, alt: i.alt });

function lockDownSession(ses) {
  ses.setPermissionRequestHandler((wc, permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  if (ses.setDevicePermissionHandler) ses.setDevicePermissionHandler(() => false);
  if (ses.setDisplayMediaRequestHandler) ses.setDisplayMediaRequestHandler((req, callback) => callback({}));
}

// gamePrefix: the game's own URL prefix (https://host/h5/versions/<v>/); the page may
// reload itself (the game does after its checks) but not go anywhere else.
function lockDownWindow(win, gamePrefix) {
  const wc = win.webContents;
  win.setMenu(null);
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  const stayHome = (e, url) => { if (!String(url).startsWith(gamePrefix)) e.preventDefault(); };
  wc.on('will-navigate', stayHome);
  wc.on('will-redirect', stayHome);
  wc.on('will-attach-webview', (e) => e.preventDefault());
  wc.on('devtools-opened', () => wc.closeDevTools());
  wc.on('before-input-event', (e, input) => { if (isBlockedKey(fromElectronInput(input))) e.preventDefault(); });
}

// webPreferences for a remote game window (on top of the caller's).
const REMOTE_WEB_PREFERENCES = Object.freeze({
  devTools: false,
  spellcheck: false,
  webviewTag: false,
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  backgroundThrottling: false,
});

module.exports = { REMOTE_PAGE_SCRIPT, REMOTE_WEB_PREFERENCES, isBlockedKey, lockDownSession, lockDownWindow };
