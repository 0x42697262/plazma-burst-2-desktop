// Hooks: Frida-style instrumentation of the game's scripts, written in hooks/*.js.
// Guide: docs/features/hooks.md.
//
// The game's files on disk are never changed and never replaced whole. When the page
// loads, the wrapper (desktop/main.js) asks build() for a plan:
//   1. Dry run: every hook file runs here, in a sandbox, where Interceptor.attach /
//      replace and Script.patch only record what they target. Handlers never run here.
//   2. Each hook is checked on its own against the game's scripts: every target must be
//      exactly one "function <name>(" declaration, every patch must match as often as it
//      says. A hook that fails is left out entirely (with the reason); the rest load.
//   3. The scripts the plan touches get the patches and a one-line trampoline at the
//      start of each target function: if(PB2Hooks.t(id))return PB2Hooks.c(id,...).
//   4. index.html gets the runtime (desktop/hooks-runtime.js) and the hook files before
//      the game's first script; there the same hook files run again and attach their
//      real handlers.
// Changing code as it is served (not after it runs) is what keeps the game's anti-tamper
// scan quiet: it records every global function's source at page load, and by then the
// trampolines are part of that source.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROUTE_DIR = '__hooks/';
const ROUTES = Object.freeze({ runtime: 'runtime.js', hook: 'hook/', send: 'send' });
const RUNTIME_FILE = path.join(__dirname, 'hooks-runtime.js');
const GLOBAL = 'PB2Hooks'; // the runtime's one global; the trampolines call it

// Loaded: <name>.js. Skipped: *.example.js (templates), names starting with "." or "_".
const isHookFile = (f) => f.endsWith('.js') && !f.endsWith('.example.js') && !/^[._]/.test(f);
const hookName = (f) => f.slice(0, -'.js'.length);

const STATUS = Object.freeze({ loaded: 'loaded', disabled: 'disabled', error: 'error' });

// Same identifier characters as tools/find-names.js: the game's names are $ plus Latin
// and Cyrillic letters.
const ID_CHAR = '0-9A-Za-z_$\\u0400-\\u04FF';
const PLACEHOLDER = /⟨([A-Za-z_][A-Za-z0-9_]*)⟩/g;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isRegExp = (v) => Object.prototype.toString.call(v) === '[object RegExp]'; // works across vm realms

// desktop/dev/names.js sets globalThis.PB2_NAMES; run it in a sandbox to read it.
function loadNames(file) {
  try {
    const ctx = {};
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
    return ctx.PB2_NAMES && typeof ctx.PB2_NAMES === 'object' ? { ...ctx.PB2_NAMES } : {};
  } catch {
    return {};
  }
}

// The game's own scripts, in load order, from index.html: [relative path].
function listScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    if (!/^[a-z]+:|^\/\//i.test(m[1])) out.push(m[1]);
  }
  return out;
}

// ⟨key⟩ in patch text -> the name from names.js.
function fillNames(text, names, regexSafe) {
  return text.replace(PLACEHOLDER, (m, key) => {
    if (!names[key]) throw new Error(`⟨${key}⟩ is not in desktop/dev/names.js`);
    return regexSafe ? escapeRe(names[key]) : names[key];
  });
}

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------
const TARGET = Symbol.for('pb2hooks.target');
const target = (key, name) => ({ [TARGET]: true, key, name });

