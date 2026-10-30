// The editor's mouse: a see-through layer over the whole game that takes the clicks, so
// the game never shoots or locks the pointer while you edit. Pointer moves still reach
// the game (aiming, and the crosshair the labels follow), and the keyboard is the
// game's as always: you walk around while editing.
//
// Select tool: a click selects (again on the same spot: the one below). Pressing on the
// selection and moving drags it: from inside it moves, from an edge or a corner of a
// rectangle it resizes. Place tool: a click adds an element of the current layer there;
// a rectangle can be dragged out instead. Positions snap to SNAP units; with Alt held
// they do not. A drag is one step for undo.
import { el } from '../ui/dom.js';
import { swallow } from '../ui/theme.js';
import { game, GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { currentTransform, toWorld } from '../ui/overlay.js';
import { kindOf, anchorOf, SHAPE } from './kinds.js';
import { liveBounds } from './live.js';
import {
  editorDoc, pickAt, selected, currentTool, currentLayer, setPreview, TOOL,
} from './session.js';
import { setPlace, addElement } from './edit.js';
import { beginAction, endAction } from './history.js';

const Z_INDEX = '40'; // under the editor panels (45) and the console (50)
const SNAP = 10; // world units, like the map editor's grid
const EDGE = 3; // screen units around a rectangle's edge that resize it
const DRAG_START = 2; // screen units the mouse moves before a press becomes a drag

let layer = null;
let press = null; // { at (world), screen, target, mode, start, dragging }
let onError = () => {};

// A mouse event's point on screen (game units) and in the world, or null without a
// level on screen.
function pointOfEvent(e) {
  const m = currentTransform();
  const canvas = game.gameCanvas();
  if (!m || !canvas) return null;
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const screen = { x: (e.clientX - r.left) / r.width * GAME_WIDTH, y: (e.clientY - r.top) / r.height * GAME_HEIGHT };
  return { screen, world: toWorld(m, screen), perScreenUnit: m.unit / Math.abs(m.a) };
}
export const worldOfEvent = (e) => pointOfEvent(e)?.world ?? null;

// Which part of the selection a press is on: 'move', an edge set like 'lt' (left, top)
// for a rectangle's edge or corner, or null when it is not on it.
export function grabOf(e, b, p, slop) {
  if (p.x < b.x - slop || p.x > b.x + b.w + slop || p.y < b.y - slop || p.y > b.y + b.h + slop) return null;
  if (kindOf(e.tag)?.shape !== SHAPE.RECT) return 'move';
  let edges = '';
  if (p.x <= b.x + slop) edges += 'l'; else if (p.x >= b.x + b.w - slop) edges += 'r';
  if (p.y <= b.y + slop) edges += 't'; else if (p.y >= b.y + b.h - slop) edges += 'b';
  return edges || 'move';
}

const snap = (v, free) => (free ? v : Math.round(v / SNAP) * SNAP);

// The new place of the dragged element, from where the press started and the mouse now.
export function dragPlace(start, mode, dx, dy, free) {
  if (mode === 'move') return { ...start, x: snap(start.x + dx, free), y: snap(start.y + dy, free) };
  let { x, y, w, h } = start;
  let right = x + w;
  let bottom = y + h;
  if (mode.includes('l')) x = snap(x + dx, free);
  if (mode.includes('r')) right = snap(right + dx, free);
  if (mode.includes('t')) y = snap(y + dy, free);
  if (mode.includes('b')) bottom = snap(bottom + dy, free);
  return { x: Math.min(x, right), y: Math.min(y, bottom), w: Math.abs(right - x), h: Math.abs(bottom - y) };
}

// The rectangle between two points, both snapped.
function spanOf(a, b, free) {
  const x1 = snap(a.x, free), y1 = snap(a.y, free), x2 = snap(b.x, free), y2 = snap(b.y, free);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  const p = pointOfEvent(e);
  if (!p) return;
  if (currentTool() === TOOL.PLACE) {
    press = { at: p.world, screen: p.screen, place: currentLayer(), dragging: false, free: e.altKey };
    return;
  }
  const sel = selected();
  const b = sel && liveBounds(editorDoc(), sel);
  const mode = b ? grabOf(sel, b, p.world, EDGE * p.perScreenUnit) : null;
  // A rectangle drags by its bounds, a point by the spot the map stores.
  const start = mode && (kindOf(sel.tag).shape === SHAPE.RECT ? b : { ...anchorOf(sel), w: b.w, h: b.h });
  press = { at: p.world, screen: p.screen, target: mode ? sel : null, mode, start, dragging: false };
}

function onMouseMove(e) {
  if (!press || !(press.target || press.place)) return;
  const p = pointOfEvent(e);
  if (!p) return;
  if (!press.dragging && Math.hypot(p.screen.x - press.screen.x, p.screen.y - press.screen.y) < DRAG_START) return;
  if (press.place) {
    press.dragging = kindOf(press.place)?.shape === SHAPE.RECT;
    press.free = e.altKey;
    press.end = p.world;
    if (press.dragging) setPreview({ tag: press.place, ...spanOf(press.at, press.end, press.free) });
    return;
  }
  if (!press.dragging) beginAction();
  press.dragging = true;
  const place = dragPlace(press.start, press.mode, p.world.x - press.at.x, p.world.y - press.at.y, e.altKey);
  try { setPlace(press.target, place); } catch (err) { onError(err); press = null; endAction(); }
}

function onMouseUp() {
  if (!press) return;
  const { dragging, at, place, end, free } = press;
  press = null;
  if (place) { finishPlace(place, at, dragging ? end : null, free); return; }
  if (dragging) endAction();
  else pickAt(at);
}

// A click places a point, or a rectangle of the default size with its corner there; a
// drag places the rectangle dragged out (at least one snap step each way).
function finishPlace(tag, at, end, free) {
  setPreview(null);
  try {
    if (!end) { addElement(tag, { x: snap(at.x, free), y: snap(at.y, free) }); return; }
    const r = spanOf(at, end, free);
    addElement(tag, { ...r, w: Math.max(r.w, free ? 1 : SNAP), h: Math.max(r.h, free ? 1 : SNAP) });
  } catch (err) { onError(err); }
}

// errors: called with an Error a drag could not apply.
export function captureMouse(on, errors) {
  if (!on) {
    if (layer) layer.remove();
    layer = null;
    if (press && press.dragging && press.target) endAction();
    press = null;
    setPreview(null);
    globalThis.removeEventListener?.('mouseup', onMouseUp);
    return;
  }
  if (layer) return;
  if (errors) onError = errors;
  if (document.pointerLockElement) document.exitPointerLock();
  layer = el('div', {
    position: 'absolute', left: '0', top: '0', width: `${GAME_WIDTH}px`, height: `${GAME_HEIGHT}px`,
    zIndex: Z_INDEX, cursor: 'crosshair', pointerEvents: 'auto', background: 'transparent',
  });
  swallow(layer);
  layer.addEventListener('mousedown', onMouseDown);
  layer.addEventListener('pointermove', onMouseMove);
  // Let go outside the layer (over a panel, outside the window): the drag still ends.
  globalThis.addEventListener?.('mouseup', onMouseUp);
  game.overlay().append(layer);
}

// For tests: the same steps a real press, move and release take.
export const mouse = { down: onMouseDown, move: onMouseMove, up: onMouseUp };
