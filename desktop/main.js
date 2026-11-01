// Plazma Burst 2 desktop wrapper.
// Serves the local game copy under its real URL so the game behaves exactly
// like the official site (main server, login cookies, multiplayer).
// Every other request is passed through to the real network.
const { app, BrowserWindow, Menu, dialog, protocol, net, session, ipcMain } = require('electron');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { createKvFile } = require('./kv-file');
// Settings, feature flags and the log, built once by src/wrapper/context.ts.
const { wrapperContext } = require('../src/wrapper/context.ts');
const { environment: ENVIRONMENT, flags: FLAGS, log } = wrapperContext;
const { REMOTE_PAGE_SCRIPT, PARTITION_PREFIX, SCALE_FACTOR_SWITCH, SCALE_FACTOR_ONE, TESTER_SETTINGS_FILE_NAME, FETCH_DEST_HEADER } = require('../src/features/remote_play/keys.ts');
const { REMOTE_WEB_PREFERENCES } = require('../src/features/remote_play/constants.ts');
const { TEXT: REMOTE_TEXT, LOG: REMOTE_LOG } = require('../src/features/remote_play/text.ts');
const { REMOTE_DATA_DIR } = require('../src/features/remote_play/paths.ts');
const { isRefusedPageLoad } = require('../src/features/remote_play/domain/game-page.ts');
const { lockDownSession, lockDownWindow } = require('../src/features/remote_play/adapters/lockdown.ts');
const { startRemotePlay } = require('../src/features/remote_play/wrapper.ts');
const { loadConfig: loadServerConfig } = require('../src/features/p2p_host/adapters/config-file.ts');
const { parseServerArgs } = require('../src/features/p2p_host/domain/config.ts');
const { pageLine } = require('../src/features/p2p_host/domain/page-log.ts');
const { CONFIG_FILE_NAME: SERVER_CONFIG_FILE_NAME, EXAMPLE_CONFIG_FILE_NAME: SERVER_EXAMPLE_FILE_NAME, SETTINGS_FILE_NAME: SERVER_SETTINGS_FILE_NAME } = require('../src/features/p2p_host/keys.ts');
const { RELOAD_AFTER_CRASH_MS, QUIT_AFTER_STOP_MS, MILLISECONDS_PER_SECOND, HOST_WINDOW } = require('../src/features/p2p_host/constants.ts');
const { HOST_LOG } = require('../src/features/p2p_host/text.ts');
// Which game: the official client, or Sad Burst 2 with "npm run sadburst" (src/kernel/config/clients.ts).
const { CLIENTS } = require('../src/kernel/config/clients.ts');
const { TEXT: SADBURST_TEXT } = require('../src/features/client_sadburst/text.ts');
const CLIENT = CLIENTS[ENVIRONMENT.client];
const SADBURST = CLIENT.id === 'sadburst';
const CLIENT_FLAG = CLIENT.runFlag; // in the commands this file tells you to run

// Remote play host: "npm run host" (electron . --host). No window here: every tester who
// opens their link gets an offscreen game instance on this machine, streamed to their
// browser (src/features/remote_play/). Guide: docs/operations/remote-play.md.
const HOST_MODE = ENVIRONMENT.mode === 'remote';
// Frames are exactly the window's size, whatever this screen's scaling.
if (HOST_MODE) app.commandLine.appendSwitch(SCALE_FACTOR_SWITCH, SCALE_FACTOR_ONE);

// Player-hosted dedicated host: "npm run p2p-host" (electron . --p2p-host). One offscreen
// game window hosts a player-hosted match, listed by the official lobby, from
// desktop/p2p-host.json and is driven from this terminal (docs/operations/p2p-host.md).
// Its console settings are its own file.
const SERVER_MODE = ENVIRONMENT.mode === 'server';
const SERVER_CONFIG_FILE = path.join(__dirname, SERVER_CONFIG_FILE_NAME);
const SERVER_KV_FILE = path.join(__dirname, SERVER_SETTINGS_FILE_NAME);

// The server list: src/features/server_list/ (docs/features/server-list.md).
const { LAUNCHER_PAGE, LAUNCHER_PRELOAD } = require('../src/features/server_list/wrapper.ts');
let serverPage = null; // the checked config the page gets as PB2_SERVER