// Runs one hook file in a sandbox. Returns { options, targets: [{ key, name }],
// patches: [{ file, find, replace, count }] }; throws with a readable message.
function dryRun(file, code, names) {
  const targets = [];
  const patches = [];
  const pageOnly = (what) => () => { throw new Error(`${what} only works inside handlers (in the game), not at the top level of a hook file`); };
  const addTarget = (t, api) => {
    if (!t || !t[TARGET]) throw new Error(`${api}: the target must be Game.<name> or Game.fn("<obfuscated name>")`);
    targets.push({ key: t.key, name: t.name });
    return { detach() {} };
  };
  const Game = new Proxy({}, {
    get(_, key) {
      if (typeof key !== 'string') return undefined;
      if (key === 'fn') return (name) => target(null, String(name));
      if (key === 'names') return { ...names };
      if (key === 'read' || key === 'write' || key === 'isMP' || key === 'method') return pageOnly(`Game.${key}()`);
      if (!names[key]) throw new Error(`Game.${key}: no such name in desktop/dev/names.js (run "npm run find-names", or add a rule to tools/find-names.js)`);
      return target(key, names[key]);
    },
  });
  const Interceptor = {
    attach: (t) => addTarget(t, 'Interceptor.attach'),
    replace: (t) => { addTarget(t, 'Interceptor.replace'); },
    revert() {},
    detachAll() {},
  };
  const Script = {
    patch(scriptFile, find, replace, opts = {}) {
      if (typeof scriptFile !== 'string') throw new Error('Script.patch: the first argument is the script, e.g. "scripts/main.js"');
      if (typeof find !== 'string' && !isRegExp(find)) throw new Error('Script.patch: find must be a string or a RegExp');
      if (typeof replace !== 'string' && typeof replace !== 'function') throw new Error('Script.patch: replace must be a string or a function');
      const count = opts.count === undefined ? 1 : opts.count;
      if (count !== 'all' && !(Number.isInteger(count) && count > 0)) throw new Error('Script.patch: count must be a whole number above 0, or "all"');
      patches.push({ file: scriptFile, find, replace, count });
    },
  };
  const module = { exports: {} };
  const ctx = vm.createContext({ console });
  const wrapped = new vm.Script(`(function (Interceptor, Script, Game, send, module, exports) {\n${code}\n})`, { filename: file, lineOffset: -1 });
  wrapped.runInContext(ctx)(Interceptor, Script, Game, () => {}, module, module.exports);
  const ex = module.exports || {};
  const options = {
    enabled: ex.enabled !== false,
    multiplayer: ex.multiplayer !== false,
    description: typeof ex.description === 'string' ? ex.description : '',
  };
  return { options, targets, patches };
}

// ---------------------------------------------------------------------------
// Finding and changing code
// ---------------------------------------------------------------------------
// Index after the closing ")" of a parameter list that starts at `open` ("("), or -1.
// Skips strings and template literals; parameter lists have no regex literals in practice.
function skipParams(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
  }
  return -1;
}

// Where a trampoline goes in every "function <name>(...) {" declaration: [index after "{"].
function findFunction(src, name) {
  const re = new RegExp(`(^|[^${ID_CHAR}.])function\\s+${escapeRe(name)}\\s*\\(`, 'g');
  const out = [];
  for (const m of src.matchAll(re)) {
    const open = m.index + m[0].length - 1;
    const close = skipParams(src, open);
    if (close < 0) continue;
    const brace = src.slice(close).search(/\S/);
    if (brace >= 0 && src[close + brace] === '{') out.push(close + brace + 1);
  }
  return out;
}

const trampoline = (id, name) => `if(${GLOBAL}.t(${id}))return ${GLOBAL}.c(${id},this,arguments,${name});`;

// Matches of a patch in a script: [{ index, text, groups }].
function patchMatches(src, p, names) {
  if (typeof p.find === 'string') {
    const needle = fillNames(p.find, names, false);
    if (!needle) throw new Error('Script.patch: find is empty');
    const out = [];
    for (let i = src.indexOf(needle); i >= 0; i = src.indexOf(needle, i + needle.length)) out.push({ index: i, text: needle, groups: [] });
    return out;
  }
  const flags = p.find.flags.includes('g') ? p.find.flags : p.find.flags + 'g';
  const re = new RegExp(fillNames(p.find.source, names, true), flags);
  return [...src.matchAll(re)].map((m) => ({ index: m.index, text: m[0], groups: m.slice(1) }));
}

// The text a match becomes. A string is literal (no "$1" patterns: the game's names
// start with "$"); a function gets (match, ...groups) like String.replace.
const patchText = (p, m, names) => (typeof p.replace === 'function'
  ? String(p.replace(m.text, ...m.groups))
  : fillNames(p.replace, names, false));

