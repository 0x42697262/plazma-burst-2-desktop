// The editor's mouse: a see-through layer over the whole game that takes the clicks, so
// the game never shoots or locks the pointer while you edit. Pointer moves still reach
// the game (aiming, and the crosshair the labels follow), and the keyboard is the
// game's as always: you walk around while editing.
import { el } from '../ui/dom.js';
import { swallow } from '../ui/theme.js';
import { game, GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { currentTransform, toWorld } from '../ui/overlay.js';
import { pickAt } from './session.js';

const Z_INDEX = '40'; // under the editor panels (45) and the console (50)

let layer = null;

// A mouse event's world point, or null without a level on screen.
export function worldOfEvent(e) {
  const m = currentTransform();
  const canvas = game.gameCanvas();
  if (!m || !canvas) return null;
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const screen = { x: (e.clientX - r.left) / r.width * GAME_WIDTH, y: (e.clientY - r.top) / r.height * GAME_HEIGHT };
  return toWorld(m, screen);
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  const p = worldOfEvent(e);
  if (p) pickAt(p);
}

export function captureMouse(on) {
  if (!on) {
    if (layer) layer.remove();
    layer = null;
    return;
  }
  if (layer) return;
  if (document.pointerLockElement) document.exitPointerLock();
  layer = el('div', {
    position: 'absolute', left: '0', top: '0', width: `${GAME_WIDTH}px`, height: `${GAME_HEIGHT}px`,
    zIndex: Z_INDEX, cursor: 'crosshair', pointerEvents: 'auto', background: 'transparent',
  });
  swallow(layer);
  layer.addEventListener('mousedown', onMouseDown);
  game.overlay().append(layer);
}
