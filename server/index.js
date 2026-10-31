#!/usr/bin/env node
// Your own Plazma Burst 2 lobby server: "npm run server". The game's own server code
// (server/game.js) behind TLS on one port, run from this terminal. Players pick it in the
// desktop app's server list (npm start), never through the official site.
// Guide: server/README.md.
//
// Usage: node server/index.js [--config file] [--game dir] [--data dir] [--verbose]
//   --data  where the certificate, bans and downloaded maps are kept (default server/data)
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const readline = require('readline');
const { Server } = require('socket.io');
const { createLogger, parseLogLevel } = require('../desktop/log');
const { findNames } = require('../tools/find-names');
const { loadConfig } = require('./config');
const { createMaps } = require('./maps');
const { makeUnpacker } = require('../desktop/map-text');
const { GameServer } = require('./game');

const REPO = path.join(__dirname, '..');
const ORIGIN = 'https://www.plazmaburst2.com'; // where the game's page comes from
const CERT_DAYS = 3650;

// The names server/game.js uses (all from tools/find-names.js).
const NEEDED = Object.freeze(['net', 'connClass', 'serverFlag', 'setupClass', 'setupMethod', 'p2pAuth', 'p2pAuthIds', 'serverStats',
  'webRequests', 'webRequest', 'mapUrl', 'mapKey', 'mapRequest', 'socketConn', 'connDevice', 'deviceId', 'connUser', 'connStats',
  'connSay', 'connReason', 'connClosed', 'connMatch', 'authLogin', 'authRecords', 'authReport', 'authEndorse', 'authBan', 'authCheat',
  'authLog', 'logDisconnect', 'logChat', 'logCreate', 'logSpectate', 'logJoin', 'logLeave', 'netTick', 'matchEnd', 'matchLoadMap']);

function parseArgs(argv) {
  const out = { config: path.join(__dirname, 'server.json'), game: process.env.PB2_GAME_DIR || path.join(REPO, 'game'), data: path.join(__dirname, 'data') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') out.config = path.resolve(argv[++i] || '');
    else if (argv[i] === '--game') out.game = path.resolve(argv[++i] || '');
    else if (argv[i] === '--data') out.data = path.resolve(argv[++i] || '');
    else if (argv[i] === '-h' || argv[i] === '--help') out.help = true;
  }
  return out;
}

// A self-signed certificate, made once and kept: players pin its fingerprint.
function certificate(DATA, log) {
  const certFile = path.join(DATA, 'cert.pem');
  const keyFile = path.join(DATA, 'key.pem');
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    const selfsigned = require('selfsigned');
    const pems = selfsigned.generate([{ name: 'commonName', value: 'pb2-private-server' }], { keySize: 2048, days: CERT_DAYS, algorithm: 'sha256' });
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(keyFile, pems.private, { mode: 0o600 });
    fs.writeFileSync(certFile, pems.cert);
    log.info(`Made a certificate for this server: ${path.relative(REPO, certFile)}`);
  }
  const cert = fs.readFileSync(certFile, 'utf8');
  return { cert, key: fs.readFileSync(keyFile, 'utf8'), fingerprint: new crypto.X509Certificate(cert).fingerprint256 };
}

function readBans(DATA) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'bans.json'), 'utf8')); } catch { return []; }
}
function writeBans(DATA, list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'bans.json'), JSON.stringify(list, null, 1) + '\n');
}

function gameVersion(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'pb2-version.json'), 'utf8')).version || null; } catch { return null; }
}

function addresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

