// The game's own lobby server, run in Node. The official server runs the same code the
// game ships to every client: scripts/libs/flash.js and scripts/connection.js hold the
// server's side of every message (logging in, the match list, creating and joining
// matches, the match owner's commands, rounds, maps), switched on by one flag. Only
// three server-only parts are not shipped, and this file stands in for them:
//   - the account module (names.p2pAuth): logins, player records, logs, reports. Built
//     from how the game's code uses each of its members (a Map, a list, a function or a
//     constant), with real versions of the few that matter;
//   - the server's timing statistics (names.serverStats): ignored;
//   - its web requests (names.webRequests): the one it makes loads a match's map,
//     answered from desktop/maps or the site's public map download.
// The code runs in a vm context of its own; nothing here patches it. Names come from
// tools/find-names.js, read from the game files at start.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// What the server needs of the game, in load order (index.html's order).
const SCRIPTS = Object.freeze(['_strings.js', 'scripts/libs/tools.js', 'scripts/libs/xml.js', 'scripts/connection.js', 'scripts/libs/flash.js']);
const TICK_MS = 16; // the game's own network tick on a socket connection (connection.js)
const FIRST_UID = 1000; // account uids; the game's guest uid is far above
const REPUTATION = 40; // enough for every "min reputation" a match can ask
const MAX_NICKNAME = 20;
const NICKNAME = /^[A-Za-z0-9 _.\-]+$/;
const MAP_SPLIT = '[^c]';
const MAP_JOIN = '[^#]';
const MAX_MAP_PLAYERS = 64;
const SITE_MAPS = 'https://www.plazmaburst2.com/pb2/server.php';
// Map IDs the create screen offers that are not maps: the official map service picks a
// random approved map for them. With rotation on, the rotation list is the same word, so
// every round asks again.
const RANDOM = Object.freeze(['random approved', 'random approved in rotation']);

const ID = '[0-9A-Za-z_\\u0400-\\u04FF$]';

// How the game's code uses each member of `obj` in `src`: { member: 'map' | 'list' | 'fn' | 'value' }.
function memberShapes(src, obj) {
  const esc = obj.replace(/[$]/g, '\\$');
  const re = new RegExp(`(?<![0-9A-Za-z_\\u0400-\\u04FF$.])${esc}\\.(\\$${ID}+)(\\.(?:get|set|has|delete|clear)\\(|\\.length|\\[|\\()?`, 'g');
  const shapes = {};
  for (const m of src.matchAll(re)) {
    const use = m[2] || '';
    const shape = /^\.(get|set|has|delete|clear)\(/.test(use) ? 'map' : use === '.length' || use === '[' ? 'list' : use === '(' ? 'fn' : 'value';
    if (!shapes[m[1]] || shapes[m[1]] === 'value') shapes[m[1]] = shape;
  }
  return shapes;
}

// Something that answers to anything: every property is itself, calling it does nothing.
function nothing() {
  const f = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : f), apply: () => undefined });
  return f;
}

const plainText = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

class GameServer {
  // names: from tools/find-names.js. config: server/config.js checkConfig().server.
  // log: { info, warn, error, debug }. maps: { local(id) -> text|null, download(id) -> Promise<text|null> }.
  constructor({ gameDir, names, config, log, maps }) {
    this.gameDir = gameDir;
    this.N = names;
    this.config = config;
    this.log = log;
    this.maps = maps;
    this.nextUid = FIRST_UID;
    this.bans = new Set(config.bans.map((b) => b.toLowerCase()));
    this.timer = null;
    this.load();
  }

  run(code) { return vm.runInContext(code, this.ctx); }

