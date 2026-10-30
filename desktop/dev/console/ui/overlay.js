// One canvas laid over the game's, redrawn every animation frame while any layer is on.
// Features add a layer (the logic view, player traces) instead of a canvas of their own.
// Like the game's own debug view ("debug 1"), but nothing of the game is changed: the
// debug view's switch is an anti-cheat guarded value, this only reads the camera.
import { game, GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { isActive, player } from '../game/level.js';

const MARGIN = 40; // game units past the screen edge that still count as on screen

const layers = new Map(); // name -> draw(ctx, m): drawn in this order, returns a summary
let canvasEl = null;
let frame = 0; // the pending animation frame

// The transform from world units to overlay pixels, as the game's debug view sets it
// (scripts/main.js): canvas pixels per game unit, then the camera.
function worldTransform(canvas, cam) {
  const unit = canvas.width / GAME_WIDTH;
  return {
    unit,
    a: unit * cam.parentScaleX * cam.scaleX, d: unit * cam.parentScaleY * cam.scaleY,
    e: unit * (cam.parentX + cam.parentScaleX * cam.x),
    f: unit * (cam.parentY + cam.parentScaleY * cam.y),
  };
}

// A world point in screen game units (0..GAME_WIDTH, 0..GAME_HEIGHT).
export const toScreen = (m, p) => ({ x: (m.a * p.x + m.e) / m.unit, y: (m.d * p.y + m.f) / m.unit });

// The other way: a point in screen game units back to the world.
export const toWorld = (m, p) => ({ x: (p.x * m.unit - m.e) / m.a, y: (p.y * m.unit - m.f) / m.d });

// The crosshair in screen units: it follows the mouse in world units (also with the
// pointer locked). null when it cannot be read.
export function crosshair(m) {
  const p = player();
  return p && Number.isFinite(p.tarx) && Number.isFinite(p.tary) ? toScreen(m, { x: p.tarx, y: p.tary }) : null;
}

export const onScreen = (p) => p.x > -MARGIN && p.x < GAME_WIDTH + MARGIN && p.y > -MARGIN && p.y < GAME_HEIGHT + MARGIN;

// The world-to-screen transform now, or null without a level, canvas or camera.
export function currentTransform() {
  const canvas = game.gameCanvas();
  const cam = game.camera();
  return canvas && cam && isActive() ? worldTransform(canvas, cam) : null;
}

// Keeps the overlay exactly over the game canvas, whatever size the window is.
function fit(canvas) {
  if (!canvasEl) {
    canvasEl = document.createElement('canvas');
    canvasEl.id = 'pb2dev-overlay';
    Object.assign(canvasEl.style, { position: 'fixed', pointerEvents: 'none', zIndex: canvas.style.zIndex || '2' });
    canvas.after(canvasEl);
  }
  if (canvasEl.width !== canvas.width) canvasEl.width = canvas.width;
  if (canvasEl.height !== canvas.height) canvasEl.height = canvas.height;
  const r = canvas.getBoundingClientRect();
  Object.assign(canvasEl.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  return canvasEl.getContext('2d');
}

// Draws every layer once. Each draws in screen game units (the unit scale only), so lines
// and text stay thin and tiny at any zoom; positions go through toScreen first. Returns
// { layer name: what it drew }, or null when there is nothing to draw on.
export function drawOverlay() {
  const m = currentTransform();
  if (!m) {
    if (canvasEl) canvasEl.getContext('2d').clearRect(0, 0, canvasEl.width, canvasEl.height);
    return null;
  }
  const ctx = fit(game.gameCanvas());
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  const out = {};
  for (const [name, draw] of layers) {
    ctx.save();
    ctx.setTransform(m.unit, 0, 0, m.unit, 0, 0);
    try { out[name] = draw(ctx, m); } finally { ctx.restore(); }
  }
  return out;
}

function loop() {
  try { drawOverlay(); } catch {}
  frame = requestAnimationFrame(loop);
}

// draw: (ctx, m) => summary, or null to remove the layer. The overlay runs while any
// layer is on, and goes away with the last one.
export function setLayer(name, draw) {
  if (draw) layers.set(name, draw);
  else layers.delete(name);
  if (layers.size && !frame) frame = requestAnimationFrame(loop);
  if (!layers.size) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (canvasEl) { canvasEl.remove(); canvasEl = null; }
  }
}

export const hasLayer = (name) => layers.has(name);
