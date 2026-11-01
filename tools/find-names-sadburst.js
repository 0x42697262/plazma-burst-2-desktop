// "npm run find-names -- --sadburst": desktop/dev/names.sadburst.js for the Sad Burst 2 copy
// in game.sadburst/ (tools/fetch-game.js --sadburst). Called by tools/find-names.js.
//
// Sad Burst 2 is a fork of the official client: its obfuscated names are the official
// ones, but its code is minified (locals renamed, "if" turned into "&&", "true" into
// "!0", constants folded), so most patterns of find-names.js do not match it. A name is
// found in one of two ways, the first that works:
//   1. pattern  the find-names.js pattern matches its code once (after "!0" / "!1" are
//               read as true / false)
//   2. same     the name is the one the official client uses for it (found in game/ now,
//               or in desktop/dev/names.js), or the one this file had before, and it
//               appears in the Sad Burst 2 code
// So keep the official copy around ("npm run fetch-game") for the second way. If Sad
// Burst 2 ever renames its identifiers, the second way finds nothing and says so.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fsn = require('./find-names');
const { MANIFEST } = require('./fetch-sadburst');
const { CLIENTS } = require('../src/kernel/config/clients.ts');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Names this client does not have, and why. Left out of names.sadburst.js (so the console
// does not list them as missing); anything that asks for one gets "not in names.sadburst.js".
const NOT_IN_CLIENT = Object.freeze({
  // Used only by the own lobby server (server/, "npm run server"), which runs the
  // official client's code. Sad Burst handles report, endorse, kick and ban in one handler.
  authReport: 'only for the own lobby server (server/); Sad Burst handles reports in one merged handler',
  authEndorse: 'only for the own lobby server (server/); Sad Burst handles endorsements in one merged handler',
  // A block-scoped "let" in its minified tools script ({let ...,n=[],o=new Map,...}): it
  // cannot be reached from outside. Only the anti-cheat scan report's array names need it.
  lockedArrays: 'block-scoped in its minified tools script, so not reachable from outside (the scan report names no arrays)',
});

// The strings file (gamelogic/<hash>.js): {let e=globalThis;e.$name="...",...}.
function loadStrings(gameDir, manifest) {
  const ctx = {};
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(gameDir, manifest.strings.en), 'utf8'), ctx);
  const map = new Map();
  for (const [k, v] of Object.entries(ctx)) if (typeof v === 'string' && k.startsWith('$')) map.set(k, v);
  return map;
}

// Minified booleans back to words, so patterns written for the official code can match.
const unminify = (src) => src.replace(/!([01])(?![\w.])/g, (m, d) => (d === '0' ? 'true' : 'false'));

// The whole game, decoded: every script of the manifest, one after the other.
function loadCode(gameDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, MANIFEST), 'utf8'));
  const strings = loadStrings(gameDir, manifest);
  const code = manifest.order.map((f) => fsn.decode(fs.readFileSync(path.join(gameDir, f), 'utf8'), strings)).join('\n;\n');
  return { manifest, strings, code: unminify(code) };
}

// PB2_NAMES from a names file, or {}.
function readNamesFile(file) {
  try {
    const ctx = {};
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
    return ctx.PB2_NAMES && typeof ctx.PB2_NAMES === 'object' ? { ...ctx.PB2_NAMES } : {};
  } catch {
    return {};
  }
}

// Where the official names come from: [{ label, names }], best first.
function nameSources({ officialDir, officialNames, previous }) {
  const out = [];
  if (previous && fs.existsSync(previous)) out.push({ label: 'as before', names: readNamesFile(previous) });
  if (officialDir && fs.existsSync(path.join(officialDir, '_strings.js'))) {
    try { out.push({ label: 'official client', names: fsn.findNames(officialDir).found }); } catch {}
  }
  if (officialNames && fs.existsSync(officialNames)) out.push({ label: 'official names.js', names: readNamesFile(officialNames) });
  return out;
}

