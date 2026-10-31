// Remote play server: testers open a link in any browser and play a game instance that
// runs on this machine. They receive only video frames (JPEG) and send only keys and
// mouse (desktop/remote/input.js), so no file of the project ever leaves this machine.
//
//   browser  --- GET /, /client.js, /client.css --->  this server (the client page only)
//   browser  <== WebSocket /ws: frames out, input in ==>  one game instance per tester
//
// One game instance per tester, made on their first connect (createGame, from
// desktop/main.js: an offscreen, locked-down game window). It is kept for IDLE_MS after
// they leave, so a reconnect continues the same game; then it is closed. A second
// connect with the same link takes the game over from the first.
//
// This module knows nothing about Electron. A game is:
//   { size: { width, height }, onFrame(fn) -> unsubscribe, sendInput(event), focus(),
//     refresh(), destroy(), onGone(fn) }
// where onFrame's fn gets encode() -> JPEG Buffer, called only when the frame is sent.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { toInputEvents, releaseAll } = require('./input');
const { findTester } = require('./testers');

const CLIENT_DIR = path.join(__dirname, 'client');
// The only files this server ever sends.
const CLIENT_FILES = Object.freeze({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/client.js': ['client.js', 'text/javascript; charset=utf-8'],
  '/client.css': ['client.css', 'text/css; charset=utf-8'],
});
const HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
});

const WS_PATH = '/ws';
const HELLO_TIMEOUT_MS = 5000;     // the page must send its token this soon
const PING_MS = 20000;             // dead connections are dropped after one missed ping
const MAX_PAYLOAD = 4096;          // input messages are tiny
const MAX_INPUT_PER_S = 600;       // more is dropped (a stuck or hostile client)
const MAX_BUFFERED = 1.5e6;        // bytes waiting to go out: frames are skipped above this

const CLOSE = Object.freeze({ badToken: 4001, replaced: 4002, full: 4003, gone: 4004, protocol: 4005 });

const DEFAULTS = Object.freeze({ port: 8787, bind: '127.0.0.1', maxGames: 4, fps: 30, idleMs: 120000 });