const HELP = [
  'Commands:',
  '  status                  who is online and the matches',
  '  who                     players: nickname, address, ping, match',
  '  matches                 the matches: number, title, map, players',
  '  say <text>              a server line in everyone\'s chat',
  '  kick <nickname>         disconnect a player',
  '  ban <nickname>          disconnect and keep them out (server/data/bans.json)',
  '  unban <nickname>        let them back',
  '  bans                    the ban list',
  '  end <match>             end a match (its number from "matches")',
  '  map <match> <map ID>    change a match\'s map (desktop/maps, or a published ID)',
  '  join                    what players need to add this server',
  '  quit                    close the server (Ctrl+C)',
];

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log('Usage: npm run server -- [--config file] [--game dir] [--data dir] [--verbose]'); return; }
  const DATA = args.data;
  const log = createLogger(parseLogLevel().level);
  const loaded = loadConfig(args.config);
  if (loaded.missing) log.info(`No ${path.relative(REPO, args.config)}: using the defaults (copy server/server.example.json to change them)`);
  for (const p of loaded.problems) log.warn(`Config: ${p}`);
  if (loaded.errors.length) { for (const e of loaded.errors) log.error(`Config: ${e}`); process.exitCode = 1; return; }
  const config = { ...loaded.server, bans: readBans(DATA) };

  if (!fs.existsSync(path.join(args.game, '_strings.js'))) { log.error(`No game files in ${args.game}. Run "npm run fetch-game" first.`); process.exitCode = 1; return; }
  const found = findNames(args.game);
  const missing = NEEDED.filter((k) => !found.found[k]);
  if (missing.length) {
    log.error(`The game's server code was not recognised in this game version (${missing.join(', ')} not found). tools/find-names.js needs updating.`);
    process.exitCode = 1;
    return;
  }
  const maps = createMaps({ mapsDir: path.join(REPO, 'desktop', 'maps'), cacheDir: path.join(DATA, 'maps'), unpack: makeUnpacker(args.game) });
  const game = new GameServer({ gameDir: args.game, names: found.found, config, log, maps });
  game.onBans = (list) => writeBans(DATA, list);

  const tls = certificate(DATA, log);
  const version = gameVersion(args.game);
  // What a player's server list shows: GET /status. Nothing private: no names, no addresses.
  const status = () => JSON.stringify({
    name: config.name, description: config.description, version, password: !!config.password,
    players: game.online().length, max_players: config.max_players, matches: game.matches().length,
  });
  const web = https.createServer({ cert: tls.cert, key: tls.key }, (req, res) => {
    if (req.method === 'GET' && req.url === '/status') {
      const body = status();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const io = new Server(web, { cors: { origin: ORIGIN, credentials: true }, serveClient: false });
  io.on('connection', (socket) => { try { game.accept(socket); } catch (e) { log.error(`connection: ${e.message}`); socket.disconnect(true); } });
  web.on('error', (e) => { log.error(`Cannot listen on ${config.bind}:${config.port}: ${e.message}`); process.exit(1); });
  web.listen(config.port, config.bind, () => {
    game.start();
    config.port = web.address().port;
    log.info(`"${config.name}" on ${config.bind}:${config.port}${config.password ? ', password set' : ''}, game ${version || 'version unknown'}`);
    printJoin();
    log.info('Type "help" for commands.');
  });

  function printJoin() {
    const ips = addresses();
    log.info('Players add this server in the app\'s server list (npm start > Add server):');
    log.info(`  address:     ${ips[0] || '<this computer\'s address>'}:${config.port}`);
    log.info(`  fingerprint: ${tls.fingerprint}`);
    log.info(`  password:    ${config.password ? '(the one in your server.json)' : '(none)'}`);
    if (ips.length > 1) log.info(`This computer's other addresses: ${ips.slice(1).join(', ')}`);
    log.info(`From outside your network: your public address, with TCP port ${config.port} forwarded to this computer.`);
  }

  const cmd = {
    help: () => HELP.forEach((l) => log.info(l)),
    status: () => {
      log.info(`${game.online().length} online, ${game.matches().length} matches`);
      cmd.matches();
    },
    who: () => {
      const all = game.online();
      if (!all.length) { log.info('Nobody is online'); return; }
      for (const p of all) log.info(`  ${p.nickname.padEnd(20)} ${String(p.ip).padEnd(16)} ${String(Math.round(p.ping ?? 0)).padStart(5)} ms  ${p.match ? `in "${p.match.title}"` : 'in the lobby'}${p.admin ? '  [admin]' : ''}`);
    },
    matches: () => {
      const all = game.matches();
      if (!all.length) { log.info('No matches. Players create them from the match browser.'); return; }
      all.forEach((m, i) => log.info(`  ${String(i + 1).padStart(2)}. "${m.title}"  ${m.map_id} (${m.map_name})  ${m.game_type}  ${m.players_current}/${m.players_max} players, ${m.spectators_current} spectating${m.has_password ? ', password' : ''}`));
    },
    say: (rest) => { if (!rest) throw new Error('say <text>'); game.say(rest); log.info(`Said: ${rest}`); },
    kick: (rest) => log.info(`Kicked ${game.kick(rest)}`),
    ban: (rest) => log.info(`Banned ${game.ban(rest)}`),
    unban: (rest) => log.info(game.unban(rest) ? `Unbanned ${rest}` : `${rest} was not banned`),
    bans: () => { const b = [...game.bans]; log.info(b.length ? `Banned: ${b.join(', ')}` : 'Nobody is banned'); },
    end: (rest) => { const m = game.endMatch(rest); log.info(`Ended "${m.title}"`); },
    map: (rest) => {
      const [which, ...id] = rest.split(/\s+/);
      if (!which || !id.length) throw new Error('map <match> <map ID>');
      game.setMap(which, id.join(' ')).then(({ match, ok, message }) => log.info(ok ? `"${match.title}" now plays ${match.map_id}` : `Map not changed: ${message}`));
    },
    join: () => printJoin(),
  };
  cmd.players = cmd.who;

  let closing = false;
  const quit = () => {
    if (closing) process.exit(0);
    closing = true;
    log.info('Closing the server');
    try { game.say('The server is closing'); } catch {}
    setTimeout(() => { game.stop(); io.close(); process.exit(0); }, 500);
  };
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) return;
    const [word, ...rest] = text.split(/\s+/);
    const w = word.toLowerCase();
    if (w === 'quit' || w === 'exit') { quit(); return; }
    const fn = cmd[w];
    if (!fn) { log.info(`Unknown command "${word}". Type "help".`); return; }
    try { fn(rest.join(' ')); } catch (e) { log.info(`error: ${e.message}`); }
  });
  process.on('SIGINT', quit);
}

main();