function findNames(gameDir, sources) {
  const { code } = loadCode(gameDir);
  const has = (name) => new RegExp(`(^|[^${fsn.ID_CHARS}$])${escapeRe(name)}(?![${fsn.ID_CHARS}$])`).test(code);
  const found = {};
  const info = {};
  const problems = [];
  const how = { pattern: 0, same: 0 };
  const whatOf = {};
  for (const rule of fsn.RULES) rule.keys.forEach((k, i) => { if (k !== '_') whatOf[k] = rule.what[i]; });

  // 1. Patterns, over the whole code (the files are not the official ones).
  let pending = fsn.RULES.slice();
  for (let pass = 0; pending.length && pass < 10; pass++) {
    const next = [];
    for (const rule of pending) {
      let re;
      try { re = fsn.compile(rule.re, found); } catch { next.push(rule); continue; }
      const values = rule.keys.map(() => new Set());
      let count = 0;
      for (const m of code.matchAll(re)) { count++; rule.keys.forEach((k, i) => values[i].add(m[i + 1])); }
      if (!count) continue;
      rule.keys.forEach((k, i) => {
        if (k === '_' || found[k] || values[i].size !== 1) return;
        found[k] = [...values[i]][0];
        info[k] = { what: whatOf[k], file: 'pattern', matches: count };
        how.pattern++;
      });
    }
    if (next.length === pending.length) break;
    pending = next;
  }

  // 2. The same name as the official client, when it is in this code.
  const expected = fsn.RULES.flatMap((r) => r.keys).filter((k) => k !== '_');
  for (const k of expected) {
    if (found[k]) continue;
    for (const src of sources) {
      const name = src.names[k];
      if (typeof name === 'string' && name && has(name)) {
        found[k] = name;
        info[k] = { what: whatOf[k], file: `same as the ${src.label}` };
        how.same++;
        break;
      }
    }
  }
  // A pattern that found something else than the official name: worth a look.
  for (const src of sources) {
    for (const [k, name] of Object.entries(src.names)) {
      if (info[k] && info[k].file === 'pattern' && typeof name === 'string' && name !== found[k] && has(name)) {
        problems.push(`${k}: the pattern found ${found[k]}, the ${src.label} has ${name} (also in this code)`);
      }
    }
  }
  if (!sources.length) problems.push('no official names to compare with: run "npm run fetch-game" (the official client) for the names patterns cannot find');
  const absent = expected.filter((k) => !found[k] && NOT_IN_CLIENT[k]);
  const wanted = expected.filter((k) => !absent.includes(k));
  const missing = wanted.filter((k) => !found[k]);
  return { found, info, problems, missing, expected: wanted, absent, how };
}

function run(opts = {}) {
  const client = CLIENTS.sadburst;
  const gameDir = path.resolve(opts.gameDir || client.gameDir);
  const out = path.resolve(opts.out || client.names);
  if (!fs.existsSync(path.join(gameDir, MANIFEST))) {
    throw new Error(`No Sad Burst 2 files in ${gameDir}. Run "npm run fetch-game -- --sadburst" first.`);
  }
  const sources = nameSources({
    officialDir: opts.officialDir === undefined ? CLIENTS.official.gameDir : opts.officialDir,
    officialNames: opts.officialNames === undefined ? CLIENTS.official.names : opts.officialNames,
    previous: opts.previous === undefined ? out : opts.previous,
  });
  const result = findNames(gameDir, sources);
  const version = fsn.gameVersion(gameDir);
  const total = result.expected.length;
  console.log(`Found ${total - result.missing.length} of ${total} names in ${gameDir} (${version}): `
    + `${result.how.pattern} by pattern, ${result.how.same} the same as the official client's.`);
  if (result.missing.length) console.log(`  not found: ${result.missing.join(', ')}`);
  if (result.absent.length) console.log(`  not in this client (fine): ${result.absent.join(', ')}`);
  for (const p of result.problems) console.log(`  problem: ${p}`);
  if (!opts.check) {
    const notes = result.absent.map((k) => `// ${k}: not in this client: ${NOT_IN_CLIENT[k]}`);
    const text = fsn.render(result, version).replace('run "npm run find-names"', 'run "npm run find-names -- --sadburst"')
      .replace('globalThis.PB2_NAMES = {', [...notes, 'globalThis.PB2_NAMES = {'].join('\n'));
    fs.writeFileSync(out, text);
    console.log(`Wrote ${path.relative(process.cwd(), out) || out}`);
  }
  return result;
}

module.exports = { run, findNames, loadCode, unminify, nameSources, NOT_IN_CLIENT };
