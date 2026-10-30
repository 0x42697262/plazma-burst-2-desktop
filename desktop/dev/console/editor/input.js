// The editor's mouse. While the editor is shown it hears pointer presses on the document
// before the page's elements do (capture), the game canvas included, and keeps the ones it
// uses from the game: no shooting, no pointer lock. Presses on the console or on the
// editor's own panels are left to them. Pointer moves still reach the game (aiming, and
// the crosshair the labels follow), and the keyboard is the game's as always: you walk
// around while editing.
// Pointer events, not mouse events: the game's graphics library cancels pointerdown on
// its canvas, and then the browser sends no mousedown or mouseup at all.
//
// Select tool: a press selects what is under it and can drag it right away: from inside
// it moves, from an edge or a corner of a rectangle it resizes. A click on the selection
// without moving takes the one below it instead. Place tool: a click adds an element of the current layer there;
// a rectangle can be dragged out instead. Positions snap to SNAP units; with Alt held
// they do not. A drag is one step for undo.
import { isUi } from '../ui/theme.js';
import { game, GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { currentTransform, toWorld } from '../ui/overlay.js';
import { kindOf, anchorOf, SHAPE } from './kinds.js';
import { liveBounds } from './live.js';
import {
  editorDoc, pickAt, elementAt, select, selected, currentTool, currentLayer, setPreview, setPressing, TOOL,
} from './session.js';
import { setPlace, addElement } from './edit.js';
import { beginAction, endAction } from './history.js';

const SNAP = 10; // world units, like the map editor's grid
const EDGE = 3; // screen units around a rectangle's edge that resize it
const DRAG_START = 2; // screen units the mouse moves before a press becomes a drag

let listening = false;
let press = null; // { at (world), screen, target, mode, start, dragging } while pressed
// For "editor status": the last press the window saw (whatever it landed on) and the
// last one the editor handled.
const lastPress = { window: null, layer: null };
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

// An element in a few words: tag, id, class, z-index, cursor.
function describe(node) {
  if (!node || !node.tagName) return String(node);
  const css = globalThis.getComputedStyle ? getComputedStyle(node) : node.style;
  const cls = typeof node.className === 'string' && node.className ? `.${node.className.split(/\s+/).join('.')}` : '';
  return `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${cls} z-index ${css.zIndex || 'auto'}, cursor ${css.cursor || 'auto'}`;
}

// A press over the world (not on the console, a panel or outside the game) is the
// editor's: the game never sees it, nor the release that ends it.
const inGame = (p) => p.screen.x >= 0 && p.screen.x <= GAME_WIDTH && p.screen.y >= 0 && p.screen.y <= GAME_HEIGHT;
function take(e) { e.preventDefault(); e.stopImmediatePropagation(); }

function onPointerDown(e) {
  const p = e.button === 0 && !isUi(e.target) ? pointOfEvent(e) : null;
  lastPress.window = { target: describe(e.target), taken: !!(p && inGame(p)), x: Math.round(e.clientX), y: Math.round(e.clientY) };
  if (!p || !inGame(p)) return;
  take(e);
  onMouseDown(e, p);
  setPressing(!!press);
}

function onPointerUp(e) {
  if (!press) return;
  take(e);
  onMouseUp();
  setPressing(false);
}

function onMouseDown(e, p = pointOfEvent(e)) {
  if (e.button !== 0) return;
  lastPress.layer = { world: p && { x: Math.round(p.world.x), y: Math.round(p.world.y) }, picked: null };
  if (!p) return;
  if (currentTool() === TOOL.PLACE) {
    press = { at: p.world, screen: p.screen, place: currentLayer(), dragging: false, free: e.altKey };
    return;
  }
  // On the selection: grab it (inside moves, an edge resizes). Anywhere else: select
  // what is under the press at once, so it can be dragged in the same press.
  const slop = EDGE * p.perScreenUnit;
  let sel = selected();
  let b = sel && liveBounds(editorDoc(), sel);
  let mode = b ? grabOf(sel, b, p.world, slop) : null;
  let fresh = false;
  if (!mode) {
    const under = elementAt(p.world);
    if (under) {
      select(under);
      sel = under;
      b = liveBounds(editorDoc(), sel);
      mode = grabOf(sel, b, p.world, slop) || 'move';
      fresh = true;
    }
  }
  // A rectangle drags by its bounds, a point by the spot the map stores.
  const start = mode && (kindOf(sel.tag).shape === SHAPE.RECT ? b : { ...anchorOf(sel), w: b.w, h: b.h });
  press = { at: p.world, screen: p.screen, target: mode ? sel : null, mode, start, dragging: false, fresh };
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
  const { dragging, at, place, end, free, fresh, target } = press;
  press = null;
  if (place) { finishPlace(place, at, dragging ? end : null, free); return; }
  if (dragging) endAction();
  else if (fresh) {
    // This press selected it: it stays selected (the next click on the spot cycles).
    if (lastPress.layer) lastPress.layer.picked = `${target.tag} #${editorDoc().ordinal(target)}${target.attrs.uid ? ' ' + target.attrs.uid : ''}`;
  } else {
    const e = pickAt(at);
    if (lastPress.layer) lastPress.layer.picked = e ? `${e.tag} #${editorDoc().ordinal(e)}${e.attrs.uid ? ' ' + e.attrs.uid : ''}` : 'nothing';
  }
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

// The game's mouse handlers listen for these too: they are taken from them while a press
// is the editor's.
const BLOCKED_DURING_PRESS = ['mousedown', 'mouseup', 'click'];
function blockWhilePressed(e) { if (press) take(e); }

// errors: called with an Error a drag could not apply.
export function captureMouse(on, errors) {
  // document, not window: the game replaces window.addEventListener with one that
  // registers on its graphics stage (scripts/flash.js), which sends no DOM events.
  const doc = globalThis.document;
  const listen = doc && (on ? doc.addEventListener : doc.removeEventListener);
  if (on === listening || !listen) return;
  listening = on;
  if (!on) {
    if (press && press.dragging && press.target) endAction();
    press = null;
    setPressing(false);
    setPreview(null);
  } else {
    if (errors) onError = errors;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  listen.call(doc, 'pointerdown', onPointerDown, true);
  listen.call(doc, 'pointermove', onMouseMove, true);
  listen.call(doc, 'pointerup', onPointerUp, true);
  for (const type of BLOCKED_DURING_PRESS) listen.call(doc, type, blockWhilePressed, true);
}

// What "editor status" reports about the mouse.
export function inputStatus() {
  return {
    listening,
    pointerLocked: !!globalThis.document?.pointerLockElement,
    lastPress,
  };
}

// For tests: the same steps a real press, move and release take.
export const mouse = { down: onMouseDown, move: onMouseMove, up: onMouseUp };
