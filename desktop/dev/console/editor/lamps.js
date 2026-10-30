// Lamps in the running level. The game keeps its lights in parallel arrays (place,
// power, state: 2 with a flare, -1 without, 0 off, 1 turned on by a trigger) that hold
// more than the map's lamps: after the map is read it drops lamps a lit decoration
// stands on and adds lights of its own (lit decorations, a faint fill along the
// walls). Each light is drawn once into a shape of its own, its rays stopped by the
// walls, and the lightmap is those shapes over the darkness (frame2.js, "L-map").
// So which light a map lamp is, is found by its place when it is first edited, and
// remembered until the level starts over. An edit builds it again in its slot with the
// loader's lamp branch, draws its shape and flare with the game's own code (read from
// its file like the loader), and has the game draw the lightmap again. A lamp the
// loader does not keep (no flare, outside every background) is put out.
import { blockEnd, branchOf, buildElement, builtCount, loaderSource, loaderProblem, runGameCode } from './loader.js';

const ID = String.raw`[$\wЀ-ӿ]+`;
const OFF = 0, FLARE = 2;
// Plain names the light drawing writes as globals ("var g", "var alphas").
const SHAPE_SCRATCH = Object.freeze(['g', 'alphas']);

let found = new Map(); // element id -> slot in the game's light arrays
let code = null; // what lamps.js read from the game's file, for its source
let codeFor = null;

export function forgetLamps() { found = new Map(); }

// The game's string-table names replaced by their text, to read its code by shape.
const decoded = (src) => src.replace(new RegExp(String.raw`(^|[^.\w$Ѐ-ӿ])(\$[\wЀ-ӿ]+)`, 'g'),
  (m, pre, name) => (typeof globalThis[name] === 'string' ? pre + JSON.stringify(globalThis[name]) : m));

// The body of the counted loop "for(v=0;v<n;v++){...}" around position at: { loopVar, body }.
function loopAround(src, at) {
  const header = new RegExp(String.raw`for\((${ID})=0;\1<${ID};\1\+\+\)\s*\{`, 'g');
  let best = null;
  for (let m; (m = header.exec(src)) && m.index < at;) {
    const open = m.index + m[0].length - 1;
    const end = blockEnd(src, open);
    if (end > at) best = { loopVar: m[1], body: src.slice(open, end + 1) };
  }
  return best;
}

const one = (src, re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`the game's ${what} was not found`);
  return m;
};

// { x, y, power, state, count, light, flare, flares, redraw } from the game's file.
export function parseLights(src, lampCode) {
  const lamp = decoded(lampCode);
  const arr = (attr) => one(lamp, new RegExp(String.raw`(${ID})\[${ID}\]=(?:Math\.min\()?parseFloat\(b\["#${attr}"\]\)`), `lamp ${attr} array`)[1];
  const state = one(lamp, new RegExp(String.raw`(${ID})\[(${ID})\]=2;`), 'lamp state array');
  const light = loopAround(src, src.indexOf('createRadialGradientAndBeginFill('));
  const flare = loopAround(src, src.indexOf('new lens_flare'));
  if (!light || !flare) throw new Error('the game\'s light drawing was not found');
  const flares = one(flare.body, new RegExp(String.raw`(${ID})\[${ID}\]=graphics_3d_front\.addChildAt\(new lens_flare`), 'flare list')[1];
  const draw = src.indexOf('drawWithQuality(');
  const fns = [...src.slice(0, draw).matchAll(new RegExp(String.raw`function (${ID})\(`, 'g'))];
  if (draw < 0 || !fns.length) throw new Error('the game\'s lightmap drawing was not found');
  return { x: arr('x'), y: arr('y'), power: arr('power'), state: state[1], count: state[2], light, flare, flares, redraw: fns[fns.length - 1][1] };
}

function lights() {
  const src = loaderSource();
  const branch = branchOf('lamp');
  if (!src || !branch) throw new Error(loaderProblem() || 'the game\'s loader has no lamp');
  if (codeFor !== src) { code = parseLights(src, branch.code); codeFor = src; }
  const g = globalThis;
  return { ...code, X: g[code.x], Y: g[code.y], S: g[code.state], n: g[code.count] };
}

// The slot of element e's light, or null when the level has none for it.
export function lampOf(e) {
  if (found.has(e.id)) return found.get(e.id);
  const { X, Y, S, n } = lights();
  const claimed = new Set(found.values());
  // As the level loaded it (after a restart the game made it from the map), or as it is now.
  for (const f of [e.live?.loaded, e.attrs].filter(Boolean)) {
    const x = parseFloat(f.x), y = parseFloat(f.y);
    for (let i = 0; i < n; i++) {
      if (!claimed.has(i) && S[i] !== undefined && X[i] === x && Y[i] === y) { found.set(e.id, i); return i; }
    }
  }
  return null;
}

// The flares standing where light i is, hidden (as the game puts out a lamp).
function hideFlares(L, i) {
  for (const f of globalThis[L.flares] || []) {
    if (f && f.x === L.X[i] && f.y === L.Y[i]) { f.visible = false; f.scaleX = f.scaleY = 0; }
  }
}

const redraw = (L) => globalThis[L.redraw](false);

// Element e's light as its attributes say, in its slot (a new one at the end when it
// has none). Returns its slot, or null when the loader does not keep it.
export function placeLamp(e) {
  const L = lights();
  let i = lampOf(e);
  if (i !== null) hideFlares(L, i);
  const at = i ?? builtCount('lamp');
  const kept = buildElement('lamp', e.attrs, at);
  const S = globalThis[L.state];
  if (!kept) {
    if (i !== null) { S[i] = OFF; redraw(L); }
    return null;
  }
  i = at;
  found.set(e.id, i);
  runGameCode(L.light.body, 'lamp-light', { set: { [L.light.loopVar]: i }, keep: SHAPE_SCRATCH });
  if (S[i] === FLARE) runGameCode(L.flare.body, 'lamp-flare', { set: { [L.flare.loopVar]: i } });
  redraw(L);
  return i;
}

// Puts element e's light out (a deleted lamp).
export function removeLamp(e) {
  const L = lights();
  const i = lampOf(e);
  if (i === null) throw new Error('the running level has no light for it');
  hideFlares(L, i);
  L.S[i] = OFF;
  redraw(L);
}
