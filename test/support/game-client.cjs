// A headless game client for testing server/: the game's own client code
// (scripts/connection.js, scripts/libs/flash.js and its socket.io) in a vm context,
// speaking to a server like the game page does. Needs the game files (game/).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SCRIPTS = ['_strings.js', 'scripts/libs/socket.io.min.js', 'scripts/libs/tools.js', 'scripts/libs/xml.js', 'scripts/connection.js', 'scripts/libs/flash.js'];
const TICK_MS = 16;
const TO_EVERYONE = 1; // chat destination (frame2.js: 1 everyone, 2 team)

function createClient({ gameDir, names: N, url }) {
  const chat = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, performance, URL, URLSearchParams, TextEncoder, TextDecoder, WebSocket,
    location: { hash: '', href: 'https://www.plazmaburst2.com/', protocol: 'https:', hostname: 'www.plazmaburst2.com' },
    navigator: { userAgent: 'pb2-test-client' },
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const rel of SCRIPTS) vm.runInContext(fs.readFileSync(path.join(gameDir, rel), 'utf8'), ctx, { filename: rel });
  const run = (code) => vm.runInContext(code, ctx);
  // What frame2.js gives the page and this client has no use for.
  Object.assign(ctx, {
    trace() {}, TRACK_MP_LOGS: false, ChatNewMsg: (m) => chat.push(String(m).replace(/<[^>]*>/g, '')),
  });
  run('globalThis.HUD = new Proxy(function () {}, { get: (t, k) => globalThis.HUD, apply: () => undefined });');
  for (const g of ['$pМоcT', '$oеeес']) ctx[g] = () => {}; // the anti-cheat guard pair (frame2.js); nothing to guard here
  run(`${N.setupClass}.${N.setupMethod}(null, null)`); // the digits of encoded numbers
  const net = run(N.net);
  // A message this client cannot act on (it has no game page: loading a level, the HUD)
  // would stop every later one, since reliable messages are handled in order. Here it is
  // only noted. The handler is found by its call in scripts/connection.js.
  const handler = fs.readFileSync(path.join(gameDir, 'scripts/connection.js'), 'utf8')
    .match(new RegExp(`${N.net.replace(/[$]/g, '\\$')}\\.(\\$[0-9A-Za-z_\\u0400-\\u04FF]+)\\(this\\.\\$[0-9A-Za-z_\\u0400-\\u04FF]+\\[0\\],this\\)`))[1];
  const errors = [];
  const handle = net[handler];
  net[handler] = (...a) => { try { return handle.apply(net, a); } catch (e) { errors.push(e.message); return undefined; } };
  const conn = new (run(N.connClass))({ url });
  net.connections.push(conn);
  net[N.lobbyConn] = conn;
  const timer = setInterval(() => { try { net[N.netTick](Date.now()); } catch {} }, TICK_MS);
  const A = run('Array');
  const ask = (parts) => new Promise((resolve) => {
    const out = A.from(parts.map((p) => (p === 'REPLY' ? net[N.netReplyTo] : p)));
    out[0] = net[parts[0]];
    conn[N.netSend](net[N.netChannel], out, (reply) => resolve(Array.from(reply)));
  });
  return {
    net, conn, chat, errors, run,
    ask,
    login: (login, password) => ask(['RELIABLE_AUTHENTICATE', login, password, 'version_h5', 'hash_h5', 'REPLY', 'test', '"test.device"', '1769098189070']),
    list: () => ask(['RELIABLE_GET_MATCH_LIST', '{}', 'REPLY', 'match_list']),
    create: (settings) => ask(['RELIABLE_CREATE_MATCH', JSON.stringify(settings), 'REPLY']),
    join: (uid, password = '') => ask(['RELIABLE_JOIN_MATCH', uid, 'REPLY', -1, '1', password]),
    say: (text) => { net.Event(net.RELIABLE_CHAT, net[N.netNum](TO_EVERYONE), text); },
    closed: () => !!conn[N.connClosed],
    close() { clearInterval(timer); try { conn.Disconnect(); } catch {} },
  };
}

module.exports = { createClient };
