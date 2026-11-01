#!/usr/bin/env node
// Downloads the map editor's list of trigger actions, its object parameters and their
// value lists, and writes desktop/dev/opcodes.js. The dev console uses them to read
// triggers written as text ("triggers exec") and in its map editor's params panel.
//
// The editor's "edit triggers as text" view writes each action as
//   MovableTo( "#door*13", "#region*306" );
// where the name is the editor's alias for an action number ("op123" when it has none).
// The game itself only knows the numbers. The aliases, with each action's description
// and the kind of its two targets, are registered in the editor's lib_params.js:
//   addTrigger(0, "Movable &#8250; Force Movable 'A' move to region 'B'", 'door', 'region'); AddOpcodeAlias('MovableTo');
// The same file has every object parameter the editor's params panel shows:
//   param_type[23] = ['use_on', 'region_activation', 'Activation on', 'Determines ...', 'region'];
// (attribute, kind of value, title, description, object kind or '*'), and the values a
// kind offers: special_values_table['region_activation'][9] = "''USE'' key, only Red team ...".
// The editor page needs a login, its scripts do not.
//
// Sad Burst 2 (--sadburst, src/kernel/config/clients.ts): its editor bundles the same file, minified,
// into scripts/ale/ale-all.js (statements joined with commas, "a.b" for a["b"]); the
// patterns below take both forms. It has no server for the value lists.
//
// Usage: node tools/fetch-opcodes.js [--sadburst] [--from file] [--out file]
//   --sadburst  the Sad Burst 2 editor, into desktop/dev/opcodes.sadburst.js
//               ("npm run fetch-opcodes --sadburst")
//   --from      read a saved lib_params.js instead of downloading it
//   --out       target file (default: desktop/dev/opcodes.js)
'use strict';

const fs = require('fs');
const path = require('path');
const { clientFor, withoutClientFlag } = require('../src/kernel/config/clients.ts');

const REPO = path.join(__dirname, '..');
const SOURCE_URL = 'https://www.plazmaburst2.com/level_editor/editor_scripts/lib_params.js';
// The value lists the editor asks its server for (models, skins): the reply is script
// that fills special_values_table, read here like the editor's own file. Public.
const LISTS_URL = 'https://www.plazmaburst2.com/level_editor/e_server.php?a=request_consts';
const SERVER_LISTS = Object.freeze(['char', 'decor_model', 'bg_model']);
const UA = 'Mozilla/5.0 (pb2-desktop fetch-opcodes)';
// Sanity checks: a list much shorter than this, or these aliases on other numbers,
// means the file changed shape and the result cannot be trusted.
const MIN_ACTIONS = 400;
const MIN_ALIASES = 100;
const KNOWN = Object.freeze({ MovableTo: 0, 'next if VarA == ValueB': 123 });
const MIN_PARAMS = 50;

// The source without comments. Strings are kept as written, so a "//" inside one
// stays; a regular expression literal containing a quote would confuse it, and the
// sanity checks catch that.
function stripComments(src) {
  let out = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      out += c;
      if (c === '\\') out += src[++i] ?? '';
      else if (c === quote || (c === '\n' && quote !== '`')) quote = null;
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 1;
    } else {
      if (c === '"' || c === '\'' || c === '`') quote = c;
      out += c;
    }
  }
  return out;
}

const STRING = String.raw`(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')`;
const CALL = new RegExp(String.raw`\b(addTrigger|AddOpcodeAlias)\s*\(\s*(?:(-?\d+)\s*,\s*(${STRING})\s*,\s*(${STRING})\s*,\s*(${STRING})|(${STRING}))\s*\)`, 'g');

