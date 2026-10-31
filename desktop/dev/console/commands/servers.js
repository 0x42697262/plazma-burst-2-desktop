// "servers": the server list from the console, everything its page does
// (desktop/launcher/): list with ping, players and description, add, edit, remove, the
// certificate fingerprint, and playing on one. The desktop wrapper keeps the list
// (desktop/servers.json); this asks it over the servers route. Passwords never come back.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { ROUTE } from '../core/shared.js';

const FIELDS = Object.freeze(['address', 'fingerprint', 'nickname', 'password', 'name']);
const OFFICIAL = 'official';
const MASK = '•••';
const PING_GOOD = 80;
const PING_OK = 150;

async function ask(op, arg) {
  let r;
  try {
    r = await fetch(ROUTE.servers, { method: 'POST', body: JSON.stringify({ op, arg }), cache: 'no-store' });
  } catch {
    throw new Error('the server list is in the desktop wrapper only');
  }
  if (r.status === 403) throw new Error('the server list is not available in this window');
  const out = await r.json();
  if (!out.ok) throw new Error(out.error);
  return out.value;
}

// The words after the subcommand: key=value pairs, a value in "double quotes" may have spaces.
function pairs(text) {
  const out = {};
  const re = /([A-Za-z_]+)=(?:"([^"]*)"|(\S*))/g;
  let rest = text;
  for (const m of text.matchAll(re)) {
    const key = m[1].toLowerCase();
    if (!FIELDS.includes(key)) throw new Error(`unknown "${m[1]}=". Use ${FIELDS.map((f) => `${f}=`).join(' ')}`);
    out[key] = m[2] !== undefined ? m[2] : m[3];
    rest = rest.replace(m[0], '');
  }
  if (rest.trim()) throw new Error(`"${rest.trim()}" is not key=value (a value with spaces goes in "quotes")`);
  return out;
}

// The text after the command's name and the subcommand word.
const after = (rest, n) => rest.trim().replace(new RegExp(`^(?:\\S+\\s*){${n}}`), '');

// A server by "official", its number in "servers", or the start of its name or address.
function pick(data, word) {
  if (!word) throw new Error('which server? "official", a number from "servers", or its name');
  const w = word.toLowerCase();
  if (w === OFFICIAL || w === '0') return { ...data.official, official: true };
  if (/^\d+$/.test(w)) {
    const s = data.servers[Number(w) - 1];
    if (s) return s;
    throw new Error(`no server ${w} ("servers" lists them)`);
  }
  const hits = data.servers.filter((s) => s.name.toLowerCase() === w || s.address.toLowerCase() === w);
  if (hits.length === 1) return hits[0];
  const starts = data.servers.filter((s) => s.name.toLowerCase().startsWith(w) || s.address.toLowerCase().startsWith(w));
  if (starts.length === 1) return starts[0];
  throw new Error(starts.length ? `"${word}" could be ${starts.map((s) => s.name).join(', ')}` : `no saved server "${word}"`);
}

function pingText(c) {
  if (!c || c.ping === null || c.ping === undefined) return ['offline', COLOR.error];
  const ms = Math.round(c.ping);
  return [`${ms} ms`, ms < PING_GOOD ? COLOR.ok : ms < PING_OK ? COLOR.warn : COLOR.error];
}

async function list() {
  const data = await ask('list');
  const rows = [{ ...data.official, official: true, address: `${data.official.host}:${data.official.port}` }, ...data.servers];
  const checks = await Promise.all(rows.map((s) => ask('check', s.id).catch((e) => ({ ping: null, error: e.message }))));
  print('Servers ("servers connect <n>" plays there):', COLOR.title);
  rows.forEach((s, i) => {
    const c = checks[i];
    const n = s.official ? OFFICIAL : String(i);
    const name = (c.status && c.status.name) || s.name;
    const [ping, pingColor] = pingText(c);
    const players = c.status ? `${c.status.players}/${c.status.max_players}` : '—';
    const here = data.last === s.id ? '  (last played)' : '';
    print([[`  ${n.padEnd(9)}`, COLOR.bright], [`${name}`, COLOR.plain], [`  ${s.address}  `, COLOR.hint], [ping, pingColor], [`  ${players}${here}`, COLOR.hint]]);
    let desc = s.official ? s.description : c.status ? c.status.description : c.pinned === false
      ? 'its certificate is NOT the saved one: someone else may be at this address' : c.error || '';
    if (!s.official) desc = `${desc ? `${desc} · ` : ''}as ${s.nickname}${c.status && c.status.password && !s.hasPassword ? ' · needs a password' : ''}`;
    if (desc) print(`             ${desc}`, c.pinned === false ? COLOR.error : COLOR.hint);
    if (c.status && c.status.version && c.status.version !== data.gameVersion) {
      print(`             game ${c.status.version} there, ${data.gameVersion} here: the same version is needed`, COLOR.warn);
    }
  });
  for (const p of data.problems) print(`desktop/servers.json: ${p}`, COLOR.warn);
}

async function save(entry, what) {
  if (entry.fingerprint && entry.fingerprint.toLowerCase() === 'fetch') {
    if (!entry.address) throw new Error('fingerprint=fetch needs address=');
    entry.fingerprint = await ask('fingerprint', entry.address);
    print(`The server shows fingerprint ${entry.fingerprint}. Compare it with the one the host sent you.`, COLOR.warn);
  }
  const r = await ask('save', entry);
  if (r.errors) { for (const e of r.errors) print(`error: ${e}`, COLOR.error); return; }
  print(`${what} ${r.server.name} (${r.server.address}, as ${r.server.nickname}${r.server.hasPassword ? ', password saved' : ''}). "servers connect ${r.server.name}" plays there.`, COLOR.ok);
}

