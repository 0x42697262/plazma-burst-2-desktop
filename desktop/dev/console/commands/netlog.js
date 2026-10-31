// "netlog": the network log (net/recorder.js). Its state, the last lines with filters,
// the logs of other game instances (netlogs/, listed and read by the desktop wrapper,
// desktop/netlog.js), and on/off (the key net_log).
import { print } from '../ui/log.js';
import { showPaged, takePage } from '../ui/pager.js';
import { COLOR } from '../core/colors.js';
import { ROUTE } from '../core/shared.js';
import { REMOTE } from '../core/remote.js';
import { takeOptions } from '../core/args.js';
import { agoText, plural } from '../core/text.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { netlog } from '../net/recorder.js';
import { runKey } from './settings.js';

const LAST_DEFAULT = 1000; // lines "netlog show" looks at without last:<n>
const LAST_MAX = 20000;
const NAME_WIDTH = 34;

// A line as the recorder writes it: time, connection ("c1 server" or "--"), direction,
// kind, details.
const LINE = /^(\S+) {2}(\S+(?: \S+)?)\s+(OUT|IN|---)\s+([A-Z]+)\s+(.*)$/;
export const parseLine = (line) => {
  const m = LINE.exec(line);
  return m && { time: m[1], conn: m[2], dir: m[3], kind: m[4], text: m[5] };
};

const KIND_OPTIONS = Object.freeze({ loss: 'LOSS', stat: 'STAT', stats: 'STAT', rel: 'REL', state: 'STATE', conn: 'CONN', pkt: 'PKT', packet: 'PKT' });
const OPTIONS = ['in', 'out', ...Object.keys(KIND_OPTIONS)];
const TERMS = ['run', 'type', 'conn', 'last'];

const KIND_COLOR = Object.freeze({ LOSS: COLOR.warn, STAT: COLOR.hint, CONN: COLOR.notice, PAGE: COLOR.notice, STATE: COLOR.muted, PKT: COLOR.muted });
const colorOf = (p) => (p && KIND_COLOR[p.kind]) || (p && p.dir === 'IN' ? COLOR.bright : COLOR.plain);

let lastRuns = []; // from the last "netlog runs", for run:<n>

// The filter from the words: { run, last, test(line) }.
export function parseFilter(args) {
  const { options, rest } = takeOptions(args, OPTIONS);
  if (options.has('in') && options.has('out')) throw new Error('--in and --out do not go together (leave both out for both)');
  const kinds = new Set([...options].filter((o) => KIND_OPTIONS[o]).map((o) => KIND_OPTIONS[o]));
  const terms = { run: null, type: null, conn: null, last: LAST_DEFAULT };
  const words = [];
  for (const w of rest) {
    const m = /^([a-z]+):(.*)$/i.exec(w);
    const key = m && m[1].toLowerCase();
    if (!m || !TERMS.includes(key)) { words.push(w.toLowerCase()); continue; }
    if (!m[2]) throw new Error(`${key}: needs a value, e.g. ${key === 'run' ? 'run:2' : key === 'type' ? 'type:chat' : key === 'conn' ? 'conn:c1' : 'last:200'}`);
    if (key === 'last') {
      const n = Number(m[2]);
      if (!Number.isInteger(n) || n < 1 || n > LAST_MAX) throw new Error(`last: a whole number from 1 to ${LAST_MAX}`);
      terms.last = n;
    } else {
      terms[key] = m[2];
    }
  }
  const dir = options.has('in') ? 'IN' : options.has('out') ? 'OUT' : null;
  const type = terms.type && terms.type.toUpperCase().replace(/^RELIABLE_/, '');
  const conn = terms.conn && terms.conn.toLowerCase();
  const test = (line) => {
    const p = parseLine(line);
    if (!p) return !dir && !kinds.size && !type && !conn && words.every((w) => line.toLowerCase().includes(w));
    if (dir && p.dir !== dir) return false;
    if (kinds.size && !kinds.has(p.kind)) return false;
    if (type && !(p.text.match(/\bRELIABLE_\w+/g) || []).some((t) => t.slice('RELIABLE_'.length).includes(type))) return false;
    if (conn && !p.conn.toLowerCase().split(' ').some((part) => part === conn || part.startsWith(conn))) return false;
    const low = line.toLowerCase();
    return words.every((w) => low.includes(w));
  };
  return { run: terms.run, last: terms.last, test, filtered: !!(dir || kinds.size || type || conn || words.length) };
}