function checkCount(p, n) {
  if (p.count === 'all' ? n === 0 : n !== p.count) {
    const want = p.count === 'all' ? 'at least once' : `${p.count} time${p.count === 1 ? '' : 's'}`;
    const shown = typeof p.find === 'string' ? JSON.stringify(p.find.length > 60 ? p.find.slice(0, 60) + '...' : p.find) : String(p.find);
    throw new Error(`Script.patch(${JSON.stringify(p.file)}, ${shown}): found ${n} time${n === 1 ? '' : 's'}, expected ${want}`);
  }
}

function applyPatch(src, p, names) {
  const matches = patchMatches(src, p, names);
  checkCount(p, matches.length);
  let out = '';
  let at = 0;
  for (const m of matches) {
    out += src.slice(at, m.index) + patchText(p, m, names);
    at = m.index + m.text.length;
  }
  return out + src.slice(at);
}

// The one script that declares `name`: { file, index }. Throws when there is none or more.
function locate(sources, name) {
  const hits = [];
  for (const [file, src] of sources) for (const index of findFunction(src, name)) hits.push({ file, index });
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error(`no "function ${name}(" in the game's scripts. Interceptor works on function declarations; for anything else use Script.patch`);
  throw new Error(`"function ${name}(" is declared ${hits.length} times (${hits.map((h) => h.file).join(', ')}); hook the one you mean with Script.patch`);
}

// Checks one hook against the scripts (throws the first problem).
function validate(hook, sources, names) {
  for (const p of hook.patches) {
    if (!sources.has(p.file)) throw new Error(`Script.patch: "${p.file}" is not one of the game's scripts (see index.html), e.g. "scripts/main.js"`);
    checkCount(p, patchMatches(sources.get(p.file), p, names).length);
  }
  for (const t of hook.targets) locate(sources, t.name);
}

