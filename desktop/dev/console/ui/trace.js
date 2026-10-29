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

// A group traces characters who join later too: everyone else, or only real players
// (not bots). Picked characters are traced on top of it, dropped ones are left out.
export const TRACE_GROUP = Object.freeze({ ALL: 'all', PLAYERS: 'players' });
const IN_GROUP = Object.freeze({
  [TRACE_GROUP.ALL]: () => true,
  [TRACE_GROUP.PLAYERS]: (c) => !!c[F.HUMAN],
});
let group = null;
const picked = new Set(); // character indexes
const dropped = new Set(); // character indexes the group would trace

// Who is traced right now: characters that are still in the match, never you.
export function tracedNow() {
  const out = [];
  for (let i = 0; i < game.charCount(); i++) {
    const c = charAt(i);
    if (i === game.me() || !c) continue;
    if (picked.has(i) || (group && IN_GROUP[group](c) && !dropped.has(i))) out.push(i);
  }
  return out;
}
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

const refresh = () => setLayer(LAYER, group || picked.size ? drawTrace : null);

export function traceAdd(indexes) {
  for (const i of indexes) { picked.add(i); dropped.delete(i); }
  refresh();
}

// Characters picked before stay traced too.
export function traceGroup(g) {
  group = g;
  dropped.clear();
  refresh();
}

export function traceRemove(i) {
  picked.delete(i);
  if (group) dropped.add(i);
  refresh();
}

export function traceOff() {
  group = null;
  picked.clear();
  dropped.clear();
  refresh();
}

export const traceShown = () => hasLayer(LAYER);
