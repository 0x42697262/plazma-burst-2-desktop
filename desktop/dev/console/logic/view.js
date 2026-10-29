// Draws the logic graph over the level: a line for every link, a marker for every
// element it touches, and its uid in tiny text. Like the game's own debug view ("debug
// 1"), but on a canvas of its own laid over the game's, so nothing of the game is
// changed: the debug view's switch is an anti-cheat guarded value, this only reads the
// camera. Redrawn every animation frame while shown.
import { game, GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { isActive, player } from '../game/level.js';
import { LINK, logicGraph, placeOf, centreOf } from './graph.js';
import { layoutLabels, FONT_SIZE, LINE_HEIGHT, PAD } from './labels.js';

const LINK_COLOR = Object.freeze({
  [LINK.START]: '#33ff33', // the debug view's green
  [LINK.CONTROL]: '#ffd84d',
  [LINK.ACT]: '#3C9DFFcc',
  [LINK.ATTACH]: '#ffffff66',
  [LINK.REF]: '#ff66ffcc',
});
const NODE_COLOR = Object.freeze({ trigger: '#33ff33', timer: '#ffd84d', region: '#3C9DFF', player: '#ff6666' });
const OTHER_NODE_COLOR = '#ffffff';
const LABEL_COLOR = '#ffffffdd';
const LABEL_PLATE = '#000000aa'; // behind the text, so it reads over the level
const LABEL_OPEN_PLATE = '#0E2236ee'; // the group under the crosshair
const LABEL_LEADER = '#ffffff55'; // from a moved label back to its point
const LABEL_FONT = `${FONT_SIZE}px DejaVuSansMono`; // in game units, so it stays tiny at any zoom
const LINE_WIDTH = 0.6; // game units
const NODE_SIZE = 2.5;
const ARROW = 4;
const MARGIN = 40; // game units past the screen edge that still count as on screen

let overlay = null;
let frame = 0; // the pending animation frame
let filter = null; // which links to draw: (link) => boolean
let screenOnly = false; // only links with both ends inside the camera view

// The transform from world units to overlay pixels, as the game's debug view sets it.
function worldTransform(canvas, cam) {
  const unit = canvas.width / GAME_WIDTH;
  const sx = cam.parentScaleX * cam.scaleX;
  const sy = cam.parentScaleY * cam.scaleY;
  return {
    unit,
    a: unit * sx, d: unit * sy,
    e: unit * (cam.parentX + cam.parentScaleX * cam.x),
    f: unit * (cam.parentY + cam.parentScaleY * cam.y),
  };
}

export const toScreen = (m, p) => ({ x: (m.a * p.x + m.e) / m.unit, y: (m.d * p.y + m.f) / m.unit });

const onScreen = (p) => p.x > -MARGIN && p.x < GAME_WIDTH + MARGIN && p.y > -MARGIN && p.y < GAME_HEIGHT + MARGIN;

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

// The world-to-screen transform now, or null without a level, canvas or camera.
function currentTransform() {
  const canvas = game.gameCanvas();
  const cam = game.camera();
  return canvas && cam && isActive() ? worldTransform(canvas, cam) : null;
}

// For commands: whether an element is in the camera view right now.
export function isVisible(node) {
  const m = currentTransform();
  return !!m && visibleWith(m, node);
}

// Keeps the overlay exactly over the game canvas, whatever size the window is.
function fit(canvas) {
  if (!overlay) {
    overlay = document.createElement('canvas');
    overlay.id = 'pb2dev-logic';
    Object.assign(overlay.style, { position: 'fixed', pointerEvents: 'none', zIndex: canvas.style.zIndex || '2' });
    canvas.after(overlay);
  }
  if (overlay.width !== canvas.width) overlay.width = canvas.width;
  if (overlay.height !== canvas.height) overlay.height = canvas.height;
  const r = canvas.getBoundingClientRect();
  Object.assign(overlay.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  return overlay.getContext('2d');
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

// Draws one frame. Returns what was drawn, for the status line and for tests.
export function drawFrame() {
  const canvas = game.gameCanvas();
  const cam = game.camera();
  const g = logicGraph();
  if (!canvas || !cam || !g || !isActive()) { if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height); return null; }
  const ctx = fit(canvas);
  const m = worldTransform(canvas, cam);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  // Everything is drawn in screen game units (unit scale only), so lines and text stay
  // thin and tiny at any zoom; positions go through the camera first.
  ctx.setTransform(m.unit, 0, 0, m.unit, 0, 0);
  ctx.lineWidth = LINE_WIDTH;
  const at = new Map(); // node -> its screen point, worked out once per frame
  const point = (node) => {
    if (!at.has(node)) at.set(node, toScreen(m, centreOf(placeOf(node))));
    return at.get(node);
  };
  const shown = new Set();
  const seen = new Map(); // node -> visible, worked out once per frame
  const visible = (node) => {
    if (!seen.has(node)) seen.set(node, visibleWith(m, node));
    return seen.get(node);
  };
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
  const labels = drawLabels(ctx, items, m);
  return { lines, nodes: shown.size, labels };
}

// The crosshair, which follows the mouse in world units (also with the pointer locked).
function crosshair(m) {
  const p = player();
  return p && Number.isFinite(p.tarx) && Number.isFinite(p.tary) ? toScreen(m, { x: p.tarx, y: p.tary }) : null;
}

function drawLabels(ctx, items, m) {
  const { labels, hidden } = layoutLabels(items, { cursor: crosshair(m), bounds: { w: GAME_WIDTH, h: GAME_HEIGHT } });
  ctx.font = LABEL_FONT;
  ctx.textBaseline = 'top';
  for (const l of labels) {
    const moved = l.x > l.at.x + PAD * 4 || l.x + l.w < l.at.x - PAD * 4 || l.y > l.at.y + PAD * 4 || l.y + l.h < l.at.y - PAD * 4;
    if (moved) {
      ctx.strokeStyle = LABEL_LEADER;
      ctx.beginPath();
      ctx.moveTo(l.at.x, l.at.y);
      ctx.lineTo(Math.min(Math.max(l.at.x, l.x), l.x + l.w), Math.min(Math.max(l.at.y, l.y), l.y + l.h));
      ctx.stroke();
    }
    ctx.fillStyle = l.open ? LABEL_OPEN_PLATE : LABEL_PLATE;
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.fillStyle = LABEL_COLOR;
    l.lines.forEach((text, i) => ctx.fillText(text, l.x + PAD, l.y + PAD + i * LINE_HEIGHT));
  }
  return { shown: labels.length, hidden };
}

function loop() {
  try { drawFrame(); } catch {}
  frame = requestAnimationFrame(loop);
}

// screen: draw only links with both ends inside the camera view, as it moves.
export function showLogic(linkFilter, { screen = false } = {}) {
  filter = linkFilter;
  screenOnly = screen;
  if (!frame) frame = requestAnimationFrame(loop);
}

export function hideLogic() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  filter = null;
  screenOnly = false;
  if (overlay) { overlay.remove(); overlay = null; }
}

export const logicShown = () => frame !== 0;