function showLines(lines, { title, filter, page, source }) {
  const picked = lines.slice(-filter.last).filter(filter.test);
  const rows = picked.map((l) => [l, colorOf(parseLine(l))]);
  const size = settings.effective(KEY.PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  showPaged({
    title: `${title}: ${filter.filtered ? `${picked.length} of the last ${Math.min(lines.length, filter.last)} lines match` : plural(picked.length, 'line')}.`,
    rows,
    cmd: 'netlog show',
    empty: filter.filtered ? 'Nothing matches. Leave out a filter, or look further back with last:<n>.' : 'Nothing recorded yet. Join a multiplayer lobby or match.',
    hint: source,
    // The newest lines first: start on the last page.
    page: page === null ? pages : page,
  });
}

function resolveRun(word) {
  if (/^\d+$/.test(word)) {
    const r = lastRuns[Number(word) - 1];
    if (!r) throw new Error(lastRuns.length ? `no run ${word}: "netlog runs" lists ${lastRuns.length}` : 'run:<n> counts in the "netlog runs" list: run that first, or give the name');
    return r.name;
  }
  return word;
}

function show(args) {
  const { args: rest, page } = takePage(args);
  const filter = parseFilter(rest);
  const pageNo = rest.length === args.length ? null : page;
  if (!filter.run) {
    showLines(netlog.lines(), {
      title: 'Network log, this page',
      filter,
      page: pageNo,
      source: `${netlog.file() ? `The whole run: ${netlog.file()}` : 'Not written to a file yet'}. "netlog runs" = other instances.`,
    });
    return;
  }
  if (REMOTE) throw new Error('run: is not available in remote play');
  const name = resolveRun(filter.run);
  fetch(`${ROUTE.netRead}?run=${encodeURIComponent(name)}&lines=${filter.last}`, { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      const text = await r.text();
      showLines(text ? text.split('\n') : [], { title: `Network log ${name}`, filter, page: pageNo, source: `netlogs/${name}.log` });
    })
    .catch((e) => print(`error: could not read network log ${name}: ${e.message} (desktop wrapper only)`, COLOR.error));
}

function runs(args) {
  if (args.length) throw new Error('usage: netlog runs');
  fetch(ROUTE.netRuns, { cache: 'no-store' })
    .then((r) => r.json())
    .then((list) => {
      lastRuns = list;
      if (!list.length) { print('No network logs in netlogs/ yet.', COLOR.notice); return; }
      const now = Date.now();
      print(`Network logs in netlogs/, newest first (${list.length}). "netlog show run:<n>" shows one.`, COLOR.title);
      list.forEach((r, i) => {
        const who = r.current ? 'this window' : r.mine ? 'this app' : r.active ? 'other app, running' : 'ended';
        const color = r.current ? COLOR.ok : r.mine || r.active ? COLOR.plain : COLOR.muted;
        print(`  ${String(i + 1).padStart(2)}  ${r.name.padEnd(NAME_WIDTH)} ${who.padEnd(18)} ${`${(r.size / 1024).toFixed(1)} KB`.padStart(10)}  updated ${agoText(now - r.updated)}`, color);
      });
    })
    .catch(() => print('error: could not list network logs (desktop wrapper only)', COLOR.error));
}

function status(args) {
  if (args.length) throw new Error('usage: netlog [show | runs | on | off]');
  const on = netlog.on();
  const all = settings.effective(KEY.NET_LOG_ALL) === true;
  const state = all || settings.effective(KEY.NET_LOG_STATE) === true;
  print(`Network log: ${on ? 'on' : 'off'} (net_log). Everything (every packet and state update): ${all ? 'on' : 'off'} (net_log_all).`
    + ` State updates: ${state ? 'written' : 'counted only'}${all ? '' : ' (net_log_state)'}.`, on ? COLOR.ok : COLOR.notice);
  if (netlog.writeError()) print(`  Not written to a file: ${netlog.writeError()}`, COLOR.error);
  else print(`  File: ${netlog.file() || 'none yet (made with the first line sent)'}`, COLOR.hint);
  print(`  This page: ${plural(netlog.pageLines(), 'line')}.`, COLOR.hint);
  const conns = netlog.connections();
  if (!conns.length) print(on ? '  No connections now.' : '  Nothing is recorded while it is off.', COLOR.hint);
  for (const c of conns) {
    const n = c.total;
    print(`  c${c.id} ${c.kind.padEnd(10)} ${c.connected ? 'connected' : 'not connected'}, ping ${c.ping}, out ${n.pkOut} packets, in ${n.pkIn} packets | loss: ${netlog.lossText(n)}`
      + `${c.unacked ? ` | ${c.unacked} waiting for ack` : ''}${c.missing ? ` | ${c.missing} missing` : ''}`,
    n.resends || n.dropped || n.gaps || n.dups ? COLOR.warn : COLOR.plain);
  }
  print(`"netlog show" = the last lines ("netlog show --loss", "netlog show type:chat")${REMOTE ? '' : ', "netlog runs" = other instances'}, "netlog ${on ? 'off' : 'on'}".`, COLOR.hint);
}

const SHOW_ARGS = [
  ['--in | --out', 'received or sent only'],
  ['--loss', 'packet loss only: resend, dropped, gap, late, duplicate'],
  ['--rel --stat --conn --state --pkt', 'only these kinds (they combine)'],
  ['type:<name>', 'messages of a type, e.g. type:chat (RELIABLE_ left out)'],
  ['conn:<c1 | server | p2p>', 'one connection'],
  ['last:<n>', `look at the last n lines (default ${LAST_DEFAULT})`],
  ['<text>', 'lines with this text (several: all of them)'],
  ...(REMOTE ? [] : [['run:<n | name>', 'another instance or run, from "netlog runs"']]),
  ['page <n>', 'a page of the result (it opens on the newest)'],
];

export const netlogCommand = {
  name: 'netlog',
  aliases: ['net', 'packets'],
  usage: 'netlog [show | runs | on | off]',
  desc: 'The network log: messages sent and received, packet losses, ping. "netlog show" for the lines',
  help: {
    about: [
      'Every message the game sends and receives on its connections (main server, P2P),',
      'packet losses and once a second each connection\'s ping and traffic. Written as',
      'plain text to netlogs/<date>_<time>_<instance>.log: one file per run and game',
      'window, so other instances (another app, remote play testers) have their own.',
      'Alone, "netlog" says whether it records, where, and the losses of each connection.',
    ],
    examples: [
      ['netlog', 'on or off, the file, each connection\'s ping and losses'],
      ['netlog show --loss', 'every resend, dropped packet, gap, late and duplicate message'],
      ['netlog show type:chat hello', 'chat messages with "hello"'],
      ['netlog show --in conn:server', 'what the main server sent'],
      ...(REMOTE ? [] : [['netlog runs', 'other instances and earlier runs'], ['netlog show run:2 --loss', 'the losses of another one']]),
      ['netlog off', 'stop recording (net_log off)'],
      ['netlog all on', 'log everything: every packet and state update'],
    ],
    notes: [
      'In the file each line is: time, connection, OUT/IN/---, kind (REL, LOSS, STAT, CONN,',
      'STATE, PKT, PAGE), details. #<n> is a number the game sent encoded. The file header explains it all.',
      '"netlog all on" logs everything: every packet and every state update (off by default).',
    ],
    see: ['net_log', 'net_log_state', 'net_log_all'],
  },
  run: status,
  subcommands: [
    {
      name: 'show',
      aliases: ['tail', 'log', 'filter'],
      usage: 'netlog show [filters] [page <n>]',
      desc: 'The last lines of the network log, filtered',
      help: {
        about: [
          'This page\'s lines (or another run\'s with run:), newest page first. Losses are',
          'yellow, received messages bright, sent ones white.',
        ],
        args: SHOW_ARGS,
        examples: [
          ['netlog show --loss', 'packet losses only'],
          ['netlog show --out type:chat', 'chat messages you sent'],
          ['netlog show --stat conn:c2', 'ping and traffic of connection c2, second by second'],
        ],
        see: ['netlog'],
      },
      run: show,
    },
    {
      name: 'runs',
      aliases: ['list', 'instances', 'files'],
      remote: false, // other instances are the host's (core/remote.js)
      usage: 'netlog runs',
      desc: 'Every network log in netlogs/: this window, other instances running now, earlier runs',
      help: {
        about: [
          'One file per run and game instance: this window, remote play testers\' games,',
          'another copy of the app, earlier runs. "running" means written in the last 15 s.',
          'Then "netlog show run:<n>" reads one, with the same filters.',
        ],
        see: ['netlog show'],
      },
      run: runs,
    },
    {
      name: 'all',
      aliases: ['everything'],
      usage: 'netlog all [on | off]',
      desc: 'Log everything: every packet (PKT) and every state update (net_log_all, off by default)',
      help: {
        about: [
          'The same as "net_log_all". On, every packet sent and received gets a PKT line (its',
          'size, ack, how many parts its state has, which reliable messages it carries), and',
          'every unreliable state update is written decoded (STATE). Alone it says on or off.',
          '60 to 250 packets a second each way in a match: the files grow fast.',
        ],
        examples: [['netlog all on', 'log everything'], ['netlog show --pkt --state last:200', 'the latest packets and state updates']],
        see: ['net_log_all', 'net_log_state'],
      },
      run: (args) => {
        if (args.length > 1) throw new Error('usage: netlog all [on | off]');
        if (!args.length) { print(`net_log_all = ${settings.effective(KEY.NET_LOG_ALL) ? 'on' : 'off'}`); return; }
        runKey(KEY.NET_LOG_ALL, args);
      },
    },
    {
      name: 'on',
      usage: 'netlog on',
      desc: 'Record the network log (net_log on, the default)',
      help: { about: ['The same as "net_log on". Connections already open are recorded from now on.'], see: ['net_log'] },
      run: (args) => { if (args.length) throw new Error('usage: netlog on'); runKey(KEY.NET_LOG, ['on']); },
    },
    {
      name: 'off',
      usage: 'netlog off',
      desc: 'Stop recording the network log (net_log off)',
      help: { about: ['The same as "net_log off". The game\'s connections are left exactly as they were.'], see: ['net_log'] },
      run: (args) => { if (args.length) throw new Error('usage: netlog off'); runKey(KEY.NET_LOG, ['off']); },
    },
  ],
};
