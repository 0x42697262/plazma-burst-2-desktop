// The map's logic as a graph: every element that can be referred to is a node at its map
// position, and every reference is a link. That covers what the runtime keeps (regions,
// timers, deaths starting triggers) and what it resolves away: a trigger action's
// target is an index once the map has loaded, without saying whether it is a door, a
// region or a player, but the map text still names it. Read once per map.
// A reference is a uid ("#door*13") or, in older maps without uids, a number: the
// index of an element of the kind the attribute or the action's target takes (from the
// map editor's action list, desktop/dev/opcodes.js). An element without a uid gets
// "<tag>#<index>" as its name ("trigger#3"); real uids start with "#", so they never
// clash.
import { game } from '../../../../src/console/kernel/game/bindings.ts';
import { ACTION, ACTION_NAMES, RUNS_REGION_TRIGGER } from '../../../../src/console/kernel/game/actions.ts';
import { MAP_MARKER as MAP } from '../../../../src/shared/contract/keys.ts';
import { triggerList, regionList } from '../triggers/model.js';
import { actionInfo } from '../triggers/script.js';

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

// Kinds an element without a uid can still be referred to as, by number.
const NUMBERED = new Set(['trigger', 'timer', 'region', 'door', 'decor', 'player', 'enemy', 'vehicle', 'gun',
  'barrel', 'lamp', 'water', 'pushf', 'song']);
// What a number in an attribute refers to, by attribute ("" = any element's).
const ATTR_KIND = Object.freeze({
  use_target: 'trigger', target: 'trigger', ondeath: 'trigger', callback: 'trigger',
  attach: 'door', a: 'door', incar: 'vehicle',
});
// The map editor's target kinds, as the element kinds they name. "character" is the
// game's characters array: players and enemies together, in map order.
const TARGET_KIND = Object.freeze({
  trigger: 'trigger', timer: 'timer', region: 'region', door: 'door', decor: 'decor', character: 'character',
  vehicle: 'vehicle', gun: 'gun', barrel: 'barrel', lamp: 'lamp', water: 'water', pushf: 'pushf', pushf_damage: 'pushf',
});
const CHARACTER_TAGS = new Set(['player', 'enemy']);
const WHOLE = /^\d+$/;

export const nameless = (tag, index) => `${tag}#${index}`;

// Old maps leave out x and y of triggers, timers and engine marks. Like the map editor
// (lib_classes.js, SourceLost), they are shown in a row above the map's top left
// corner. items: [{ tag, attrs }] in map order; returns Map(item -> { x, y }) for the
// ones without a place. Used by the graph and the editor, so both put them in one spot.
const UNPLACED_TAGS = new Set(['trigger', 'timer', 'inf', 'image']);
const UNPLACED_STEP = 40;
const UNPLACED_ABOVE = 60;
export function unplacedSpots(items) {
  let left = Infinity;
  let top = Infinity;
  for (const { attrs } of items) {
    if (attrs.x !== undefined && Number.isFinite(Number(attrs.x))) left = Math.min(left, Number(attrs.x));
    if (attrs.y !== undefined && Number.isFinite(Number(attrs.y))) top = Math.min(top, Number(attrs.y));
  }
  if (!Number.isFinite(left)) left = 0;
  if (!Number.isFinite(top)) top = 0;
  const spots = new Map();
  for (const item of items) {
    if (UNPLACED_TAGS.has(item.tag) && (item.attrs.x === undefined || item.attrs.y === undefined)) {
      spots.set(item, { x: left + UNPLACED_STEP * spots.size, y: top - UNPLACED_ABOVE });
    }
  }
  return spots;
}

const linkKindOfAttr = (attr) => (STARTING_ATTRS.has(attr) ? LINK.START : attr === ATTACH_ATTR ? LINK.ATTACH : LINK.REF);
const linkKindOfAction = (type) => (STARTS.has(type) ? LINK.START : CONTROLS.has(type) ? LINK.CONTROL : LINK.ACT);
export const actionLabel = (n, type) => `action ${n}: ${type}${ACTION_NAMES[type] ? ` ${ACTION_NAMES[type]}` : ''}`;