  load() {
    const N = this.N;
    const ctx = {
      console: { log: (...a) => this.log.debug('[game]', ...a), warn: (...a) => this.log.debug('[game:warn]', ...a), error: (...a) => this.log.warn('[game:error]', ...a), info: () => {}, debug: () => {} },
      setTimeout, clearTimeout, setInterval, clearInterval, performance, URL, URLSearchParams, TextEncoder, TextDecoder,
      location: { hash: '', href: 'https://www.plazmaburst2.com/', protocol: 'https:' },
      navigator: { userAgent: 'pb2-server' },
    };
    ctx.globalThis = ctx;
    ctx.window = ctx;
    vm.createContext(ctx);
    this.ctx = ctx;
    const sources = SCRIPTS.map((rel) => [rel, fs.readFileSync(path.join(this.gameDir, rel), 'utf8')]);
    for (const [rel, src] of sources) vm.runInContext(src, ctx, { filename: rel });
    // What the browser page has and the server code still reaches for now and then.
    ctx.trace = (...a) => this.log.debug('[trace]', ...a);
    ctx.ChatNewMsg = (m) => this.log.debug('[game chat]', plainText(m));
    ctx.TRACK_MP_LOGS = false;
    ctx.HUD = nothing();

    this.net = this.run(N.net);
    this.Conn = this.run(N.connClass);
    this.net[N.serverFlag] = true;
    this.run(N.setupClass)[N.setupMethod](null, null); // the digits of encoded numbers

    const code = sources.map(([, src]) => src).join('\n');
    ctx[N.p2pAuth] = this.accounts(code);
    ctx[N.serverStats] = nothing();
    ctx[N.webRequests] = { [N.webRequest]: (a, url, method, fields, done) => this.mapRequest(fields, done) };
    ctx[N.mapUrl] = SITE_MAPS;
    ctx[N.mapKey] = '';
    ctx[N.mapRequest] = 'map';
  }

  // The account module: every member the code uses, in the shape it uses it, then the
  // ones with real work.
  accounts(code) {
    const N = this.N;
    const realm = this.run('({ Map, Array })');
    const acc = {};
    for (const [member, shape] of Object.entries(memberShapes(code, N.p2pAuth))) {
      acc[member] = shape === 'map' ? new realm.Map() : shape === 'list' ? new realm.Array() : shape === 'fn' ? () => undefined : `log:${member}`;
    }
    acc[N.p2pAuthIds] = new WeakMap();
    acc[N.authRecords] = new realm.Map();
    acc[N.authLogin] = (conn, version, hash, login, password, uid, device, build, done) => {
      let why = null;
      try { why = this.login(conn, String(login ?? ''), String(password ?? '')); } catch (e) { why = `Server: ${e.message}`; }
      done(why);
    };
    const notKept = 'Server: This server keeps no reputation; nothing was changed';
    acc[N.authReport] = () => notKept;
    acc[N.authEndorse] = () => notKept;
    acc[N.authBan] = (targetId) => {
      const rec = acc[N.authRecords].get(targetId);
      if (!rec) return 'Error: Target user wasn\'t online for too long';
      this.ban(rec.entry.login, 'banned by a server admin');
      return 'Server: User has been banned from this server';
    };
    acc[N.authCheat] = (conn, reason, code, detail) => this.cheatReport(conn, reason, code, detail);
    acc[N.authLog] = (conn, kind, text, match) => this.event(conn, kind, text, match);
    this.acc = acc;
    return acc;
  }

  // Returns null when they may log in, or the reason they may not.
  login(conn, login, password) {
    const N = this.N;
    const c = this.config;
    if (c.password && password !== c.password) return 'Server: Wrong server password (Servers > Server list > Edit)';
    const nickname = login.trim();
    if (!nickname || nickname === '.guest') return 'Server: This server needs a nickname (Servers > Server list > Edit)';
    if (nickname.length > MAX_NICKNAME || !NICKNAME.test(nickname)) return `Server: Nicknames are 1-${MAX_NICKNAME} letters, digits, spaces and _ . -`;
    const key = nickname.toLowerCase();
    if (c.nicknames.length && !c.nicknames.includes(key)) return 'Server: This nickname is not on the server\'s list';
    if (this.bans.has(key) || (conn.ip && this.bans.has(conn.ip))) return 'Server: You are banned from this server';
    if (this.online().some((o) => o.nickname.toLowerCase() === key)) return 'Server: That nickname is already playing here';
    if (this.online().length >= c.max_players) return 'Server: The server is full';

    const uid = this.nextUid++;
    const staff = c.admins.includes(key);
    conn[N.connUser] = {
      nickname, login: nickname, login_proof: '', uid, mdl: String(c.skin), mdl2: '0', is_staff: staff, is_guest: false,
      is_vpn: false, is_public_supporter: false, support_months: 0,
    };
    conn[N.connStats] = { reputation: REPUTATION, key: `nick:${key}`, skill: 0, wins: 0, loses: 0 };
    conn[N.connDevice] = { [N.deviceId]: () => null };
    this.acc[N.p2pAuthIds].set(conn, { id: uid });
    this.acc[N.authRecords].set(uid, { connection: conn, entry: { login: nickname, nickname, reputation: REPUTATION } });
    this.log.info(`+ ${nickname} logged in from ${conn.ip}${staff ? ' (admin)' : ''}`);
    if (c.welcome) setTimeout(() => { if (!conn[N.connClosed]) conn[N.connSay](c.welcome); }, 1000);
    return null;
  }

