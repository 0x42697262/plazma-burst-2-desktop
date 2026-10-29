// Player traces as an overlay layer: a white line from you to each traced character,
// and a small label with their name and distance. A character off screen gets its
// label where the line leaves the screen, so the direction and distance still show.
import { GAME_WIDTH, GAME_HEIGHT, game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { player, charAt, isDown, charLabel, BODY_MIDDLE } from '../game/level.js';
import { setLayer, hasLayer, toScreen, crosshair } from './overlay.js';
import { drawLabels } from './labels.js';

const LAYER = 'trace';
const LINE_COLOR = '#ffffff';
const DOWN_COLOR = '#ffffff55'; // a character that is dead or down
const LINE_WIDTH = 0.7; // game units
const EDGE = 4; // labels of off-screen characters stay this far inside the screen
const BOUNDS = Object.freeze({ w: GAME_WIDTH, h: GAME_HEIGHT });

// A group traces characters who join later too: everyone else, or only some of them by
// kind (real players or NPCs) and by side (your team or the others), checked every
// frame. Picked characters are traced on top of it, dropped ones are left out.
//
// A character is picked (or dropped) by slot or as a person. The game keeps one
// character per slot and gives it to whoever joins next, so a slot is traced whoever is
// in it, and a person only while they are in the match: when they leave, that is the end
// of it, even if they come back.
export const TRACE_KIND = Object.freeze({ PLAYERS: 'players', NPC: 'npc' });
export const TRACE_SIDE = Object.freeze({ TEAM: 'team', ENEMIES: 'enemies' });
const KIND_OK = Object.freeze({
  [TRACE_KIND.PLAYERS]: (c) => !!c[F.HUMAN],
  [TRACE_KIND.NPC]: (c) => !c[F.HUMAN],
});
// The same team as "chars" and the game's damage and team chat: an equal team number.
const SIDE_OK = Object.freeze({
  [TRACE_SIDE.TEAM]: (c, me) => c.team === me.team,
  [TRACE_SIDE.ENEMIES]: (c, me) => c.team !== me.team,
});
let group = null; // { kind, side }, each null for any
const picked = { slots: new Set(), people: new Set() }; // indexes, personOf keys
const dropped = { slots: new Set(), people: new Set() }; // ones the group would trace

// Who is in slot i: their account, which a slot keeps for the player in it. Without one
// (NPCs, guests), the nickname in that slot.
const NO_ACCOUNT = ['', '.guest'];
function personOf(i, c = charAt(i)) {
  const login = typeof c.login === 'string' ? c.login : '';
  return NO_ACCOUNT.includes(login) ? `#${i} ${c.nickname}` : `@${login}`;
}

const isPicked = (set, i, who) => set.slots.has(i) || set.people.has(who);
const isEmpty = (set) => !set.slots.size && !set.people.size;
const clear = (set) => { set.slots.clear(); set.people.clear(); };
const pickedBySlot = (i) => picked.slots.has(i);

const inGroup = (c, me) => !!group && (!group.kind || KIND_OK[group.kind](c)) && (!group.side || SIDE_OK[group.side](c, me));

// Who is traced right now: characters that are still in the match, never you. People
// who left are forgotten here.
export function tracedNow() {
  const out = [];
  const me = player();
  const here = new Set();
  for (let i = 0; i < game.charCount(); i++) {
    const c = charAt(i);
    if (i === game.me() || !c) continue;
    const who = personOf(i, c);
    here.add(who);
    if (isPicked(picked, i, who) || (inGroup(c, me) && !isPicked(dropped, i, who))) out.push(i);
  }
  let left = false;
  for (const set of [picked.people, dropped.people]) {
    for (const who of set) if (!here.has(who)) { set.delete(who); left = true; }
  }
  // Not while the overlay draws this layer: it would come back for the next frame.
  if (left) queueMicrotask(refresh);
  return out;
}
export { pickedBySlot };
export const tracingGroup = () => group;

// From you to character i, in world units, as "chars" measures it.
export function distanceTo(i) {
  const me = player(), c = charAt(i);
  return Math.round(Math.hypot(c.x - me.x, c.y - me.y));
}

// The point where the line from o to p leaves the screen (EDGE inside it), or p when p
// is on screen.
function clampToScreen(o, p) {
  const min = { x: EDGE, y: EDGE }, max = { x: GAME_WIDTH - EDGE, y: GAME_HEIGHT - EDGE };
  let t = 1;
  for (const k of ['x', 'y']) {
    const d = p[k] - o[k];
    if (p[k] < min[k] && d) t = Math.min(t, (min[k] - o[k]) / d);
    if (p[k] > max[k] && d) t = Math.min(t, (max[k] - o[k]) / d);
  }
  t = Math.max(0, t);
  const at = (k) => Math.min(Math.max(o[k] + t * (p[k] - o[k]), min[k]), max[k]);
  return { x: at('x'), y: at('y') };
}

function drawTrace(ctx, m) {
  const me = player();
  if (!me) return null;
  const middle = (c) => toScreen(m, { x: c.x, y: c.y - BODY_MIDDLE });
  const from = middle(me);
  const items = [];
  ctx.lineWidth = LINE_WIDTH;
  for (const i of tracedNow()) {
    const c = charAt(i);
    const to = middle(c);
    if (![to.x, to.y].every(Number.isFinite)) continue;
    const down = isDown(c);
    ctx.strokeStyle = down ? DOWN_COLOR : LINE_COLOR;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    const at = clampToScreen(from, to);
    items.push({ x: at.x, y: at.y, text: `${charLabel(i, c)} ${distanceTo(i)}px${down ? ' (down)' : ''}` });
  }
  const labels = drawLabels(ctx, items, crosshair(m), BOUNDS);
  return { lines: items.length, labels };
}

const refresh = () => setLayer(LAYER, group || !isEmpty(picked) ? drawTrace : null);

// Characters as [index, bySlot]: by slot ("#2") the slot, else the person in it.
export function traceAdd(targets) {
  for (const [i, bySlot] of targets) {
    const who = personOf(i);
    if (bySlot) picked.slots.add(i); else picked.people.add(who);
    dropped.slots.delete(i);
    dropped.people.delete(who);
  }
  refresh();
}

// { kind, side }, each null for any. Characters picked before stay traced too.
export function traceGroup({ kind = null, side = null } = {}) {
  group = Object.freeze({ kind, side });
  clear(dropped);
  refresh();
}

// Whatever traces character i stops. A group leaves out the slot or the person.
export function traceRemove(i, bySlot) {
  const who = personOf(i);
  picked.slots.delete(i);
  picked.people.delete(who);
  if (group) { if (bySlot) dropped.slots.add(i); else dropped.people.add(who); }
  refresh();
}

export function traceOff() {
  group = null;
  clear(picked);
  clear(dropped);
  refresh();
}

export const traceShown = () => hasLayer(LAYER);
