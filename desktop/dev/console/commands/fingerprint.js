// "fingerprint": runs the latest fingerprinter the main server sent (net/fingerprint.js
// saves every version in fingerprint/, desktop/fingerprint.js) the way the game does, and
// shows what the game answers with, labelled, with the fingerprint's JSON one value a line.
// Nothing is sent anywhere.
// The fingerprinter returns one text: its values joined by a separator the server writes
// into each session's source (a Cyrillic letter, "У" one time, "с" the next), which the
// game sends as one part. It is split here by the last .join('<separator>') in the source.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { ROUTE } from '../core/shared.js';
import { takeOptions } from '../core/args.js';
import { agoText, plural } from '../core/text.js';
import { game } from '../game/bindings.js';

const OPTION = Object.freeze({ RAW: 'raw' });
const ASYNC_MS = 10000; // an async fingerprinter that has not answered by then
const LABEL_WIDTH = 30;
const KEY_WIDTH = 20;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f]*:[0-9a-f:]+$/i;
const ORIGIN = /^https?:\/\/[^/\s]+$/;
const BASE36 = /^[0-9a-z]{1,7}$/; // a 32-bit hash written with toString(36)
const JOIN = /\.join\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*\)/g;

const jsonObject = (text) => {
  if (!/^\{/.test(text)) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
};
const localZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } };

// The separator of the source's last .join('...'), or null.
function separatorOf(code) {
  let sep = null;
  for (const m of code.matchAll(JOIN)) {
    try { sep = JSON.parse(`"${m[2].replace(/"/g, '\\"')}"`); } catch { sep = m[2]; }
  }
  return sep;
}
const codePoint = (ch) => [...ch].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

// What a value is, from the value itself (docs/research/fingerprinting.md §7.2): the fingerprinter's
// return has no names, and a new version may order it differently.
function labelOf(text, tag, code) {
  const obj = jsonObject(text);
  if (obj) return 'userAgent' in obj ? `fingerprint, full (${plural(Object.keys(obj).length, 'value')})` : `fingerprint, hardware only (${plural(Object.keys(obj).length, 'value')})`;
  if (text === tag) return 'build tag (its argument v)';
  // In quotes in the source: the server wrote it there for this session.
  const written = !!text && (code.includes(`'${text}'`) || code.includes(`"${text}"`));
  if (IPV4.test(text) || IPV6.test(text)) return written ? 'IP address (the server\'s view, in the source)' : 'IP address';
  if (written) return 'token (the server wrote it into the source)';
  if (ORIGIN.test(text)) return 'page origin';
  if (text === localZone()) return 'time zone';
  if (BASE36.test(text)) return 'fingerprint hash (MurmurHash3, base 36)';
  return '?';
}

// What the game sends back for a return value (scripts/libs/flash.js, RELIABLE_TASK): a
// string, number or boolean as one part, an array as its parts, anything else nothing.
function replyOf(v) {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return [String(v)];
  if (Array.isArray(v)) return v.map((x) => String(x));
  return null;
}