// The graph of a map text. logicGraph() is the running map's, read once per map.
export function buildGraph(text) {
  const nodes = [];
  const elements = []; // every element, for unplacedSpots
  const byUid = new Map(); // a uid used twice names the first, as the game resolves it
  const byIndex = new Map(); // kind ('trigger', ..., 'character') -> [node by game index]
  const perTag = {};
  let characters = 0;
  const indexed = (kind) => { if (!byIndex.has(kind)) byIndex.set(kind, []); return byIndex.get(kind); };
  for (const m of text.matchAll(TAG)) {
    const attrs = {};
    for (const a of m[2].matchAll(ATTR)) attrs[a[1]] = a[2];
    const tag = m[1];
    const index = perTag[tag] = (perTag[tag] ?? -1) + 1; // the game numbers each kind in map order
    const character = CHARACTER_TAGS.has(tag) ? characters++ : undefined;
    const item = { tag, attrs, node: null };
    elements.push(item);
    if (!attrs.uid && !NUMBERED.has(tag)) continue;
    const num = (k) => (attrs[k] === undefined ? undefined : Number(attrs[k]));
    const uid = attrs.uid || nameless(tag, index);
    const node = { uid, named: !!attrs.uid, tag, index, character, x: num('x'), y: num('y'), w: num('w'), h: num('h'), attrs };
    nodes.push(node);
    item.node = node;
    if (!byUid.has(uid)) byUid.set(uid, node);
    indexed(tag)[index] = node;
    if (character !== undefined) indexed('character')[character] = node;
  }
  for (const [item, spot] of unplacedSpots(elements)) if (item.node) Object.assign(item.node, spot);
  // The element a value names: a uid, or a number of the kind given.
  const target = (value, kind) => {
    if (byUid.has(value) && value.startsWith('#')) return byUid.get(value);
    if (!kind || !WHOLE.test(value)) return null;
    return byIndex.get(kind)?.[Number(value)] || null;
  };
  const links = [];
  for (const from of nodes) {
    for (const [attr, value] of Object.entries(from.attrs)) {
      if (attr === 'uid') continue;
      const act = attr.match(ACTION_ATTR);
      if (act) {
        const type = Number(from.attrs[TYPE_ATTR(act[1])]);
        const info = actionInfo(type);
        const to = target(value, TARGET_KIND[attr.endsWith('A') ? info?.a : info?.b]);
        if (to && to !== from) links.push({ from, to, kind: linkKindOfAction(type), label: actionLabel(Number(act[1]), type) });
        continue;
      }
      // A region that uses a timer names the timer, not a trigger.
      const kind = attr === 'use_target' && (from.attrs.uses_timer === 'true' || from.attrs.uses_timer === '1') ? 'timer' : ATTR_KIND[attr];
      const to = target(value, kind);
      if (to && to !== from) links.push({ from, to, kind: linkKindOfAttr(attr), label: attr });
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
  return { nodes, byUid, byIndex, links, into, outOf };
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

// A node by uid ("#god_all", or "region#3" for one without), or else a trigger by index
// ("393", "#393").
export function findNode(g, q) {
  const lq = String(q).toLowerCase();
  const byUid = g.nodes.find((n) => n.uid.toLowerCase() === lq);
  if (byUid) return byUid;
  const i = /^#?\d+$/.test(lq) ? Number(lq.replace('#', '')) : -1;
  if (i < 0) return null;
  const t = triggerList()[i];
  return (t && t.uid && g.byUid.get(t.uid)) || g.byIndex.get('trigger')?.[i] || null;
}

// Where a node is now. Regions move with the doors they are attached to, so the game's
// own region is read; everything else is where the map put it.
export function placeOf(node) {
  if (node.tag === 'region') {
    const r = regionList()[node.index];
    if (r && Number.isFinite(r.x)) return { x: r.x, y: r.y, w: r.w, h: r.h };
  }
  if (node.character !== undefined) {
    const c = game.chars()?.[node.character];
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
