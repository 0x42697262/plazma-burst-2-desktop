// The level's drawn layers: backgrounds and the trims along walls (panel tops, grass,
// shading) are not objects of their own. The map loader draws them once into shared
// sprites of the 3D layers (frame2.js), and the game's Graphics keeps every call as an
// operation it replays each frame: ['beginBitmapFill', [bitmap, matrix, ...]],
// ['moveTo', [x, y]], ['lineTo', [x, y]], ['endFill', []] (scripts/flash.js). Moving one
// means rewriting its operations where they are.
import { game } from './bindings.js';

// Every Graphics in the 3D layers that has operations.
function drawnGraphics() {
  const out = [];
  for (const layer of [game.wallLayer(), game.frontLayer()]) {
    for (const child of layer?.children || []) {
      const g = child && child.graphics;
      if (g && Array.isArray(g.draw_operations) && g.draw_operations.length) out.push(g);
    }
  }
  return out;
}

const isPoint = (op, x, y) => op && (op[0] === 'moveTo' || op[0] === 'lineTo') && op[1][0] === x && op[1][1] === y;

// The game redraws a cached Graphics only when told; its bounds decide what is drawn.
function touched(g, points) {
  for (const [x, y] of points) {
    g.bounds.x1 = Math.min(g.bounds.x1, x);
    g.bounds.y1 = Math.min(g.bounds.y1, y);
    g.bounds.x2 = Math.max(g.bounds.x2, x);
    g.bounds.y2 = Math.max(g.bounds.y2, y);
  }
  if (typeof g.ScheduleBitmapUpdate === 'function') g.ScheduleBitmapUpdate();
}

// ----- a filled rectangle: a background -----

// The rectangle the loader drew for a background: moveTo(x, y), then lineTo to the other
// three corners, in that order. null when no layer has it.
export function findRect(r) {
  for (const g of drawnGraphics()) {
    const ops = g.draw_operations;
    for (let k = 0; k + 3 < ops.length; k++) {
      if (isPoint(ops[k], r.x, r.y) && isPoint(ops[k + 1], r.x + r.w, r.y)
        && isPoint(ops[k + 2], r.x + r.w, r.y + r.h) && isPoint(ops[k + 3], r.x, r.y + r.h)) return { g, k };
    }
  }
  return null;
}

export function moveRect({ g, k }, r) {
  const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  corners.forEach((p, n) => { g.draw_operations[k + n][1] = [...p, ...g.draw_operations[k + n][1].slice(2)]; });
  touched(g, corners);
}

// ----- the trims of a wall -----

// The loader draws trims as fills that start with beginBitmapFill: its matrix places the
// texture, and the points that follow draw the piece.
function fillGroups(g) {
  const groups = [];
  let cur = null;
  for (const op of g.draw_operations) {
    if (op[0] === 'beginBitmapFill') { cur = { matrix: op[1][1], points: [] }; groups.push(cur); continue; }
    if (cur && (op[0] === 'moveTo' || op[0] === 'lineTo')) cur.points.push(op);
    if (op[0] === 'endFill') cur = null;
  }
  return groups.filter((gr) => gr.points.length);
}

// Where the loader puts a wall's trims (frame2.js, the wall passes): from its left edge
// to 16 past its right (grass ends), and up to 23 above its top. Which edge a trim
// belongs to is in its texture's anchor, exactly: the top passes anchor at y, y - 23 or
// y - 6, the bottom pass at y + h - 16. That keeps the bottom trims of a wall standing on
// this one out of this one's top.
const TOP_ANCHORS = Object.freeze([0, -23, -6]);
const BOTTOM_ANCHOR = -16;
const ABOVE = 23, RIGHT_PAST = 16, SLACK = 1;
const across = (gr, r) => gr.points.every(([, [x, y]]) => x >= r.x - SLACK && x <= r.x + r.w + RIGHT_PAST + SLACK
  && y >= r.y - ABOVE - SLACK && y <= r.y + r.h + SLACK);

// The trims of a wall at rectangle r: [{ g, group, edge: 'top' | 'bottom' }].
export function trimsOf(r) {
  const out = [];
  for (const g of drawnGraphics()) {
    for (const group of fillGroups(g)) {
      const ty = group.matrix && group.matrix.ty;
      if (typeof ty !== 'number' || !across(group, r)) continue;
      if (TOP_ANCHORS.some((d) => ty === r.y + d)) out.push({ g, group, edge: 'top' });
      else if (ty === r.y + r.h + BOTTOM_ANCHOR) out.push({ g, group, edge: 'bottom' });
    }
  }
  return out;
}

// Moves trims from rectangle `from` to `to`: across, they stretch with the wall's width;
// up and down, top trims follow the top edge and bottom trims the bottom edge.
export function moveTrims(trims, from, to) {
  const sx = from.w ? to.w / from.w : 1;
  const mapX = (x) => to.x + (x - from.x) * sx;
  const byGraphics = new Map();
  for (const { g, group, edge } of trims) {
    const dy = edge === 'top' ? to.y - from.y : (to.y + to.h) - (from.y + from.h);
    for (const op of group.points) op[1] = [mapX(op[1][0]), op[1][1] + dy, ...op[1].slice(2)];
    if (group.matrix) {
      if (group.matrix.tx) group.matrix.tx = mapX(group.matrix.tx);
      group.matrix.ty += dy;
    }
    if (!byGraphics.has(g)) byGraphics.set(g, []);
    byGraphics.get(g).push(...group.points.map((op) => op[1]));
  }
  for (const [g, points] of byGraphics) touched(g, points);
}