// Game files, downloaded with "npm run fetch-game" (game/; Sad Burst 2: game.sadburst/).
// Override with PB2_GAME_DIR. Sad Burst 2 is served at its real address too: its game page
// sadburst2.com/gameplay/; the rest of its site (login, API) is the network's.
const ROOT = path.resolve(ENVIRONMENT.gameDir || CLIENT.gameDir);
const HOST = CLIENT.host;
const VERSION = readGameVersion();
const PREFIX = CLIENT.gamePrefix(VERSION);
const START_URL = `https://${HOST}${PREFIX}`;

// Hooks: src/features/hooks/ (docs/features/hooks.md); feature flag "hooks".
const HOOKS_ENABLED = FLAGS.hooks.on;

// Dev console (Shift+` key). Feature flag "dev_console" (PB2_DEV=0 turns it off).
const DEV_ENABLED = FLAGS.dev_console.on;
// __dev/ routes of migrated features (src/features/*/wrapper.ts), when their flag is on.
const { createDevRouter, createInterceptor } = require('../src/wrapper/http/router.ts');
const { buildWrapper } = require('../src/wrapper/features.ts');
const { createLogin } = require('../src/features/login/wrapper.ts');
const { pinCertificates } = require('../src/features/cert_pinning/wrapper.ts');
const login = createLogin({ log, desktopDir: __dirname, host: HOST, fromEnvironment: ENVIRONMENT.credentials, isOn: FLAGS.login.on });
const DEV_KV_FILE = path.join(__dirname, CLIENT.settingsFileName);

const liveWindow = () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);
const wrapper = buildWrapper(
  { log, gameVersion: VERSION || '', isSadburst: SADBURST, repoRoot: path.join(__dirname, '..'), gameDir: ROOT, devKvFile: DEV_KV_FILE, host: HOST },
  {
    hooks: { namesFile: CLIENT.names, gamePrefix: PREFIX },
    gameSession: {
      startLoggedOut: () => startLoggedOut(),
      applyCredentials: () => applyCredentials(),
      loadGame: () => { const win = liveWindow(); if (win) win.loadURL(START_URL); },
      showList: () => { const win = liveWindow(); if (win) win.loadFile(LAUNCHER_PAGE); },
      setTitle: (title) => { const win = liveWindow(); if (win) win.setTitle(title); },
    },
  },
);
const serverList = wrapper.serverList;
const joinTarget = () => serverList.service.joinTarget();
const devRouter = createDevRouter(wrapper.features, (id) => FLAGS[id].on);
const intercept = createInterceptor(wrapper.features, (id) => FLAGS[id].on);
const mapCache = wrapper.mapCache;
// Routes and map markers shared with the console (src/shared/contract/).
const { DEV_DIR, ROUTE_NAME: ROUTE, MAP_MARKER, SAVE_RESULT } = require('../src/shared/contract/keys.ts');
const DEV_PREFIX = PREFIX + DEV_DIR;
// The console: one bundle of desktop/dev/console/ in dist/console/ ("npm run build"), served as __dev/console/*.
const DEV_CONSOLE_DIR = path.join(__dirname, '..', 'dist', 'console');
const DEV_CONSOLE_ENTRY = 'index.js';
// Obfuscated game names for this game version, generated by "npm run find-names".
const DEV_NAMES = CLIENT.names;
// The map editor's trigger action names, from "npm run fetch-opcodes" ("triggers exec").
const DEV_OPCODES = CLIENT.opcodes;
// Sad Burst 2 keeps everything apart from the official client (its own settings file, maps
// folder and browser session): its lobby can run code in its page (RELIABLE_TASK,
// docs/research/fingerprinting.md §4), and nothing it writes may reach the official client, e.g. a bind
// running "js ..." in the official game, signed in with your official account.
const gameSession = () => (CLIENT.partition ? session.fromPartition(CLIENT.partition) : session.defaultSession);
// The console and you both change it; see kv-file.js. Edits reach the page through
// pb2dev.reload / pb2dev.fileError.
let mainWindow = null;
const callConsole = (fn, arg) => {
  if (mainWindow) mainWindow.webContents.executeJavaScript(`globalThis.pb2dev && pb2dev.${fn}(${JSON.stringify(arg)})`).catch(() => {});
};
const kvFile = createKvFile(DEV_KV_FILE, {
  onChange: (obj) => callConsole('reload', obj),
  onError: (message) => callConsole('fileError', message),
});
const MAIN_SCRIPT_TAG = '<script src="scripts/main.js"></script><script>//# sourceURL=scripts/main.js</script>';
// The game's own debug output: scripts/flash.js defines "var trace = isCompiled ? () => {}
// : console.log", and served under its real URL the game counts as compiled, so trace()
// prints nothing. At debug level it is pointed at console.debug right after flash.js,
// before the game's scripts that call it (and before window.onload).
const FLASH_SCRIPT_TAG = '<script src="scripts/flash.js"></script>';
const TRACE_SCRIPT_TAG = '<script>trace = console.debug.bind(console, "[trace]");</script>';
// The dedicated host's trace(): a line from ChatNewMsg is a chat line ("[chat]"), the
// rest is the game's debug output as above.
const SERVER_TRACE_SCRIPT_TAG = '<script>trace = function (...a) {'
  + ' if (/\\bChatNewMsg\\b/.test(new Error().stack || "")) console.log("[chat] " + a[0]); else console.debug("[trace]", ...a); };</script>';