const run = (fn) => (args, ctx) => { fn(args, ctx).catch((e) => print(`error: ${e.message}`, COLOR.error)); };

const SUBCOMMANDS = [
  { name: 'list', aliases: ['ls', 'refresh'], usage: 'servers [list]', desc: 'The servers: name, address, ping, players, description (checked now)', help: { about: ['Each server is checked now: ping (the time to connect), and a private server\'s', 'name, players, description and game version. A warning when its certificate is', 'not the saved one, or its game version differs from yours.'] }, run: run(list) },
  {
    name: 'connect', aliases: ['join', 'play'], usage: 'servers connect <official | n | name>', desc: 'Play on that server (the game reloads)', help: { about: ['Leaves what you are playing and loads the game on that server. On a private', 'server the game starts logged out and logs in with the saved nickname and', 'password; on the official one with desktop/credentials.json.'], examples: [['servers connect official', 'PlazmaBurst2.com'], ['servers connect 1', 'the first private server']] },
    run: run(async (args) => {
      const data = await ask('list');
      const s = pick(data, args.join(' '));
      print(`Connecting to ${s.name}…`, COLOR.ok);
      await ask('play', s.id);
    }),
  },
  {
    name: 'add', usage: 'servers add address=<a> fingerprint=<fp | fetch> nickname=<you> [password=<p>] [name="<name>"]',
    desc: 'Save a private server', rawLine: true, help: { about: ['address and fingerprint come from the server\'s terminal. fingerprint=fetch asks', 'the server for it; compare it with the one the host sent you. A value with spaces', 'goes in "double quotes". The password is kept out of the history and the log.'], examples: [['servers add address=192.168.1.20:2053 fingerprint=fetch nickname=Pal password=pw name="Paulbase"', 'save one']] },
    run: run(async (args, { rest }) => save(pairs(after(rest, 1)), 'Saved')),
  },
  {
    name: 'edit', usage: 'servers edit <n | name> key=value …', desc: 'Change a saved server (address, fingerprint, nickname, password, name)', rawLine: true, help: { about: ['Only the keys given change. password= with nothing after it removes the password.'], examples: [['servers edit 1 nickname=Pal2', 'another nickname'], ['servers edit paul password=newpw', 'by name']] },
    run: run(async (args, { rest }) => {
      const data = await ask('list');
      const s = pick(data, args[0]);
      if (s.official) throw new Error('the official server cannot be edited');
      const change = pairs(after(rest, 2));
      if (!Object.keys(change).length) throw new Error('nothing to change: key=value …');
      await save({ id: s.id, name: s.name, address: s.address, fingerprint: s.fingerprint, nickname: s.nickname, ...change }, 'Changed');
    }),
  },
  {
    name: 'remove', aliases: ['rm', 'delete'], usage: 'servers remove <n | name>', desc: 'Forget a saved server', help: { about: ['Takes it out of desktop/servers.json. The official server always stays.'] },
    run: run(async (args) => {
      const s = pick(await ask('list'), args.join(' '));
      if (s.official) throw new Error('the official server stays in the list');
      await ask('remove', s.id);
      print(`Removed ${s.name}`, COLOR.ok);
    }),
  },
  {
    name: 'fingerprint', aliases: ['fp'], usage: 'servers fingerprint <address>', desc: 'The certificate fingerprint a server shows (compare it with the host\'s)', help: { about: ['Only the TLS handshake: nothing is sent to the server.'], examples: [['servers fingerprint 192.168.1.20:2053', '']] },
    run: run(async (args) => {
      if (!args[0]) throw new Error('usage: servers fingerprint <address>');
      print(`${args[0]}: ${await ask('fingerprint', args[0])}`, COLOR.ok);
    }),
  },
  { name: 'page', aliases: ['menu', 'back'], usage: 'servers page', desc: 'Back to the server list page (leaves the game)', help: { about: ['The page "npm start" opens. There is no shortcut key for it; bind one if you like:', '"bind f9 servers page".'] }, run: run(async () => { await ask('openList'); }) },
];

export const serversCommand = {
  name: 'servers',
  aliases: ['server-list'],
  remote: false, // the host's list: never in a tester's window
  usage: 'servers [list | connect | add | edit | remove | fingerprint | page]',
  desc: 'The server list: official and private servers, with ping; add, edit, remove, connect',
  help: {
    about: [
      'The same list "npm start" opens before the game (desktop/servers.json), from here:',
      'the official server and your private servers ("npm run server"), each checked for',
      'ping, players and description. A server is named by "official", its number in the',
      'list, or the start of its name or address.',
    ],
    examples: [
      ['servers', 'the list'],
      ['servers connect 1', 'play on the first private server'],
      ['servers add address=192.168.1.20:2053 fingerprint=fetch nickname=Pal password=pw name="Paulbase"', 'save one'],
      ['servers edit 1 password=newpw', 'change its password'],
      ['servers page', 'back to the list page'],
    ],
    notes: ['A typed password= is kept out of the history and the log.', 'No shortcut key: bind one yourself, e.g. "bind f9 servers page".'],
  },
  subcommands: SUBCOMMANDS,
  // "password=..." never reaches the history or the log.
  mask: (line) => line.replace(/\b(password=)(?:"[^"]*"|\S*)/gi, `$1${MASK}`),
  run: run(async (args) => {
    if (args.length) throw new Error(`unknown "servers ${args[0]}". Type "help servers".`);
    await list();
  }),
};