const unquote = (s) => s.slice(1, -1).replace(/\\(.)/g, '$1');
const ENTITIES = Object.freeze({ '&#8250;': '›', '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#39;': '\'' });
const plainText = (s) => s.replace(/<[^>]*>/g, '')
  .replace(/&#(\d+);/g, (e, n) => ENTITIES[e] ?? String.fromCharCode(Number(n)))
  .replace(/&\w+;/g, (e) => ENTITIES[e] ?? e);

// { actions: { type: { desc, a, b, alias? } }, aliases: { alias: type } }. Like the
// editor: an alias belongs to the action registered last, a later registration of a
// number replaces the earlier one, and an alias used twice means the lower number
// (the editor looks names up with indexOf).
function parseParams(src) {
  const actions = {};
  let last = null;
  for (const m of stripComments(src).matchAll(CALL)) {
    if (m[1] === 'addTrigger') {
      last = Number(m[2]);
      actions[last] = { desc: plainText(unquote(m[3])), a: unquote(m[4]), b: unquote(m[5]) };
    } else if (last !== null && actions[last]) {
      actions[last].alias = unquote(m[6]);
    }
  }
  const aliases = {};
  for (const type of Object.keys(actions).map(Number).filter((t) => t >= 0).sort((x, y) => x - y)) {
    const alias = actions[type].alias;
    if (alias && !(alias in aliases)) aliases[alias] = type;
  }
  return { actions, aliases };
}

const PARAM = new RegExp(String.raw`\bparam_type\[\s*\d+\s*\]\s*=\s*\[\s*(${STRING})\s*,\s*(${STRING})\s*,\s*(${STRING})\s*,\s*(${STRING})\s*,\s*(${STRING})\s*\]`, 'g');
// A property as a["b"] or, minified, a.b: the name is group 1 (quoted) or group 2 (bare).
const PROP = String.raw`(?:\[\s*(${STRING})\s*\]|\.([A-Za-z_$][\w$]*))`;
const END = String.raw`\s*(?=[;,)\n]|$)`;
const VALUE = new RegExp(String.raw`\bspecial_values_table${PROP}\[\s*(-?\d+|${STRING})\s*\]\s*=\s*(${STRING})${END}`, 'g');
const propName = (quoted, bare) => (quoted !== undefined ? unquote(quoted) : bare);

// params: [{ name, kind, title, desc, cls }] in the editor's order; values: { kind:
// { value: label } }. Lists the editor builds in loops or from other files are left as
// far as their plain assignments go.
function parseParamTable(src) {
  const code = stripComments(src);
  const params = [...code.matchAll(PARAM)].map((m) => ({
    name: unquote(m[1]), kind: unquote(m[2]), title: plainText(unquote(m[3])), desc: plainText(unquote(m[4])), cls: unquote(m[5]),
  }));
  const values = {};
  for (const m of code.matchAll(VALUE)) {
    const kind = propName(m[1], m[2]);
    const key = /^-?\d+$/.test(m[3]) ? m[3] : unquote(m[3]);
    if (/^\[listof/.test(key)) continue; // which objects the editor lists, not a value ("[val]" is kept: "type a number")
    (values[kind] ||= {})[key] = plainText(unquote(m[4]));
  }
  return { params, values };
}

// { mark: kind } for the engine marks whose parameter has a kind of its own (the
// editor's mark_pairs['mark_sky'] = 'sky_model'; the others are free text).
const MARK_PAIR = new RegExp(String.raw`\bmark_pairs${PROP}\s*=\s*(${STRING})${END}`, 'g');
function parseMarkPairs(src) {
  const out = {};
  for (const m of stripComments(src).matchAll(MARK_PAIR)) {
    const key = propName(m[1], m[2]);
    if (key.startsWith('mark_')) out[key.slice('mark_'.length)] = unquote(m[3]);
  }
  return out;
}

// The action categories ("Movable" in "Movable › Force Movable 'A' ...") in the order
// the editor meets them, each with the colour it gets: the next one of its "rainbow"
// list (lib_params.js, addTrigger).
const RAINBOW = new RegExp(String.raw`\bvar\s+rainbow\s*=\s*\[([^\]]*)\]`);
function parseCategories(src, actions) {
  const code = stripComments(src);
  const m = code.match(RAINBOW);
  const rainbow = m ? [...m[1].matchAll(new RegExp(STRING, 'g'))].map((x) => unquote(x[0])) : [];
  const categories = [];
  for (const k of [...code.matchAll(CALL)]) {
    if (k[1] !== 'addTrigger') continue;
    const parts = plainText(unquote(k[3])).split(' › ');
    if (parts.length > 1 && !categories.some((c) => c.name === parts[0])) categories.push({ name: parts[0], color: rainbow[categories.length] || '#ffffff' });
  }
  return categories.length ? categories : null;
}

function check({ actions, aliases, params, values, categories, markPairs }) {
  const problems = [];
  const n = Object.keys(actions).length;
  if (n < MIN_ACTIONS) problems.push(`only ${n} actions found (expected ${MIN_ACTIONS}+)`);
  if (Object.keys(aliases).length < MIN_ALIASES) problems.push(`only ${Object.keys(aliases).length} aliases found (expected ${MIN_ALIASES}+)`);
  if (params && params.length < MIN_PARAMS) problems.push(`only ${params.length} object parameters found (expected ${MIN_PARAMS}+)`);
  if (values && !values.region_activation) problems.push('no "region_activation" values found');
  if (categories !== undefined && !categories) problems.push('no action categories found');
  if (markPairs && !markPairs.sky) problems.push('no engine mark "sky" in the mark pairs');
  for (const [alias, type] of Object.entries(KNOWN)) {
    if (aliases[alias] !== type) problems.push(`"${alias}" is ${aliases[alias] ?? 'missing'}, expected ${type}`);
  }
  return problems;
}

function render({ actions, aliases, params, values, categories, markPairs }, source) {
  const data = { source, fetched: new Date().toISOString().slice(0, 10), aliases, actions, params, values, categories, markPairs };
  return '// Trigger action names and descriptions from the map editor, for the dev console.\n'
    + '// Generated by "npm run fetch-opcodes"; do not edit.\n'
    + `globalThis.PB2_OPCODES = ${JSON.stringify(data, null, 1)};\n`;
}

// { kind: { value: label } } for the lists the editor's server gives (char, decor_model,
// ...). A list that cannot be had is left out, with a warning.
async function fetchServerLists() {
  const out = {};
  for (const kind of SERVER_LISTS) {
    try {
      const res = await fetch(LISTS_URL, {
        method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `a=get_images&for_class=${kind}&update_const=all`,
      });
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const { values } = parseParamTable(await res.text());
      if (values[kind]) out[kind] = values[kind];
      else throw new Error('no values in the reply');
    } catch (e) {
      console.warn(`warning: the editor's "${kind}" list was not fetched (${e.message})`);
    }
  }
  return out;
}

async function main() {
  const client = clientFor();
  const argv = withoutClientFlag(process.argv.slice(2));
  const sourceUrl = client.editorScript || SOURCE_URL;
  let from = null;
  let out = client.opcodes;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') from = argv[++i];
    else if (argv[i] === '--out') out = path.resolve(argv[++i]);
    else if (argv[i] === '-h' || argv[i] === '--help') {
      console.log('Usage: node tools/fetch-opcodes.js [--sadburst] [--from lib_params.js] [--out file]');
      return;
    } else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  let src;
  if (from) src = fs.readFileSync(from, 'utf8');
  else {
    const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA } });
    if (res.status !== 200) throw new Error(`${sourceUrl}: HTTP ${res.status}`);
    if (!/javascript/.test(res.headers.get('content-type') || '')) throw new Error(`${sourceUrl}: not a script (the editor moved?)`);
    src = await res.text();
  }
  const table = { ...parseParams(src), ...parseParamTable(src) };
  if (!from && !client.editorScript) Object.assign(table.values, await fetchServerLists());
  table.categories = parseCategories(src, table.actions);
  table.markPairs = parseMarkPairs(src);
  const problems = check(table);
  if (problems.length) {
    for (const p of problems) console.error(`problem: ${p}`);
    throw new Error(`${out} not written`);
  }
  fs.writeFileSync(out, render(table, from ? path.basename(from) : sourceUrl));
  console.log(`Found ${Object.keys(table.actions).length} trigger actions (${Object.keys(table.aliases).length} with names), ${table.params.length} object parameters, ${Object.keys(table.values).length} value lists. Wrote ${path.relative(REPO, out)}`);
}

module.exports = { parseParams, parseParamTable, parseCategories, parseMarkPairs, stripComments, check };

if (require.main === module) {
  main().catch((e) => {
    console.error(`fetch-opcodes failed: ${e.message}`);
    process.exit(2);
  });
}