// Not enumerable, so the game's walks over globalThis do not see it; "<" escaped so the
// settings cannot end the script.
const serverPageScript = (config) => '<script>Object.defineProperty(globalThis, "PB2_SERVER", { value: Object.freeze('
  + JSON.stringify(config).replace(/</g, '\\u003c') + ') });</script>';
// A private server: where the lobby connection goes and who logs in there (dev console, join/).
const joinPageScript = (join) => '<script>Object.defineProperty(globalThis, "PB2_JOIN", { value: Object.freeze('
  + JSON.stringify({ address: join.hostPort, nickname: join.nickname, password: join.password }).replace(/</g, '\\u003c') + ') });</script>';
// The resolved feature flags (src/wrapper/context.ts), read-only, before the console loads.
const { PAGE_FLAGS_GLOBAL } = require('../src/shared/features/keys.ts');
const FLAGS_SCRIPT_TAG = `<script>Object.defineProperty(globalThis, ${JSON.stringify(PAGE_FLAGS_GLOBAL)}, { value: Object.freeze(`
  + JSON.stringify(FLAGS).replace(/</g, '\\u003c') + ') });</script>';
const DEV_SCRIPT_TAG = FLAGS_SCRIPT_TAG + `<script src="${DEV_DIR}${ROUTE.names}"></script>`
  + `<script src="${DEV_DIR}${ROUTE.opcodes}"></script>`
  + `<script type="module" src="${DEV_DIR}${ROUTE.console}${DEV_CONSOLE_ENTRY}"></script>`;

