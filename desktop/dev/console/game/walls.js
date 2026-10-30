// Moving a wall in the running level, the way the map loader places one (frame2.js):
// its x, y, w, h arrays, the collision grid cells it is listed in, its body sprite, and
// the trims along its edges (layers.js). Trims stretch with the wall; the loader would
// have cut them around other walls the new place now touches.
// The wall arrays are snapshotted by the game's integrity check: writing them makes the
// game report the client and reload the page. Nothing here hides that.
import { game } from './bindings.js';
import { trimsOf, moveTrims } from './layers.js';

const GRID_MARGIN = 100; // the loader lists a wall in every cell this close to it

// The grid cells a rectangle is listed in, as the loader's grid function computes them.
function cellsOf(grid, r) {
  return {
    c0: Math.floor((r.x - GRID_MARGIN - grid.minX) / grid.cell),
    c1: Math.ceil((r.x + r.w + GRID_MARGIN - grid.minX) / grid.cell),
    r0: Math.floor((r.y - GRID_MARGIN - grid.minY) / grid.cell),
    r1: Math.ceil((r.y + r.h + GRID_MARGIN - grid.minY) / grid.cell),
  };
}

// The level's grid is sized for the map as it loaded: a wall cannot go outside it.
export function fitsGrid(r) {
  const grid = game.wallGrid();
  const c = cellsOf(grid, r);
  return c.c0 >= 0 && c.r0 >= 0 && c.c1 < grid.cols && c.r1 < grid.rows;
}

function forCells(grid, r, fn) {
  const c = cellsOf(grid, r);
  for (let col = Math.max(0, c.c0); col <= Math.min(grid.cols - 1, c.c1); col++) {
    for (let row = Math.max(0, c.r0); row <= Math.min(grid.rows - 1, c.r1); row++) fn(grid.cells[col][row]);
  }
}

// The texture in the 3D layer drawn at a place and size: a wall's body, or a visible
// movable's (frame2.js adds one texture_front0 for each).
export function textureAt(r) {
  const layer = game.wallLayer();
  const Texture = game.wallTexture();
  if (!layer || !Texture) return null;
  return (layer.children || []).find((c) => c instanceof Texture
    && c.x === r.x && c.y === r.y && c.scaleX === r.w / 100 && c.scaleY === r.h / 100) || null;
}

export function moveWall(i, to) {
  const walls = game.walls();
  if (!(i >= 0 && i < walls.count)) throw new Error(`no wall #${i} in the running level`);
  if (!fitsGrid(to)) throw new Error('that is outside the area the level\'s walls were built for');
  const from = { x: walls.x[i], y: walls.y[i], w: walls.w[i], h: walls.h[i] };
  const body = textureAt(from);
  const trims = trimsOf(from);
  const grid = game.wallGrid();
  forCells(grid, from, (list) => { for (let k = list.indexOf(i); k !== -1; k = list.indexOf(i)) list.splice(k, 1); });
  walls.x[i] = to.x;
  walls.y[i] = to.y;
  walls.w[i] = to.w;
  walls.h[i] = to.h;
  game.addWallToGrid(i);
  if (body) Object.assign(body, { x: to.x, y: to.y, scaleX: to.w / 100, scaleY: to.h / 100 });
  moveTrims(trims, from, to);
}

// A new wall at the end of the level's walls, as the loader would have made it: its
// arrays, its grid cells (the game's own function) and its body. It has no trims: the
// loader draws those for the whole level at once. Returns its index.
export function addWall(r, material) {
  const walls = game.walls();
  if (!fitsGrid(r)) throw new Error('that is outside the area the level\'s walls were built for');
  const i = walls.count;
  walls.x[i] = r.x; walls.y[i] = r.y; walls.w[i] = r.w; walls.h[i] = r.h;
  const m = game.wallMaterials();
  if (m) m[i] = material;
  game.setWallCount(i + 1);
  game.addWallToGrid(i);
  const layer = game.wallLayer();
  const Texture = game.wallTexture();
  if (layer && Texture) {
    const body = layer.addChildAt(new Texture(), layer.numChildren);
    game.initDisplay(body);
    Object.assign(body, { x: r.x, y: r.y, scaleX: r.w / 100, scaleY: r.h / 100 });
  }
  return i;
}

// Takes wall i out of play without moving the others: out of its grid cells, no size,
// its body off the screen, its trims squeezed to nothing.
export function removeWall(i) {
  const walls = game.walls();
  const from = { x: walls.x[i], y: walls.y[i], w: walls.w[i], h: walls.h[i] };
  const body = textureAt(from);
  const trims = trimsOf(from);
  forCells(game.wallGrid(), from, (list) => { for (let k = list.indexOf(i); k !== -1; k = list.indexOf(i)) list.splice(k, 1); });
  walls.w[i] = 0; walls.h[i] = 0;
  if (body && body.parent && body.parent.removeChild) body.parent.removeChild(body);
  moveTrims(trims, from, { x: from.x, y: from.y, w: 0, h: 0 });
}