  event(conn, kind, text, match) {
    const N = this.N;
    const who = conn && conn[N.connUser] ? conn[N.connUser].nickname : conn && conn.ip;
    const where = match ? ` "${plainText(match.title)}"` : '';
    if (kind === this.acc[N.logChat]) this.log.info(`[chat]${where} ${who}: ${plainText(text)}`);
    else if (kind === this.acc[N.logCreate]) this.log.info(`${who} created match${where}`);
    else if (kind === this.acc[N.logJoin]) this.log.info(`${who} joined${where}`);
    else if (kind === this.acc[N.logSpectate]) this.log.info(`${who} is spectating${where}`);
    else if (kind === this.acc[N.logLeave]) this.log.info(`${who} left${where}`);
    else if (kind === this.acc[N.logDisconnect]) {
      if (conn && conn[N.connUser]) this.log.info(`- ${who} disconnected${conn[N.connReason] ? ` (${conn[N.connReason]})` : ''}`);
      this.forget(conn);
    } else this.log.debug(`[event ${kind}] ${who}${where} ${plainText(text)}`);
  }

  forget(conn) {
    const rec = conn && this.acc[this.N.p2pAuthIds].get(conn);
    if (rec) this.acc[this.N.authRecords].delete(rec.id);
  }

  cheatReport(conn, reason, code, detail) {
    const who = conn && conn[this.N.connUser] ? conn[this.N.connUser].nickname : conn && conn.ip;
    this.log.warn(`Anti-cheat report about ${who}: ${reason ?? `code ${code}`}${detail ? ` (${String(detail).slice(0, 200)})` : ''}`);
    if (this.config.cheat_reports === 'kick' && conn) this.kickConnection(conn, 'Server: Disconnected by the anti-cheat');
  }

  // "random approved": a map from random_maps, or else any map in desktop/maps (the
  // wrapper's local maps and every map it saved from play), not the one playing now.
  randomMap(title) {
    const pool = this.config.random_maps.length ? this.config.random_maps : this.maps.list();
    const playing = (this.matches().find((m) => m.title === title) || {}).map_id;
    const choices = pool.length > 1 ? pool.filter((id) => id !== playing) : pool;
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
  }

  // A match's map: [map ID, "h5", title, ip] -> "text[^#]name[^#]approved[^#]max players[^#]ID".
  mapRequest(fields, done) {
    const [asked, , title] = String(fields && fields.data || '').split(MAP_SPLIT);
    const fail = (why) => ['x', why].join(MAP_JOIN);
    let id = asked;
    const answer = (text) => {
      // One slot per player start; a map with none (an add-on such as "nanotech-cht")
      // leaves it to the match's own max players.
      const starts = (text.match(/<player\b/g) || []).length;
      const players = Math.min(MAX_MAP_PLAYERS, starts || MAX_MAP_PLAYERS);
      return [text, id, '0', String(players), id].join(MAP_JOIN);
    };
    (async () => {
      if (RANDOM.includes(String(asked).trim().toLowerCase())) {
        id = this.randomMap(title);
        if (!id) return fail(`This server has no maps to pick from for "${asked}": put maps in desktop/maps on the server, or list some in its "random_maps"`);
        this.log.info(`"${asked}": ${id}`);
      } else if (String(asked).includes(',')) {
        return fail('Merging maps ("a,b") is done by the official map service; this server plays one map ID at a time');
      }
      // 1. this server's maps; 2. the site's; only then is it missing.
      const local = this.maps.local(id);
      if (local) { this.log.info(`Map ${id} from this server`); return answer(local); }
      if (!this.config.download_maps) return fail(`Map "${id}" is not on this server (it downloads no maps)`);
      let text;
      try {
        text = await this.maps.download(id);
      } catch (e) {
        this.log.warn(`Map ${id}: plazmaburst2.com could not be asked (${e.message})`);
        return fail(`Map "${id}" is not on this server, and plazmaburst2.com could not be reached`);
      }
      if (!text) { this.log.info(`Map ${id}: not on this server nor on plazmaburst2.com`); return fail(`Map "${id}" does not exist (not on this server, not on plazmaburst2.com)`); }
      this.log.info(`Map ${id} downloaded from plazmaburst2.com`);
      return answer(text);
    })().then(done, (e) => { this.log.warn(`Map ${id}: ${e.message}`); done(fail(`Map "${id}" could not be loaded`)); });
  }

