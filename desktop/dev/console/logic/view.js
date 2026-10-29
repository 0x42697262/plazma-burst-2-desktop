// The logic graph as an overlay layer: a line for every link, a marker for every element
// it touches, and its uid in tiny text.
import { GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { setLayer, hasLayer, drawOverlay, currentTransform, toScreen, onScreen, crosshair } from '../ui/overlay.js';
import { drawLabels } from '../ui/labels.js';
import { LINK, logicGraph, placeOf, centreOf } from './graph.js';

const LAYER = 'logic';
const LINK_COLOR = Object.freeze({
  [LINK.START]: '#33ff33', // the debug view's green
  [LINK.CONTROL]: '#ffd84d',
  [LINK.ACT]: '#3C9DFFcc',
  [LINK.ATTACH]: '#ffffff66',
  [LINK.REF]: '#ff66ffcc',
});
const NODE_COLOR = Object.freeze({ trigger: '#33ff33', timer: '#ffd84d', region: '#3C9DFF', player: '#ff6666' });
const OTHER_NODE_COLOR = '#ffffff';
const LINE_WIDTH = 0.6; // game units
const NODE_SIZE = 2.5;
const ARROW = 4;
const BOUNDS = Object.freeze({ w: GAME_WIDTH, h: GAME_HEIGHT });

let filter = null; // which links to draw: (link) => boolean
let screenOnly = false; // only links with both ends inside the camera view

// Inside the camera view now: a point on screen, or a rectangle (region, door) that
// overlaps it.
function visibleWith(m, node) {
  const place = placeOf(node);
  if (!Number.isFinite(place.x) || !Number.isFinite(place.y)) return false;
  const tl = toScreen(m, place);
  const br = Number.isFinite(place.w) && Number.isFinite(place.h)
    ? toScreen(m, { x: place.x + place.w, y: place.y + place.h }) : tl;
  return Math.max(tl.x, br.x) >= 0 && Math.min(tl.x, br.x) <= GAME_WIDTH
    && Math.max(tl.y, br.y) >= 0 && Math.min(tl.y, br.y) <= GAME_HEIGHT;
}

// For commands: whether an element is in the camera view right now.
export function isVisible(node) {
  const m = currentTransform();
  return !!m && visibleWith(m, node);
}

function arrowHead(ctx, from, to) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - ARROW * Math.cos(ang - 0.4), to.y - ARROW * Math.sin(ang - 0.4));
  ctx.lineTo(to.x - ARROW * Math.cos(ang + 0.4), to.y - ARROW * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawLogic(ctx, m) {
  const g = logicGraph();
  if (!g) return null;
  ctx.lineWidth = LINE_WIDTH;
  const at = new Map(); // node -> its screen point, worked out once per frame
  const point = (node) => {
    if (!at.has(node)) at.set(node, toScreen(m, centreOf(placeOf(node))));
    return at.get(node);
  };
  const seen = new Map(); // node -> visible, worked out once per frame
  const visible = (node) => {
    if (!seen.has(node)) seen.set(node, visibleWith(m, node));
    return seen.get(node);
  };
  const shown = new Set();
  let lines = 0;
  for (const link of g.links) {
    if (filter && !filter(link)) continue;
    const a = point(link.from), b = point(link.to);
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
    if (screenOnly ? !(visible(link.from) && visible(link.to)) : !onScreen(a) && !onScreen(b)) continue;
    ctx.strokeStyle = ctx.fillStyle = LINK_COLOR[link.kind];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    arrowHead(ctx, a, b);
    shown.add(link.from).add(link.to);
    lines++;
  }
  const items = [];
  for (const node of shown) {
    const p = point(node);
    if (!onScreen(p)) continue;
    const place = placeOf(node);
    ctx.strokeStyle = ctx.fillStyle = NODE_COLOR[node.tag] || OTHER_NODE_COLOR;
    if (Number.isFinite(place.w) && Number.isFinite(place.h)) {
      const tl = toScreen(m, place), br = toScreen(m, { x: place.x + place.w, y: place.y + place.h });
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    } else {
      ctx.fillRect(p.x - NODE_SIZE / 2, p.y - NODE_SIZE / 2, NODE_SIZE, NODE_SIZE);
    }
    items.push({ x: p.x, y: p.y, text: node.uid });
  }
  const labels = drawLabels(ctx, items, crosshair(m), BOUNDS);
  return { lines, nodes: shown.size, labels };
}

// Draws one frame of the overlay and returns what the logic layer drew (for tests).
export function drawFrame() {
  const out = drawOverlay();
  return out ? out[LAYER] ?? null : null;
}

// screen: draw only links with both ends inside the camera view, as it moves.
export function showLogic(linkFilter, { screen = false } = {}) {
  filter = linkFilter;
  screenOnly = screen;
  setLayer(LAYER, drawLogic);
}

export function hideLogic() {
  setLayer(LAYER, null);
  filter = null;
  screenOnly = false;
}

export const logicShown = () => hasLayer(LAYER);