function startHost(options) {
  const opt = { ...DEFAULTS, ...options };
  const { testersFile, createGame, log } = opt;
  const games = new Map(); // tester name -> { name, game, ws, idleTimer, pressed: Set, starting }
  const minFrameMs = 1000 / opt.fps;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const file = req.method === 'GET' && CLIENT_FILES[url.pathname];
    if (!file) { res.writeHead(404, HEADERS); res.end('Not found'); return; }
    fs.readFile(path.join(CLIENT_DIR, file[0]), (err, data) => {
      if (err) { res.writeHead(500, HEADERS); res.end(); return; }
      res.writeHead(200, { ...HEADERS, 'Content-Type': file[1] });
      res.end(data);
    });
  });

  const wss = new WebSocketServer({ server, path: WS_PATH, maxPayload: MAX_PAYLOAD });

  const sendJson = (ws, obj) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
  const refuse = (ws, code, message) => { sendJson(ws, { t: 'error', message }); ws.close(code, message.slice(0, 120)); };

  function closeGame(entry, why) {
    entry.closed = true;
    clearTimeout(entry.idleTimer);
    games.delete(entry.name);
    try { entry.game.destroy(); } catch {}
    log.info(`[remote] ${entry.name}: game closed (${why})`);
  }

  function detach(entry, ws) {
    if (entry.ws !== ws) return;
    if (entry.unsubscribe) entry.unsubscribe();
    entry.unsubscribe = null;
    for (const ev of releaseAll(entry.pressed)) entry.game.sendInput(ev);
    entry.pressed.clear();
    entry.ws = null;
    if (entry.closed) return; // already gone (host stopped, game crashed)
    entry.idleTimer = setTimeout(() => closeGame(entry, `nobody connected for ${Math.round(opt.idleMs / 1000)} s`), opt.idleMs);
  }

  function attach(entry, ws) {
    clearTimeout(entry.idleTimer);
    entry.ws = ws;
    let last = 0;
    entry.unsubscribe = entry.game.onFrame((encode) => {
      if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > MAX_BUFFERED) return;
      const now = Date.now();
      if (now - last < minFrameMs) return;
      last = now;
      ws.send(encode(), { binary: true });
    });
    sendJson(ws, { t: 'ready', name: entry.name, ...entry.game.size });
    entry.game.focus();
    entry.game.refresh(); // a still screen sends no frames by itself

    let windowStart = Date.now();
    let count = 0;
    ws.on('message', (data, isBinary) => {
      if (isBinary || entry.ws !== ws) return;
      const now = Date.now();
      if (now - windowStart >= 1000) { windowStart = now; count = 0; }
      if (++count > MAX_INPUT_PER_S) return;
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }
      const events = toInputEvents(msg, entry.game.size);
      // Keys that reached the game, to release when the tester leaves (not blocked ones).
      if (events.length && msg.t === 'kd') entry.pressed.add(msg.code);
      if (msg && msg.t === 'ku') entry.pressed.delete(msg.code);
      for (const ev of events) entry.game.sendInput(ev);
    });
    ws.on('close', () => detach(entry, ws));
  }

  async function welcome(ws, token) {
    const tester = findTester(testersFile, token);
    if (!tester) { refuse(ws, CLOSE.badToken, 'This link is not valid. Ask the host for a new one.'); return; }
    let entry = games.get(tester.name);
    if (entry && entry.ws) {
      sendJson(entry.ws, { t: 'error', message: 'This game was opened somewhere else.' });
      entry.ws.close(CLOSE.replaced, 'opened somewhere else');
      detach(entry, entry.ws);
    }
    if (!entry) {
      if (games.size >= opt.maxGames) {
        refuse(ws, CLOSE.full, `The host is full (${opt.maxGames} players). Try again later.`);
        log.warn(`[remote] ${tester.name}: refused, ${opt.maxGames} games already running`);
        return;
      }
      entry = { name: tester.name, game: null, ws: null, idleTimer: null, pressed: new Set(), unsubscribe: null, closed: false };
      games.set(tester.name, entry);
      try {
        entry.game = await createGame(tester);
      } catch (e) {
        games.delete(tester.name);
        log.error(`[remote] ${tester.name}: could not start a game: ${e.message}`);
        refuse(ws, CLOSE.gone, 'The game could not start. Tell the host.');
        return;
      }
      entry.game.onGone(() => {
        if (entry.ws) refuse(entry.ws, CLOSE.gone, 'The game stopped. Reload this page to start a new one.');
        closeGame(entry, 'the game process ended');
      });
      log.info(`[remote] ${tester.name}: game started (${games.size}/${opt.maxGames})`);
    } else if (!entry.game) {
      refuse(ws, CLOSE.protocol, 'The game is still starting. Reload in a moment.');
      return;
    }
    if (ws.readyState !== WebSocket.OPEN) { detach(entry, null); return; }
    log.info(`[remote] ${tester.name}: connected`);
    attach(entry, ws);
    ws.on('close', () => log.info(`[remote] ${tester.name}: disconnected`));
  }

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const timer = setTimeout(() => refuse(ws, CLOSE.protocol, 'No hello.'), HELLO_TIMEOUT_MS);
    ws.once('close', () => clearTimeout(timer));
    ws.once('message', (data, isBinary) => {
      clearTimeout(timer);
      let msg = null;
      try { msg = isBinary ? null : JSON.parse(String(data)); } catch {}
      if (!msg || msg.t !== 'hello') { refuse(ws, CLOSE.protocol, 'Expected hello.'); return; }
      welcome(ws, msg.token).catch((e) => { log.error(`[remote] ${e.stack || e}`); refuse(ws, CLOSE.gone, 'Host error.'); });
    });
  });

  const pinger = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, PING_MS);

  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opt.port, opt.bind, () => resolve(server.address().port));
  });

  return {
    ready,
    sessions: () => [...games.values()].map((e) => ({ name: e.name, connected: !!e.ws })),
    async close() {
      clearInterval(pinger);
      for (const ws of wss.clients) ws.terminate();
      for (const e of [...games.values()]) closeGame(e, 'host stopped');
      await new Promise((r) => wss.close(() => { server.close(() => r()); server.closeAllConnections(); }));
    },
  };
}

// --host options from the command line: --port=N --bind=ADDR --public --max=N --fps=N
// --quality=N --size=WxH. Returns { options, problems }.
function parseHostArgs(argv) {
  const out = { port: DEFAULTS.port, bind: DEFAULTS.bind, maxGames: DEFAULTS.maxGames, fps: DEFAULTS.fps, quality: 60, width: 960, height: 540 };
  const problems = [];
  const int = (v, min, max, name) => {
    const n = Number(v);
    if (Number.isInteger(n) && n >= min && n <= max) return n;
    problems.push(`--${name} must be a whole number from ${min} to ${max}`);
    return undefined;
  };
  for (const a of argv) {
    const m = /^--(port|bind|max|fps|quality|size)=(.+)$/.exec(a);
    if (a === '--public') out.bind = '0.0.0.0';
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'port') out.port = int(v, 1, 65535, k) ?? out.port;
    else if (k === 'bind') out.bind = v;
    else if (k === 'max') out.maxGames = int(v, 1, 64, k) ?? out.maxGames;
    else if (k === 'fps') out.fps = int(v, 1, 60, k) ?? out.fps;
    else if (k === 'quality') out.quality = int(v, 10, 100, k) ?? out.quality;
    else if (k === 'size') {
      const s = /^(\d+)x(\d+)$/.exec(v);
      if (s && +s[1] >= 320 && +s[1] <= 1920 && +s[2] >= 180 && +s[2] <= 1080) { out.width = +s[1]; out.height = +s[2]; }
      else problems.push('--size must be WIDTHxHEIGHT, from 320x180 to 1920x1080');
    }
  }
  return { options: out, problems };
}

module.exports = { startHost, parseHostArgs, CLOSE, WS_PATH, DEFAULTS };
