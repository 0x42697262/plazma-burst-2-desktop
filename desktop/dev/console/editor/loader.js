// The game's own map loader, reused to build one object. scripts/frame2.js builds a
// level at the top level of the script: for each element of the map it sets the
// globals a (the tag) and b (its attributes, b["#x"]) and runs a branch
// "if(a==<tag>){...}" that makes the object at the kind's counter and advances it; a
// second loop then turns uid references into indexes ("if(a==<tag>)" again, with
// counters of its own). All of it is globals, so a branch can be run again for one
// element: the counter set to that element's index rebuilds it in place, at the end
// adds one. The code comes from the game's file itself, so it is whatever this game
// version does.
// The branches are found by their shape, not by line: from the loop that holds the
// "box" branch, the loops over the map's elements that follow (the game builds walls
// to vehicles in one, decorations to characters in the next, then resolves uids in a
// third). A kind's first branch builds it; a later one for the same kind resolves it. The tags
// are written through the game's string table (if(a==$x), $x = "box"), read from the
// page.
const FRAME_URL = 'scripts/frame2.js';
const SOURCE_PREFIX = 'pb2dev-loader';
const BRANCH = /if\(\s*((?:a==[^|&)]+)(?:\|\|a==[^|&)]+)*)\s*\)\s*\{/g;
// A kind's counter: a statement "$x++;" (a for loop's "i++)" is not one).
const COUNTER = /(\$[^\s;=[\]().,+\-*/!&|<>?:{}"'`]+)\+\+;/g;
// Globals the branches use as scratch; put back after a run so the game sees no change.
const SCRATCH = Object.freeze(['a', 'b', 'mc', 'i', 'i2', 'n']);

let loader = null; // { first: { tag: { code, counter } }, second: { ... } }
let problem = 'the game\'s loader has not been read yet';

export const loaderReady = () => !!loader;
export const loaderProblem = () => problem;

// The end of the block that opens at src[open] ("{"), skipping strings and comments.
function blockEnd(src, open) {
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    const ch = src[k];
    if (ch === '"' || ch === '\'' || ch === '`') { k = stringEnd(src, k); continue; }
    if (ch === '/' && src[k + 1] === '/') { k = src.indexOf('\n', k); if (k < 0) return -1; continue; }
    if (ch === '/' && src[k + 1] === '*') { k = src.indexOf('*/', k + 2) + 1; if (k <= 0) return -1; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return k;
  }
  return -1;
}

function stringEnd(src, start) {
  const q = src[start];
  for (let k = start + 1; k < src.length; k++) {
    if (src[k] === '\\') { k++; continue; }
    if (q === '`' && src[k] === '$' && src[k + 1] === '{') { k = blockEnd(src, k + 1); continue; }
    if (src[k] === q) return k;
  }
  return src.length;
}

// A tag as the code writes it: a quoted string, or a string-table variable.
function tagOf(token) {
  const t = token.trim();
  if (/^(["']).*\1$/.test(t)) return t.slice(1, -1);
  const v = globalThis[t];
  return typeof v === 'string' ? v : null;
}

// Every branch in src[from..to): [{ tags, code }].
function branchesIn(src, from, to) {
  const out = [];
  BRANCH.lastIndex = from;
  for (let m; (m = BRANCH.exec(src)) && m.index < to;) {
    const open = m.index + m[0].length - 1;
    const end = blockEnd(src, open);
    if (end < 0) break;
    const tags = m[1].split('||').map((part) => tagOf(part.replace(/^a==/, ''))).filter(Boolean);
    out.push({ tags, code: src.slice(open, end + 1) });
    BRANCH.lastIndex = end + 1;
  }
  return out;
}

// The loop over the map's elements that holds position `at`: [start, end] of its body.
function loopAround(src, at) {
  const header = src.lastIndexOf('.children())', at);
  if (header < 0) return null;
  const open = src.indexOf('{', header);
  const end = blockEnd(src, open);
  return end > at ? [open, end] : null;
}

function nextLoop(src, after) {
  const header = src.indexOf('.children())', after);
  if (header < 0) return null;
  const open = src.indexOf('{', header);
  const end = blockEnd(src, open);
  return end > 0 ? [open, end] : null;
}

const lastCounter = (code) => { let c = null; for (const m of code.matchAll(COUNTER)) c = m[1]; return c; };

const MAX_LOOPS = 6;

// Reads the game's loader from its own file (served by the wrapper like the game):
// { first: { tag: { code, counter } }, second: { ... } }. Branches for several tags at
// once (players and enemies, built together) are left out.
export function parseLoader(src) {
  const box = branchesIn(src, 0, src.length).find((br) => br.tags.length === 1 && br.tags[0] === 'box');
  if (!box) throw new Error('no "box" branch in the game\'s loader');
  let loop = loopAround(src, src.indexOf(box.code));
  if (!loop) throw new Error('the loader\'s first loop was not found');
  const first = {};
  const second = {};
  for (let n = 0; loop && n < MAX_LOOPS; n++, loop = nextLoop(src, loop[1])) {
    const branches = branchesIn(src, loop[0], loop[1]).filter((br) => br.tags.length === 1);
    if (!branches.length) break; // past the loader
    const seenHere = new Set();
    for (const { tags: [tag], code } of branches) {
      if (seenHere.has(tag)) continue;
      seenHere.add(tag);
      const table = first[tag] ? second : first;
      if (!table[tag]) table[tag] = { code, counter: lastCounter(code) };
    }
  }
  return { first, second };
}

export async function readLoader(fetchFn = globalThis.fetch) {
  try {
    const r = await fetchFn(FRAME_URL, { cache: 'force-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    loader = parseLoader(await r.text());
    problem = '';
  } catch (err) {
    loader = null;
    problem = `the game's loader could not be read (${err.message})`;
  }
  return loaderReady();
}

// Whether this kind can be built by the game's loader in place: a branch of its own
// that keeps a counter.
export const canRebuild = (tag) => !!loader?.first[tag]?.counter;

function run(code, name) {
  (0, eval)(`${code}\n//# sourceURL=${SOURCE_PREFIX}-${name}.js`);
}

// Runs a branch of `pass` for one element, at `index` of its kind: in place when there
// is one, added at the end when index is the count. The game's scratch globals and the
// counter are as they were afterwards (except a counter that grew by the addition).
function runBranch(pass, tag, attrs, index) {
  const branch = loader[pass][tag];
  if (!branch) return false;
  const g = globalThis;
  const saved = Object.fromEntries(SCRATCH.map((k) => [k, g[k]]));
  const counter = branch.counter;
  const before = counter ? g[counter] : undefined;
  try {
    g.a = tag;
    g.b = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [`#${k}`, v]));
    if (counter) g[counter] = index;
    run(branch.code, `${pass}-${tag}`);
  } finally {
    if (counter && index < before) g[counter] = before;
    for (const k of SCRATCH) g[k] = saved[k];
  }
  return true;
}

// Builds element (tag, attrs) as the game's loader would, at `index`: its first-pass
// branch, then its second-pass one (uid references to indexes).
export function buildElement(tag, attrs, index) {
  if (!loader) throw new Error(problem);
  if (!loader.first[tag]) throw new Error(`the game's loader has no "${tag}" branch`);
  runBranch('first', tag, attrs, index);
  if (loader.second[tag]) runBranch('second', tag, attrs, index);
}