// The version folder the files came from (written by tools/fetch-game.js). The game is
// served under that same URL so it behaves like the official site.
function readGameVersion() {
  if (ENVIRONMENT.gameVersion) return ENVIRONMENT.gameVersion;
  try {
    return JSON.parse(fsSync.readFileSync(path.join(ROOT, 'pb2-version.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

// Warns when names.js was generated for a different game version.
function checkNamesFile() {
  let text;
  try {
    text = fsSync.readFileSync(DEV_NAMES, 'utf8');
  } catch {
    log.error(`Dev console: ${path.relative(path.join(__dirname, '..'), DEV_NAMES)} is missing. Run "npm run find-names${CLIENT_FLAG}".`);
    return;
  }
  const m = text.match(/^\s*version:\s*"([^"]*)"/m);
  if (m && m[1] !== VERSION) {
    log.error(`Dev console: names.js is for game ${m[1]} but the game is ${VERSION}. Run "npm run find-names${CLIENT_FLAG}".`);
  }
  if (/NOT FOUND/.test(text)) log.error('Dev console: names.js has names that were not found; some commands will fail.');
}

function checkConsoleBundle() {
  if (!fsSync.existsSync(path.join(DEV_CONSOLE_DIR, DEV_CONSOLE_ENTRY))) log.error('Dev console: dist/console/ is missing. Run "npm run build".');
}

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.map': 'application/json',
};

const startLoggedOut = () => login.startLoggedOut(session.defaultSession.cookies);
const applyCredentials = () => login.applyCredentials(session.defaultSession.cookies);

// A file of the console, or null when the path leaves desktop/dev/console.
async function serveConsoleFile(rel) {
  const file = path.resolve(DEV_CONSOLE_DIR, rel);
  if (path.relative(DEV_CONSOLE_DIR, file).startsWith('..') || !types[path.extname(file)]) return null;
  try {
    const data = await fs.readFile(file);
    return new Response(data, { headers: { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

// The dev console's files, and its local key-value store (desktop/dev-overrides.json).

async function serveDev(request, url, ctx) {
  const name = decodeURIComponent(url.pathname.slice(DEV_PREFIX.length));
  const routed = await devRouter(name, request, url, ctx);
  if (routed) return routed;
  if (name.startsWith(ROUTE.console)) {
    const res = await serveConsoleFile(name.slice(ROUTE.console.length));
    if (res) return res;
  }
  if (name === ROUTE.names) {
    let data;
    try {
      data = await fs.readFile(DEV_NAMES);
    } catch {
      data = 'globalThis.PB2_NAMES = null; console.error("names.js missing: run npm run find-names");';
    }
    return new Response(data, { headers: { 'Content-Type': types['.js'], 'Cache-Control': 'no-store' } });
  }
  if (name === ROUTE.opcodes) {
    let data;
    try {
      data = await fs.readFile(DEV_OPCODES);
    } catch {
      data = 'globalThis.PB2_OPCODES = null;';
    }
    return new Response(data, { headers: { 'Content-Type': types['.js'], 'Cache-Control': 'no-store' } });
  }
  if (name === ROUTE.kv) {
    if (request.method === 'PUT') {
      let obj;
      try {
        obj = JSON.parse(await request.text());
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return new Response('Expected a JSON object', { status: 400 });
      }
      if (!(await ctx.kvFile.write(obj))) {
        return new Response('dev-overrides.json was edited; the console reloads it instead', { status: 409 });
      }
      return new Response('ok');
    }
    return new Response(await ctx.kvFile.read(), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  return new Response('Not found', { status: 404 });
}

async function serveLocal(url, ctx) {
  let rel = decodeURIComponent(url.pathname.slice(PREFIX.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if ((DEV_ENABLED || HOOKS_ENABLED || ctx.remote || ctx.server || joinTarget()) && rel === 'index.html') {
    const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
    let out = html;
    if (HOOKS_ENABLED) out = wrapper.hooks.injectIndex(out);
    if (DEV_ENABLED) {
      // After the game's own scripts; fall back to the end of <body> if the tag changed.
      const before = out;
      out = out.includes(MAIN_SCRIPT_TAG)
        ? out.replace(MAIN_SCRIPT_TAG, MAIN_SCRIPT_TAG + DEV_SCRIPT_TAG)
        : out.replace(/<\/body>/i, DEV_SCRIPT_TAG + '</body>');
      if (out === before) log.error('Dev console: could not inject into index.html');
    }
    if (joinTarget() && !ctx.remote && !ctx.server) {
      const at = out.search(/<script\b/i);
      if (at < 0) {
        log.error('Private server: could not prepare index.html (no <script> tag); not serving it');
        return new Response('Not available', { status: 503 });
      }
      out = out.slice(0, at) + joinPageScript(joinTarget()) + out.slice(at);
    }
    if (ctx.server) {
      // The dedicated host: PB2_SERVER before every other script, and chat lines (the
      // game traces each one when asked) to the terminal.
      const at = out.search(/<script\b/i);
      if (at < 0 || !out.includes(FLASH_SCRIPT_TAG)) {
        log.error('Dedicated host: could not prepare index.html (no <script> tag or no scripts/flash.js); not serving it');
        return new Response('Not available', { status: 503 });
      }
      out = out.slice(0, at) + serverPageScript(serverPage) + out.slice(at);
      out = out.replace(FLASH_SCRIPT_TAG, FLASH_SCRIPT_TAG + SERVER_TRACE_SCRIPT_TAG);
    } else if (log.on('debug') && !SADBURST) {
      if (out.includes(FLASH_SCRIPT_TAG)) out = out.replace(FLASH_SCRIPT_TAG, FLASH_SCRIPT_TAG + TRACE_SCRIPT_TAG);
      else log.warn('Verbose: scripts/flash.js not found in index.html; the game\'s trace() stays silent');
    }
    if (ctx.remote) {
      // A tester's game: PB2_REMOTE before every other script (src/features/remote_play/keys.ts).
      // Without it the console would show "js" and the host's paths: no page at all then.
      const at = out.search(/<script\b/i);
      if (at < 0) {
        log.error(REMOTE_LOG.notMarked);
        return new Response('Not available', { status: 503 });
      }
      out = out.slice(0, at) + REMOTE_PAGE_SCRIPT + out.slice(at);
    }
    return new Response(out, { headers: { 'Content-Type': types['.html'] } });
  }
  // A game script some hook changed: served from the plan (the file on disk is untouched).
  const hooked = HOOKS_ENABLED ? wrapper.hooks.changedScript(rel) : null;
  if (hooked !== null) return new Response(hooked, { headers: { 'Content-Type': types['.js'], 'Cache-Control': 'no-store' } });
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const data = await fs.readFile(file);
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' },
    });
  } catch {
    return SADBURST ? fetchAndKeep(url, file, ctx) : new Response('Not found', { status: 404 });
  }
}

// Sad Burst 2: a file fetch-game did not get (it cannot list the site's folders) comes from
// the site the first time the game asks for it, is kept in game.sadburst/, and is listed in
// game.sadburst/kept.txt, so the next "npm run fetch-game -- --sadburst" gets it too
// (tools/fetch-sadburst.js). The site answers a missing file with its game page (HTML):
// that is "not found", not kept.
const KEPT_FILE = path.join(ROOT, 'kept.txt');
let keptList = null; // what kept.txt lists
async function noteKept(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (!keptList) {
    try { keptList = new Set((await fs.readFile(KEPT_FILE, 'utf8')).split(/\r?\n/).filter(Boolean)); } catch { keptList = new Set(); }
  }
  if (keptList.has(rel)) return;
  keptList.add(rel);
  await fs.appendFile(KEPT_FILE, rel + '\n');
}
async function fetchAndKeep(url, file, ctx) {
  let res;
  try {
    res = await ctx.fetch(url.href);
  } catch (e) {
    return new Response(`Not found (${e.message})`, { status: 404 });
  }
  const type = res.headers.get('content-type') || '';
  if (!res.ok || (/text\/html/.test(type) && !/\.html?$/.test(file))) return new Response('Not found', { status: 404 });
  const data = Buffer.from(await res.arrayBuffer());
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    await noteKept(file);
    log.debug(`[sadburst] kept ${path.relative(ROOT, file)} (${data.length} bytes)`);
  } catch (e) {
    log.warn(`Sad Burst 2: could not keep ${file}: ${e.message}`);
  }
  return new Response(data, { status: 200, headers: { 'Content-Type': type || types[path.extname(file)] || 'application/octet-stream' } });
}

// Sad Burst 2: says when the site has a newer build than game.sadburst/. Its loader sends a
// hash of the scripts with the login, so an old copy may be refused.
async function checkSadburstBuild() {
  try {
    const local = JSON.parse(fsSync.readFileSync(path.join(ROOT, 'pb2-version.json'), 'utf8')).build;
    const res = await net.fetch(`${CLIENT.site}${PREFIX}asset-version.txt`, { bypassCustomProtocolHandlers: true, cache: 'no-store' });
    const live = res.ok ? (await res.text()).trim().split(/\r?\n/)[0] : null;
    if (live && local && live !== local) log.warn(`Sad Burst 2: the site has build ${live}, game.sadburst/ is ${local}. Run "npm run fetch-game -- --sadburst".`);
  } catch {}
}

app.whenReady().then(async () => {
  if (SADBURST && !FLAGS.client_sadburst.on) {
    log.error(SADBURST_TEXT.flagOff);
    app.quit();
    return;
  }
  if (!VERSION || !fsSync.existsSync(path.join(ROOT, 'index.html'))) {
    const msg = `No game files found in ${ROOT}.\n\nRun "npm run fetch-game${CLIENT_FLAG}" first (see README.md).`;
    log.error(msg);
    dialog.showErrorBox(`${CLIENT.title}: game files missing`, msg);
    app.quit();
    return;
  }
  if (SADBURST && (HOST_MODE || SERVER_MODE)) {
    log.error('Sad Burst 2: remote play and the player-hosted host are for the official client only.');
    app.quit();
    return;
  }
  if (HOST_MODE && !FLAGS.remote_play.on) {
    log.error(REMOTE_LOG.flagOff);
    app.quit();
    return;
  }
  if (SERVER_MODE && !FLAGS.p2p_host.on) {
    log.error(HOST_LOG.flagOff);
    app.quit();
    return;
  }
  log.info(`${SADBURST ? `${CLIENT.title}: ` : ''}Game ${VERSION} from ${ROOT}`);
  if (SADBURST) {
    if (FLAGS.hooks.source === 'constraint') log.info('Sad Burst 2: hooks are off (its loader sends a hash of the game scripts with the login; docs/features/hooks.md).');
    checkSadburstBuild();
  }
  log.debug(`Log level: debug (requests, window events, the game's trace() output)`);
  if (DEV_ENABLED) { checkNamesFile(); checkConsoleBundle(); }
  // Remote play and the player-hosted host play on the official server; the window picks.
  if (HOST_MODE || SERVER_MODE) await applyCredentials();
  else if (FLAGS.cert_pinning.on) pinCertificates(session.defaultSession, joinTarget, log);

  if (SADBURST) gameSession().protocol.handle('https', (request) => handleRequestLogged(request, LOCAL_CTX));
  else protocol.handle('https', (request) => handleRequestLogged(request, SERVER_MODE ? SERVER_CTX : LOCAL_CTX));

  // Electron's default menu without Window > Close, whose Ctrl+W closed the game. The
  // rest stays: Quit (Ctrl+Q), copy/paste, reload, DevTools, zoom, full screen.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'fileMenu' },
    // No shortcut: every key is the player's to bind in the dev console. Also "servers page".
    ...(HOST_MODE || SERVER_MODE || !FLAGS.server_list.on ? [] : [{ label: 'Servers', submenu: [{ label: 'Server list', click: () => serverList.service.showList() }] }]),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { label: 'Window', submenu: [{ role: 'minimize' }] },
  ]));

  if (HOST_MODE) {
    await startRemoteHost();
    return;
  }
  if (SERVER_MODE) {
    await startDedicatedServer();
    return;
  }

  const win = mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    title: CLIENT.title,
    // The server list's bridge (src/features/server_list/launcher/preload.ts); it exposes nothing to the game's
    // page. Sad Burst 2: its own session, and no bridge at all.
    webPreferences: SADBURST
      ? { backgroundThrottling: false, partition: CLIENT.partition }
      : { backgroundThrottling: false, preload: LAUNCHER_PRELOAD },
  });
  logPage(win, '');

  if (DEV_ENABLED) {
    try { kvFile.watch(); } catch (e) { log.warn(`Not watching ${DEV_KV_FILE}: ${e.message}`); }
  }
  if (!FLAGS.server_list.on) {
    // No server list (feature flag off, or Sad Burst 2, which has its own servers and
    // accounts): straight to the game page.
    win.loadURL(START_URL);
    return;
  }
  serverList.service.importOldJoinFile();
  serverList.registerIpc(ipcMain);
  serverList.service.showList();
});

// Who a request comes from. The local window: the default session (Sad Burst 2: its own),
// the shared dev-overrides.json. A tester's game: their own session, settings file and window.
const LOCAL_CTX = Object.freeze({
  remote: false,
  name: '',
  fetch: (request) => (SADBURST ? gameSession().fetch.bind(gameSession()) : net.fetch)(request, { bypassCustomProtocolHandlers: true }),
  kvFile,
  get window() { return mainWindow; },
});

// Every request of a game page: local game files, the console's and the hooks' routes,
// map downloads. Everything else goes to the network.
async function handleRequest(request, ctx) {
  const url = new URL(request.url);
  // A tester's window shows the game's start page and nothing else: a page load of any
  // other file (the console's source, a hook) is refused here too, not only by the lockdown.
  if (ctx.remote && isRefusedPageLoad(request.headers.get(FETCH_DEST_HEADER), request.url, START_URL)) {
    return new Response(REMOTE_TEXT.notAvailable, { status: 403 });
  }
  const intercepted = await intercept(request, url, ctx);
  if (intercepted) return intercepted;
  if (url.hostname === HOST && url.pathname.startsWith(PREFIX)) {
    if (DEV_ENABLED && url.pathname.startsWith(DEV_PREFIX)) return serveDev(request, url, ctx);
    return serveLocal(url, ctx);
  }
  return ctx.fetch(request);
}

// Debug level: every request, where it was answered from, its status and how long.
async function handleRequestLogged(request, ctx) {
  if (!log.on('debug')) return handleRequest(request, ctx);
  const started = Date.now();
  const res = await handleRequest(request, ctx);
  log.debug(`[net]${ctx.name ? ` [${ctx.name}]` : ''} ${request.method} ${request.url} -> ${res.status} (${Date.now() - started} ms)`);
  return res;
}

// The page's console (the game's and the dev console's) in this terminal, by level
// (console.debug and trace() only with --verbose), and the window's own events.
// who: '' for the local window, a tester's name for theirs.
const PAGE_LEVEL = Object.freeze({ error: 'error', warning: 'warn', info: 'info', log: 'info', debug: 'debug', verbose: 'debug' });
function logPage(win, who) {
  const tag = who ? ` ${who}` : '';
  win.webContents.on('console-message', (e) => {
    const src = e.sourceId ? ` (${e.sourceId.split('/').pop()}:${e.lineNumber})` : '';
    log[PAGE_LEVEL[e.level] || 'info'](`[page${tag}:${e.level}] ${e.message}${src}`);
  });
  win.webContents.on('did-fail-load', (e, code, desc, url) => log.error(`[window${tag}] failed to load ${url}: ${desc} (${code})`));
  win.webContents.on('render-process-gone', (e, d) => log.error(`[window${tag}] the page's process is gone: ${d.reason} (exit code ${d.exitCode})`));
  win.on('unresponsive', () => log.warn(`[window${tag}] the page stopped responding`));
  win.on('responsive', () => log.info(`[window${tag}] the page responds again`));
  win.webContents.on('did-navigate', (e, url) => log.debug(`[window${tag}] navigated to ${url}`));
  win.webContents.on('did-finish-load', () => log.debug(`[window${tag}] page loaded`));
}

// ---------------------------------------------------------------------------
// Remote play host (src/features/remote_play/)
// ---------------------------------------------------------------------------
const remoteCtx = new Map(); // tester name -> their request context (read by their session's handler)

// A tester's session: its own cookies and storage (persist:remote-<name>, so saves and
// settings survive), locked down, logged in like the local window, and its requests
// answered with their context.
async function remoteSession(name) {
  const ses = session.fromPartition(PARTITION_PREFIX + name);
  let ctx = remoteCtx.get(name);
  if (!ctx) {
    lockDownSession(ses);
    const dir = path.join(REMOTE_DATA_DIR, name);
    await fs.mkdir(dir, { recursive: true });
    ctx = {
      remote: true,
      name,
      window: null,
      fetch: (request) => ses.fetch(request, { bypassCustomProtocolHandlers: true }),
      kvFile: createKvFile(path.join(dir, TESTER_SETTINGS_FILE_NAME), { onChange() {}, onError() {} }),
    };
    remoteCtx.set(name, ctx);
    ses.protocol.handle('https', (request) => handleRequestLogged(request, ctx));
  }
  await login.applyQuietly(ses.cookies);
  return { ses, ctx };
}

// One tester's game: an offscreen, muted, locked-down game window. Returns the game
// object src/features/remote_play/services/host.ts expects.
async function createRemoteGame(tester, opt) {
  const { ses, ctx } = await remoteSession(tester.name);
  const win = new BrowserWindow({
    show: false,
    width: opt.width,
    height: opt.height,
    useContentSize: true,
    title: REMOTE_TEXT.windowTitle(tester.name),
    webPreferences: { ...REMOTE_WEB_PREFERENCES, session: ses, offscreen: true },
  });
  lockDownWindow(win, START_URL);
  win.webContents.setAudioMuted(true);
  win.webContents.setFrameRate(opt.fps);
  logPage(win, tester.name);
  ctx.window = win;

  const frameFns = new Set();
  win.webContents.on('paint', (e, dirty, image) => {
    if (!frameFns.size) return;
    let jpeg = null;
    const encode = () => (jpeg = jpeg || image.toJPEG(opt.quality));
    for (const fn of frameFns) fn(encode);
  });
  const goneFns = [];
  let gone = false;
  const markGone = () => { if (gone) return; gone = true; for (const fn of goneFns) fn(); };
  win.webContents.on('render-process-gone', markGone);
  win.on('closed', markGone);

  await win.loadURL(START_URL);
  return {
    size: { width: opt.width, height: opt.height },
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    sendInput(event) { if (!win.isDestroyed()) win.webContents.sendInputEvent(event); },
    focus() { if (!win.isDestroyed()) win.webContents.focus(); },
    refresh() { if (!win.isDestroyed()) win.webContents.invalidate(); },
    destroy() { gone = true; if (ctx.window === win) ctx.window = null; if (!win.isDestroyed()) win.destroy(); },
    onGone(fn) { goneFns.push(fn); },
  };
}

async function startRemoteHost() {
  const host = await startRemotePlay({ log, args: ENVIRONMENT.args }, createRemoteGame);
  if (!host) app.quit();
}

// ---------------------------------------------------------------------------
// Player-hosted dedicated host (src/features/p2p_host/)
// ---------------------------------------------------------------------------
// The host's window: the default session (logged in like "npm start"), its own console
// settings file, and PB2_SERVER on its page.
const serverKvFile = SERVER_MODE ? createKvFile(SERVER_KV_FILE, {
  onChange: (obj) => callConsole('reload', obj),
  onError: (message) => callConsole('fileError', message),
}) : null;
const SERVER_CTX = Object.freeze({
  remote: false,
  server: true,
  name: '',
  fetch: (request) => net.fetch(request, { bypassCustomProtocolHandlers: true }),
  kvFile: serverKvFile,
  get window() { return mainWindow; },
});

// Its page's console in the terminal: the console's own lines and chat as plain text,
// errors as errors, the game's other output only with --verbose.
function logServerPage(win) {
  win.webContents.on('console-message', (e) => {
    const line = pageLine({ message: String(e.message), level: e.level, sourceId: e.sourceId, lineNumber: e.lineNumber });
    log[line.level](line.text);
  });
  win.webContents.on('did-fail-load', (e, code, desc, url) => log.error(HOST_LOG.failedLoad(url, desc, code)));
  win.on('unresponsive', () => log.warn(HOST_LOG.unresponsive));
  win.on('responsive', () => log.info(HOST_LOG.responsive));
}

async function startDedicatedServer() {
  const { config, problems: argProblems } = parseServerArgs(ENVIRONMENT.args);
  for (const p of argProblems) log.warn(HOST_LOG.problem(p));
  const file = config ? path.resolve(config) : SERVER_CONFIG_FILE;
  const loaded = loadServerConfig(file);
  if (loaded.missing) {
    log.error(HOST_LOG.missingConfig(file, path.join('desktop', SERVER_EXAMPLE_FILE_NAME)));
    app.quit();
    return;
  }
  for (const p of loaded.problems) log.warn(HOST_LOG.problem(p));
  if (loaded.errors.length) {
    for (const p of loaded.errors) log.error(HOST_LOG.problem(p));
    log.error(HOST_LOG.fixConfig(file));
    app.quit();
    return;
  }
  if (!DEV_ENABLED) {
    log.error(HOST_LOG.needsConsole);
    app.quit();
    return;
  }
  if (!fsSync.existsSync(DEV_NAMES)) log.warn(HOST_LOG.namesMissing);
  if (loaded.server.local_map && !(await mapCache.findLocalMap(loaded.server.local_map))) {
    log.error(HOST_LOG.localMapMissing(loaded.server.local_map, mapCache.mapsDir));
    app.quit();
    return;
  }
  serverPage = { match: loaded.match, server: loaded.server };
  log.info(HOST_LOG.settingsFrom(file));

  const win = mainWindow = new BrowserWindow({
    show: false,
    width: HOST_WINDOW.width,
    height: HOST_WINDOW.height,
    useContentSize: true,
    title: HOST_LOG.windowTitle,
    webPreferences: { backgroundThrottling: false, offscreen: true },
  });
  win.webContents.setAudioMuted(true);
  win.webContents.setFrameRate(loaded.server.fps);
  if (loaded.server.udp_ports) {
    win.webContents.setWebRTCUDPPortRange(loaded.server.udp_ports);
    log.info(HOST_LOG.udpPorts(loaded.server.udp_ports.min, loaded.server.udp_ports.max));
  }
  logServerPage(win);
  win.webContents.on('render-process-gone', (e, d) => {
    log.error(HOST_LOG.processGone(d.reason, d.exitCode, RELOAD_AFTER_CRASH_MS / MILLISECONDS_PER_SECOND));
    setTimeout(() => { if (!win.isDestroyed()) win.loadURL(START_URL); }, RELOAD_AFTER_CRASH_MS);
  });
  try { serverKvFile.watch(); } catch (e) { log.warn(HOST_LOG.notWatching(SERVER_KV_FILE, e.message)); }

  // The terminal: every line is a console command; "quit" ends the match and closes.
  let quitting = false;
  const quit = () => {
    if (quitting) { app.exit(0); return; }
    quitting = true;
    log.info(HOST_LOG.quitting);
    win.webContents.executeJavaScript('globalThis.pb2dev && pb2dev.run("server stop")').catch(() => {});
    setTimeout(() => app.quit(), QUIT_AFTER_STOP_MS);
  };
  const rl = require('readline').createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) return;
    if (/^(quit|exit)$/i.test(text)) { quit(); return; }
    win.webContents.executeJavaScript(`globalThis.pb2dev ? (pb2dev.run(${JSON.stringify(text)}), true) : false`)
      .then((ok) => { if (!ok) log.warn(HOST_LOG.consoleNotLoaded); })
      .catch((e) => log.error(HOST_LOG.problem(e.message)));
  });
  rl.on('close', () => { if (!quitting) log.info(HOST_LOG.inputClosed); });
  process.on('SIGINT', quit);

  log.info(HOST_LOG.starting);
  await win.loadURL(START_URL);
}

// Host mode has no window of its own; the testers' games come and go.
app.on('window-all-closed', () => { if (!HOST_MODE) app.quit(); });