// Patches and trampolines for the given hooks, in order. Returns { files, targets } or
// throws { hook, error } for the first hook whose change no longer fits (two hooks
// patching the same code).
function apply(hooks, originals, names) {
  const work = new Map(originals);
  for (const h of hooks) {
    try {
      for (const p of h.patches) work.set(p.file, applyPatch(work.get(p.file), p, names));
    } catch (error) {
      throw { hook: h, error: new Error(`after the hooks loaded before it: ${error.message}`) };
    }
  }
  const targets = {};
  const owners = new Map();
  for (const h of hooks) {
    for (const t of h.targets) {
      if (!(t.name in targets)) { targets[t.name] = Object.keys(targets).length; owners.set(t.name, h); }
    }
  }
  for (const [name, id] of Object.entries(targets)) {
    let at;
    try {
      at = locate(work, name);
    } catch (error) {
      throw { hook: owners.get(name), error: new Error(`after the patches of the hooks loaded before it: ${error.message}`) };
    }
    const src = work.get(at.file);
    work.set(at.file, src.slice(0, at.index) + trampoline(id, name) + src.slice(at.index));
  }
  const files = new Map();
  for (const [file, src] of work) if (src !== originals.get(file)) files.set(file, src);
  return { files, targets };
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------
// gameDir: index.html and the scripts. hooksDir: hooks/*.js. names: from names.js.
// Returns { hooks: [{ name, file, status, error, options, targets, patches }], files:
// Map(script -> changed text), targets: { obfuscated name -> id }, loaded: [hook] }.
function build({ gameDir, hooksDir, names = {} }) {
  const plan = { hooks: [], files: new Map(), targets: {}, loaded: [] };
  let entries = [];
  try {
    entries = fs.readdirSync(hooksDir).filter(isHookFile).sort();
  } catch {
    return plan;
  }
  if (!entries.length) return plan;

  const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
  const originals = new Map();
  for (const rel of listScripts(html)) {
    if (!rel.endsWith('.js')) continue;
    try { originals.set(rel, fs.readFileSync(path.join(gameDir, rel), 'utf8')); } catch {}
  }

  for (const f of entries) {
    const file = path.join(hooksDir, f);
    const hook = { name: hookName(f), file, status: STATUS.loaded, error: '', options: { enabled: true, multiplayer: true, description: '' }, targets: [], patches: [], code: '' };
    plan.hooks.push(hook);
    try {
      hook.code = fs.readFileSync(file, 'utf8');
      Object.assign(hook, dryRun(file, hook.code, names));
      if (!hook.options.enabled) { hook.status = STATUS.disabled; continue; }
      validate(hook, originals, names);
    } catch (e) {
      hook.status = STATUS.error;
      hook.error = e && e.message ? e.message : String(e);
    }
  }

  // Apply together; a hook that clashes with an earlier one is dropped and the rest retried.
  for (;;) {
    const ok = plan.hooks.filter((h) => h.status === STATUS.loaded);
    try {
      Object.assign(plan, apply(ok, originals, names));
      plan.loaded = ok;
      return plan;
    } catch (clash) {
      if (!clash || !clash.hook) throw clash;
      clash.hook.status = STATUS.error;
      clash.hook.error = clash.error.message;
    }
  }
}

// One line per hook for the terminal: [level, text].
function describe(plan) {
  return plan.hooks.map((h) => {
    if (h.status === STATUS.error) return ['error', `Hook ${h.name}: not loaded: ${h.error}`];
    if (h.status === STATUS.disabled) return ['info', `Hook ${h.name}: disabled (module.exports.enabled = false)`];
    const parts = [];
    if (h.targets.length) parts.push(`${h.targets.length} function${h.targets.length === 1 ? '' : 's'}`);
    if (h.patches.length) parts.push(`${h.patches.length} patch${h.patches.length === 1 ? '' : 'es'}`);
    if (!h.options.multiplayer) parts.push('off in multiplayer');
    return ['info', `Hook ${h.name}: loaded${parts.length ? ` (${parts.join(', ')})` : ''}`];
  });
}

// ---------------------------------------------------------------------------
// What the page gets
// ---------------------------------------------------------------------------
const hookUrl = (name) => `${ROUTE_DIR}${ROUTES.hook}${encodeURIComponent(name)}.js`;

// index.html with the runtime and the loaded hooks before the game's first script.
// Returns the html unchanged when nothing is loaded or there is no <script>.
function injectTags(html, plan) {
  if (!plan.hooks.length) return html;
  const tags = `<script src="${ROUTE_DIR}${ROUTES.runtime}"></script>`
    + plan.loaded.map((h) => `<script src="${hookUrl(h.name)}"></script>`).join('');
  const at = html.search(/<script\b/i);
  return at < 0 ? html : html.slice(0, at) + tags + html.slice(at);
}

// The runtime with its configuration: every hook (so "hooks" lists failed ones too).
function runtimeScript(plan, names) {
  const config = {
    names,
    targets: plan.targets,
    sendUrl: ROUTE_DIR + ROUTES.send,
    hooks: plan.hooks.map((h) => ({
      name: h.name,
      status: h.status,
      error: h.error,
      multiplayer: h.options.multiplayer,
      description: h.options.description,
      functions: h.targets.map((t) => t.key || t.name),
      patches: h.patches.length,
    })),
  };
  return `${fs.readFileSync(RUNTIME_FILE, 'utf8')}\n(${JSON.stringify(config)});\n//# sourceURL=${ROUTE_DIR}${ROUTES.runtime}`;
}

// A hook file for the page: its code inside PB2Hooks.define(...). Line 2 is its line 1.
function hookScript(plan, name) {
  const h = plan.loaded.find((x) => x.name === name);
  if (!h) return null;
  return `${GLOBAL}.define(${JSON.stringify(name)}, function (Interceptor, Script, Game, send, module, exports) {\n${h.code}\n});\n//# sourceURL=hooks/${name}.js`;
}

module.exports = {
  ROUTE_DIR, ROUTES, STATUS, GLOBAL,
  isHookFile, loadNames, listScripts, dryRun, findFunction, applyPatch, build, describe,
  injectTags, runtimeScript, hookScript, trampoline,
};
