// Network log files: what the dev console's recorder (desktop/dev/console/net/recorder.js)
// saw on the game's connections, as plain text, one file per run and game instance:
//   netlogs/<date>_<time>_<instance>.log
// A run is one start of the app. An instance is a game window: "local", or a remote play
// tester's name (desktop/remote/). Several apps running at once each write their own
// files, so "netlog runs" in the console lists the other instances too.
//
// The page sends finished lines; this module adds the file's header and appends them. It
// also lists the files and reads the end of one, for the console's "netlog" command.
'use strict';

const fs = require('fs/promises');
const path = require('path');

const EXT = '.log';
// A file written to this recently belongs to an instance that is still running.
const ACTIVE_MS = 15000;
// "netlog show" reads at most this much of the end of a file, and returns at most this
// many lines.
const READ_TAIL_BYTES = 4 * 1024 * 1024;
const READ_LINES_MAX = 20000;
// What one POST may carry.
const POST_LINES_MAX = 20000;
const LINE_CHARS_MAX = 64 * 1024;

const two = (n) => String(n).padStart(2, '0');
const stampOf = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}_${two(d.getHours())}-${two(d.getMinutes())}-${two(d.getSeconds())}`;
// Tester names are already safe (desktop/remote/testers.js); this keeps any name a file name.
const safeName = (s) => String(s || 'local').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40) || 'local';
// A run name as "netlog show run:<name>" takes it: a file in the folder, nothing else.
const RUN_NAME = /^[A-Za-z0-9_-]{1,120}$/;

const HEADER = [
  '# Plazma Burst 2 network log',
  '# One line per event: time, connection, direction, kind, details.',
  '#   connection  c<n> and what it is: server (main/lobby server), p2p-host (a player-hosted',
  '#               match you joined), p2p-guest (a player in a match you host), socket',
  '#   direction   OUT = sent by this game, IN = received, --- = neither',
  '#   kind        CONN  connected, disconnected (with the reason)',
  '#               REL   reliable message: #<sequence number> <type> then its parts, " | " between them',
  '#               STATE unreliable state update (only with the console key net_log_state on)',
  '#               LOSS  packet loss: resend (not acknowledged in time), gap (a message is missing),',
  '#                     late (a missing message arrived), duplicate (arrived twice), dropped (never sent)',
  '#               STAT  once a second per busy connection: ping, packets, bytes, losses',
  '#               PAGE  the game page loaded, recording turned on or off',
  '# Parts: plain text as sent; "quoted" when it has a " | ", line breaks or control characters;',
  '# #<number> for the game\'s encoded numbers (text it writes in its own base-N digits).',
];

// dir: where the files go. version: the game version, for the header. now: for tests.
function createNetLog({ dir, version = '', now = () => new Date() }) {
  const runStamp = stampOf(now());
  const writers = new Map(); // instance -> { name, file, ready, queue }
  const ownFiles = new Map(); // file name -> instance

  // The file is made on the first write, so a run that never connects leaves nothing.
  function writerFor(instance) {
    const inst = safeName(instance);
    let w = writers.get(inst);
    if (w) return w;
    w = { instance: inst, name: null, file: null, queue: Promise.resolve() };
    writers.set(inst, w);
    return w;
  }

  async function create(w) {
    await fs.mkdir(dir, { recursive: true });
    const started = now();
    const head = [
      ...HEADER,
      `# Run started ${started.toLocaleString('en-US')}, instance "${w.instance}", game ${version || '?'}, process ${process.pid}`,
      '',
    ].join('\n');
    // Two apps started in the same second: <name>-2.log and so on.
    for (let n = 1; ; n++) {
      const name = `${runStamp}_${w.instance}${n > 1 ? `-${n}` : ''}`;
      const file = path.join(dir, name + EXT);
      try {
        await fs.writeFile(file, head, { flag: 'wx' });
        w.name = name;
        w.file = file;
        ownFiles.set(name, w.instance);
        return;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
    }
  }

  // Appends lines (strings without line breaks) for one instance, in order. Returns the
  // file's run name.
  async function append(instance, lines) {
    if (!Array.isArray(lines)) throw new Error('expected an array of lines');
    if (lines.length > POST_LINES_MAX) throw new Error(`at most ${POST_LINES_MAX} lines at once`);
    const text = lines.map((l) => String(l).replace(/[\r\n]+/g, ' ').slice(0, LINE_CHARS_MAX)).join('\n');
    const w = writerFor(instance);
    const done = w.queue.then(async () => {
      if (!w.file) await create(w);
      if (text) await fs.appendFile(w.file, text + '\n');
      return w.name;
    });
    w.queue = done.catch(() => {}); // one failed write does not stop the next ones
    return done;
  }

  // Every log in the folder, newest first: { name, instance, size, updated (ms since
  // epoch), active, mine }. mine: written by this app; active: written in the last 15 s.
  async function list() {
    let names;
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }
    const out = [];
    const t = now().getTime();
    for (const f of names) {
      if (!f.endsWith(EXT) || f.startsWith('.')) continue;
      const name = f.slice(0, -EXT.length);
      let st;
      try { st = await fs.stat(path.join(dir, f)); } catch { continue; }
      if (!st.isFile()) continue;
      const m = name.match(/^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_(.+?)(?:-\d+)?$/);
      out.push({
        name,
        instance: m ? m[1] : name,
        size: st.size,
        updated: st.mtimeMs,
        active: t - st.mtimeMs < ACTIVE_MS,
        mine: ownFiles.has(name),
      });
    }
    return out.sort((a, b) => b.name.localeCompare(a.name));
  }

  // The last `max` event lines of a run's file (header lines left out). Throws with
  // .status 400 / 404.
  async function read(name, max = READ_LINES_MAX) {
    if (!RUN_NAME.test(String(name || ''))) throw Object.assign(new Error('bad run name'), { status: 400 });
    const file = path.join(dir, name + EXT);
    let fh;
    try {
      fh = await fs.open(file, 'r');
    } catch {
      throw Object.assign(new Error(`no network log "${name}"`), { status: 404 });
    }
    try {
      const { size } = await fh.stat();
      const start = Math.max(0, size - READ_TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      await fh.read(buf, 0, buf.length, start);
      let lines = buf.toString('utf8').split('\n');
      if (start > 0) lines.shift(); // cut mid-line
      lines = lines.filter((l) => l && !l.startsWith('#'));
      return lines.slice(-Math.max(1, Math.min(max, READ_LINES_MAX)));
    } finally {
      await fh.close();
    }
  }

  // This app's run name for an instance, or null before its first line.
  const runName = (instance) => (writers.get(safeName(instance)) || {}).name || null;

  return { append, list, read, runName, runStamp, dir };
}

module.exports = { createNetLog, safeName, ACTIVE_MS, EXT };