  // A socket.io socket that just connected.
  accept(socket) {
    Object.defineProperty(socket, this.N.socketConn, { get: () => socket.conn, configurable: true });
    const ip = String(socket.handshake.address || '').replace(/^::ffff:/, '');
    const conn = new this.Conn({ socket, ip });
    this.net.connections.push(conn);
    this.log.debug(`connection from ${ip}`);
    return conn;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try { this.net[this.N.netTick](Date.now()); } catch (e) { this.log.error(`tick: ${e.stack || e.message}`); }
    }, TICK_MS);
  }

  stop() { clearInterval(this.timer); this.timer = null; }

  // ----- For the terminal -----

  online() {
    const N = this.N;
    return this.net.connections.filter((c) => c[N.connUser] && !c[N.connClosed]).map((c) => ({
      conn: c, nickname: c[N.connUser].nickname, ip: c.ip, ping: c.ping, match: c[N.connMatch] || null,
      admin: !!c[N.connUser].is_staff,
    }));
  }

  matches() { return this.net.matches || []; }

  find(word) {
    const w = String(word || '').toLowerCase();
    const all = this.online();
    const exact = all.filter((p) => p.nickname.toLowerCase() === w);
    if (exact.length === 1) return exact[0];
    const start = all.filter((p) => p.nickname.toLowerCase().startsWith(w));
    if (start.length === 1) return start[0];
    throw new Error(start.length ? `"${word}" could be ${start.map((p) => p.nickname).join(', ')}` : `nobody called "${word}" is online`);
  }

  kickConnection(conn, why) {
    try { conn[this.N.connSay](why); } catch {}
    setTimeout(() => conn.Disconnect(), 300);
  }

  kick(word, why = 'Server: Disconnected by the server admin') {
    const p = this.find(word);
    this.kickConnection(p.conn, why);
    return p.nickname;
  }

  ban(word, why = 'banned by the server admin') {
    let name = String(word || '').trim();
    try { const p = this.find(word); name = p.nickname; this.kickConnection(p.conn, `Server: You are ${why}`); } catch {}
    if (!name) throw new Error('ban whom?');
    this.bans.add(name.toLowerCase());
    if (this.onBans) this.onBans([...this.bans]);
    return name;
  }

  unban(word) {
    const had = this.bans.delete(String(word || '').trim().toLowerCase());
    if (had && this.onBans) this.onBans([...this.bans]);
    return had;
  }

  // A server line in every player's chat (the staff "-announce" look).
  say(text) {
    const N = this.N;
    for (const p of this.online()) p.conn[N.connSay](`<font color="#666666"> * Server * </font><font color="#fff998">${text.replace(/</g, '&lt;')}</font>`);
  }

  match(word) {
    const all = this.matches();
    const n = Number(String(word).replace(/^#/, ''));
    const m = all.find((x) => x.uid === n) || all[n - 1];
    if (!m) throw new Error(`no match "${word}" ("matches" lists them)`);
    return m;
  }

  endMatch(word) {
    const m = this.match(word);
    m[this.N.matchEnd]('Server: Match has been ended by the server admin');
    return m;
  }

  setMap(word, id) {
    const m = this.match(word);
    return new Promise((resolve) => m[this.N.matchLoadMap](id, (ok, message) => resolve({ match: m, ok, message })));
  }
}

module.exports = { GameServer, memberShapes, SCRIPTS };