// As the game runs it: (source)(`tag`) for a task, (source)(`tag`, answer) for an async one.
function evaluate(fp, tag) {
  const fn = (0, eval)(`(${fp.code})`);
  if (typeof fn !== 'function') throw new Error(`${fp.file} is not a function`);
  if (fp.kind !== 'async') return Promise.resolve(fn(tag));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer after ${ASYNC_MS / 1000} s`)), ASYNC_MS);
    fn(tag, (v) => { clearTimeout(timer); resolve(v); });
  });
}

function showReply(parts, tag, raw, code) {
  const sep = parts.length === 1 ? separatorOf(code) : null;
  const values = sep && parts[0].includes(sep) ? parts[0].split(sep) : parts;
  print(`The game would answer with ${plural(parts.length, 'part')} (RESPONSE, callback ID, then these)`
    + `${values !== parts ? `: one text, ${plural(values.length, 'value')} joined by "${sep}" (${codePoint(sep)}, this session's separator)` : ''}:`, COLOR.title);
  if (raw) {
    parts.forEach((text, i) => print(`  [${i}] ${JSON.stringify(text)}`, COLOR.plain));
    return;
  }
  values.forEach((text, i) => {
    const label = labelOf(text, tag, code);
    const obj = jsonObject(text);
    if (!obj) { print(`  [${i}] ${label.padEnd(LABEL_WIDTH)} ${text}`, label === '?' ? COLOR.notice : COLOR.plain); return; }
    print(`  [${i}] ${label}`, COLOR.bright);
    for (const [k, v] of Object.entries(obj)) print(`        ${k.padEnd(KEY_WIDTH)} ${typeof v === 'string' ? v : JSON.stringify(v)}`, COLOR.plain);
  });
}

async function latest() {
  const r = await fetch(ROUTE.fingerprint, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function run(args) {
  const { options, rest } = takeOptions(args, Object.values(OPTION));
  if (rest.length) throw new Error('usage: fingerprint [--raw] | fingerprint list');
  const raw = options.has(OPTION.RAW);
  return latest()
    .then(async (fp) => {
      if (!fp) {
        print('No fingerprinter saved yet. The main server sends it after you log in to multiplayer; it is saved then.', COLOR.notice);
        return;
      }
      const tag = `${game.buildTag()}`;
      print(`Fingerprinter ${fp.id} (${fp.file}): ${fp.kind}, ${fp.chars} chars, seen ${plural(fp.seen, 'time')}, last ${agoText(Date.now() - Date.parse(fp.last))}`
        + `${fp.versions > 1 ? `; ${fp.versions} versions saved ("fingerprint list")` : ''}.`, COLOR.hint);
      const parts = replyOf(await evaluate(fp, tag));
      if (!parts) { print('It returned no string, number, boolean or array: the game would send no answer.', COLOR.warn); return; }
      showReply(parts, tag, raw, fp.code);
      if (!raw) print('Values the server wrote into the source (the IP address, tokens) are from when it was saved. Nothing was sent.', COLOR.hint);
    })
    .catch((e) => print(`error: could not run the fingerprinter: ${e.message}`, COLOR.error));
}

function list(args) {
  if (args.length) throw new Error('usage: fingerprint list');
  return fetch(ROUTE.fingerprints, { cache: 'no-store' })
    .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); })
    .then((versions) => {
      if (!versions.length) { print('No fingerprinter saved yet in fingerprint/.', COLOR.notice); return; }
      const now = Date.now();
      print(`Fingerprinter versions in fingerprint/ (${versions.length}), the latest first. "fingerprint" runs the latest.`, COLOR.title);
      for (const v of versions) {
        print(`  ${v.id}  ${v.latest ? 'latest' : '      '}  ${v.kind.padEnd(5)}  ${String(v.chars).padStart(7)} chars  seen ${String(v.seen).padStart(4)}x`
          + `  first ${v.first.slice(0, 10)}, last ${agoText(now - Date.parse(v.last))}  ${v.file}`, v.latest ? COLOR.ok : COLOR.plain);
      }
    })
    .catch((e) => print(`error: could not list the fingerprinters: ${e.message} (desktop wrapper only)`, COLOR.error));
}

export const fingerprintCommand = {
  name: 'fingerprint',
  aliases: ['fp'],
  remote: false, // the host's files (core/remote.js)
  usage: 'fingerprint [--raw] | fingerprint list',
  desc: 'Run the latest fingerprinter the main server sent and show what the game answers',
  help: {
    about: [
      'The main server sends the game a browser fingerprinter (JavaScript, RELIABLE_TASK;',
      'docs/research/fingerprinting.md), which the game runs and answers. Every version that arrives is',
      'saved once in fingerprint/ (not in git); a version seen again is not saved again.',
      '"fingerprint" runs the latest here, as the game does, and shows the answer: each',
      'value labelled from what it is, the fingerprint\'s JSON one value a line. The',
      'fingerprinter joins its values into one text with a separator the server picks',
      'each session; they are split here by the separator in the source.',
    ],
    args: [
      ['--raw', 'the parts exactly as the game would send them, in quotes, not split'],
    ],
    examples: [
      ['fingerprint', 'what the server learns about this machine'],
      ['fingerprint --raw', 'the answer as sent'],
      ['fingerprint list', 'every version saved'],
    ],
    notes: [
      'Nothing is sent: the answer is only shown. The source can hold values the server',
      'wrote into it (your IP address as it saw it, tokens); those are from when it was saved.',
      'Desktop wrapper only: the wrapper keeps the files.',
    ],
  },
  run,
  subcommands: [
    {
      name: 'list',
      aliases: ['versions', 'ls'],
      usage: 'fingerprint list',
      desc: 'Every fingerprinter version saved in fingerprint/, the latest first',
      help: {
        about: [
          'A version is the code without its values (strings, numbers): one the server',
          'changed. Its file holds the newest text, with the last session\'s values.',
        ],
        see: ['fingerprint'],
      },
      run: list,
    },
  ],
};
