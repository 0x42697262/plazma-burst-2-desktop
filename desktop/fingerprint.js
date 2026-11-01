// Fingerprinter versions: the main server sends the game a browser fingerprinter as
// JavaScript source (a RELIABLE_TASK, FINGERPRINTING.md), and the dev console hands each
// one it sees to this module (desktop/dev/console/net/fingerprint.js). Every version is
// kept, once, in fingerprint/ (not in git):
//   fingerprint/<date>_<time>_<id>.js   the source exactly as the server sent it
//   fingerprint/index.json              every version: when it was first and last seen,
//                                       how often, sync or async; and which is the latest
// A version is the code's shape: its source with the contents of every string and number
// left out (and comments and spacing), hashed. The server may write values of the session
// into the source (the IP address it sees, tokens); those differ at every login and are
// not a new version. A known version is never saved as a second file: its file is
// rewritten when the text differs, so it holds the newest values. The console's
// "fingerprint" runs the latest.
'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const INDEX = 'index.json';
const ID_CHARS = 12;
const CODE_CHARS_MAX = 1024 * 1024;
const KINDS = Object.freeze(['sync', 'async']);

const two = (n) => String(n).padStart(2, '0');
const stampOf = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}_${two(d.getHours())}-${two(d.getMinutes())}-${two(d.getSeconds())}`;
const NAME_CHAR = /[\w$\u0080-￿]/;

// The source without what changes from one session to the next: string and template
// contents (and which quotes), numbers, comments, spacing. Only for comparing: without
// spaces "let FP" reads "letFP", which is the same for every version.
function shapeOf(code) {
  let out = '';
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i);
      i = end < 0 ? code.length : end - 1;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end < 0 ? code.length : end + 1;
      continue;
    }
    if (c === '"' || c === '\'' || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) j += code[j] === '\\' ? 2 : 1;
      out += '""';
      i = j;
      continue;
    }
    if (c >= '0' && c <= '9' && !NAME_CHAR.test(code[i - 1] || '')) {
      let j = i;
      while (j < code.length && /[\w.]/.test(code[j])) j++;
      out += '0';
      i = j - 1;
      continue;
    }
    if (!/\s/.test(c)) out += c;
  }
  return out;
}

const versionId = (code) => crypto.createHash('sha256').update(shapeOf(code)).digest('hex').slice(0, ID_CHARS);

function createFingerprints({ dir, now = () => new Date() }) {
  let queue = Promise.resolve();
  const serial = (fn) => {
    const done = queue.then(fn);
    queue = done.catch(() => {});
    return done;
  };

  async function readIndex() {
    try {
      const index = JSON.parse(await fs.readFile(path.join(dir, INDEX), 'utf8'));
      if (index && typeof index.versions === 'object' && index.versions) return index;
    } catch {}
    return { latest: null, versions: {} };
  }
  async function writeIndex(index) {
    const file = path.join(dir, INDEX);
    await fs.writeFile(file + '.tmp', JSON.stringify(index, null, 2) + '\n');
    await fs.rename(file + '.tmp', file);
  }
  const readCode = (file) => fs.readFile(path.join(dir, file), 'utf8').catch(() => null);

  // One fingerprinter as received. Returns { id, file, status }: "new" (a file was made),
  // "updated" (a known version with new values: its file rewritten) or "same".
  function save(code, kind) {
    return serial(async () => {
      if (typeof code !== 'string' || !code) throw new Error('expected the fingerprinter\'s source');
      if (code.length > CODE_CHARS_MAX) throw new Error(`at most ${CODE_CHARS_MAX} characters`);
      if (!KINDS.includes(kind)) throw new Error(`kind: ${KINDS.join(' or ')}`);
      await fs.mkdir(dir, { recursive: true });
      const index = await readIndex();
      const id = versionId(code);
      const at = now();
      let v = index.versions[id];
      let status = 'same';
      if (!v) {
        v = { file: `${stampOf(at)}_${id}.js`, kind, chars: code.length, first: at.toISOString(), last: null, seen: 0 };
        index.versions[id] = v;
        status = 'new';
      } else if ((await readCode(v.file)) !== code) {
        status = 'updated';
      }
      if (status !== 'same') await fs.writeFile(path.join(dir, v.file), code);
      Object.assign(v, { kind, chars: code.length, last: at.toISOString(), seen: v.seen + 1 });
      index.latest = id;
      await writeIndex(index);
      return { id, file: v.file, status };
    });
  }

  // Every version, the latest first, then by when it was last seen.
  async function list() {
    const index = await readIndex();
    return Object.entries(index.versions)
      .map(([id, v]) => ({ id, ...v, latest: id === index.latest }))
      .sort((a, b) => (b.latest - a.latest) || String(b.last).localeCompare(String(a.last)));
  }

  // The latest version with its source, or null when none was saved yet.
  async function latest() {
    const index = await readIndex();
    const v = index.latest && index.versions[index.latest];
    if (!v) return null;
    const code = await readCode(v.file);
    if (code === null) return null;
    return { id: index.latest, ...v, code, versions: Object.keys(index.versions).length };
  }

  return { save, list, latest };
}

module.exports = { createFingerprints, shapeOf, versionId };
