// The map's logic as a graph: every element with a uid is a node at its map position,
// and every reference to a uid is a link. That covers what the runtime keeps (regions,
// timers, deaths starting triggers) and what it resolves away: a trigger action's
// target is an index once the map has loaded, without saying whether it is a door, a
// region or a player, but the map text still names it. Read once per map.
import { game } from '../game/bindings.js';
import { ACTION, ACTION_NAMES, RUNS_REGION_TRIGGER } from '../game/actions.js';
import { MAP } from '../core/shared.js';
import { triggerList, regionList } from '../triggers/model.js';

// What a link means, which is how the view colours it.
export const LINK = Object.freeze({
  START: 'start', // runs a trigger: a region's use target, a timer, a death, "run trigger"
  CONTROL: 'control', // enables or disables a trigger or a timer
  ACT: 'act', // any other action on an element: move a door, change a decor, set HP...
  ATTACH: 'attach', // moves with a door
  REF: 'ref', // any other attribute naming an element
});

const STARTS = new Set([ACTION.RUN_TRIGGER, ACTION.JUMP_TO_TRIGGER, ...RUNS_REGION_TRIGGER]);
const CONTROLS = new Set([ACTION.DISABLE_TRIGGER, ACTION.ENABLE_TRIGGER, ACTION.ENABLE_TIMER, ACTION.DISABLE_TIMER]);
// Attributes that start the trigger they name.
const STARTING_ATTRS = new Set(['use_target', 'target', 'ondeath']);
const ATTACH_ATTR = 'attach';
const ACTION_ATTR = /^actions_(\d+)_target[AB]$/;
const TYPE_ATTR = (n) => `actions_${n}_type`;
// <tag a="..." b="..." />. Values hold no quotes, so ">" inside one is fine.
const TAG = /<([a-z_]+)((?:\s+[A-Za-z0-9_]+="[^"]*")*)\s*\/?>/g;
const ATTR = /([A-Za-z0-9_]+)="([^"]*)"/g;

const linkKindOfAttr = (attr) => (STARTING_ATTRS.has(attr) ? LINK.START : attr === ATTACH_ATTR ? LINK.ATTACH : LINK.REF);
const linkKindOfAction = (type) => (STARTS.has(type) ? LINK.START : CONTROLS.has(type) ? LINK.CONTROL : LINK.ACT);
export const actionLabel = (n, type) => `action ${n}: ${type}${ACTION_NAMES[type] ? ` ${ACTION_NAMES[type]}` : ''}`;

// The graph of a map text. logicGraph() is the running map's, read once per map.
export function buildGraph(text) {
  const nodes = [];
  const byUid = new Map(); // a uid used twice names the first, as the game resolves it
  const perTag = {};
  for (const m of text.matchAll(TAG)) {
    const attrs = {};
    for (const a of m[2].matchAll(ATTR)) attrs[a[1]] = a[2];
    const tag = m[1];
    const index = perTag[tag] = (perTag[tag] ?? -1) + 1; // the game numbers each kind in map order
    if (!attrs.uid) continue;
    const num = (k) => (attrs[k] === undefined ? undefined : Number(attrs[k]));
    const node = { uid: attrs.uid, tag, index, x: num('x'), y: num('y'), w: num('w'), h: num('h'), attrs };
    nodes.push(node);
    if (!byUid.has(node.uid)) byUid.set(node.uid, node);
  }
  const links = [];
  for (const from of nodes) {
    for (const [attr, value] of Object.entries(from.attrs)) {
      if (attr === 'uid') continue;
      const to = byUid.get(value);
      if (!to || to === from) continue;
      const act = attr.match(ACTION_ATTR);
      if (act) {
        const type = Number(from.attrs[TYPE_ATTR(act[1])]);
        links.push({ from, to, kind: linkKindOfAction(type), label: actionLabel(Number(act[1]), type) });
      } else {
        links.push({ from, to, kind: linkKindOfAttr(attr), label: attr });
      }
    }
  }
  const into = new Map(); // uid -> links ending there
  const outOf = new Map(); // uid -> links starting there
  for (const l of links) {
    if (!into.has(l.to.uid)) into.set(l.to.uid, []);
    into.get(l.to.uid).push(l);
    if (!outOf.has(l.from.uid)) outOf.set(l.from.uid, []);
    outOf.get(l.from.uid).push(l);
  }
  return { nodes, byUid, links, into, outOf };
}

let builtFor = null;
let graph = null;

// null while the map text is not readable (it is compressed until the level starts).
export function logicGraph() {
  const text = game.mapText();
  if (typeof text !== 'string' || !text || text.startsWith(MAP.compressedPrefix)) return null;
  if (text !== builtFor) { builtFor = text; graph = buildGraph(text); }
  return graph;
}

// A node by uid ("#god_all") or, failing that, a trigger by index ("393", "#393").
export function findNode(g, q) {
  const lq = String(q).toLowerCase();
  const byUid = g.nodes.find((n) => n.uid.toLowerCase() === lq);
  if (byUid) return byUid;
  const i = /^#?\d+$/.test(lq) ? Number(lq.replace('#', '')) : -1;
  const t = triggerList()[i];
  return t ? g.byUid.get(t.uid) || null : null;
}

// Where a node is now. Regions move with the doors they are attached to, so the game's
// own region is read; everything else is where the map put it.
export function placeOf(node) {
  if (node.tag === 'region') {
    const r = regionList()[node.index];
    if (r && Number.isFinite(r.x)) return { x: r.x, y: r.y, w: r.w, h: r.h };
  }
  if (node.tag === 'player') {
    const c = game.chars()?.[node.index];
    if (c && c.io && Number.isFinite(c.x)) return { x: c.x, y: c.y };
  }
  return { x: node.x, y: node.y, w: node.w, h: node.h };
}

export const centreOf = (place) => ({
  x: place.x + (Number.isFinite(place.w) ? place.w / 2 : 0),
  y: place.y + (Number.isFinite(place.h) ? place.h / 2 : 0),
});

// The trigger chat messages run, which only the running game knows.
export const chatTriggerUid = () => {
  const i = game.sayTrigger();
  const t = typeof i === 'number' && i >= 0 ? triggerList()[i] : null;
  return t ? t.uid : null;
};
