import { GRID_MARGIN, TEXTURE_SCALE } from './constants.ts';
import { TEXT } from './text.ts';
import { game } from './bindings.ts';
import { trimsOf, moveTrims } from './layers.ts';
import type { DisplayObject, Rectangle, WallGrid } from './types.ts';

type Cells = { c0: number; c1: number; r0: number; r1: number };

function cellsOf(grid: WallGrid, rectangle: Rectangle): Cells {
  return {
    c0: Math.floor((rectangle.x - GRID_MARGIN - grid.minX) / grid.cell),
    c1: Math.ceil((rectangle.x + rectangle.w + GRID_MARGIN - grid.minX) / grid.cell),
    r0: Math.floor((rectangle.y - GRID_MARGIN - grid.minY) / grid.cell),
    r1: Math.ceil((rectangle.y + rectangle.h + GRID_MARGIN - grid.minY) / grid.cell),
  };
}

export function fitsGrid(rectangle: Rectangle): boolean {
  const grid = game.wallGrid();
  const cells = cellsOf(grid, rectangle);
  return cells.c0 >= 0 && cells.r0 >= 0 && cells.c1 < grid.cols && cells.r1 < grid.rows;
}

function forCells(grid: WallGrid, rectangle: Rectangle, visit: (list: number[]) => void): void {
  const cells = cellsOf(grid, rectangle);
  for (let column = Math.max(0, cells.c0); column <= Math.min(grid.cols - 1, cells.c1); column++) {
    for (let row = Math.max(0, cells.r0); row <= Math.min(grid.rows - 1, cells.r1); row++) {
      const list = grid.cells[column]?.[row];
      if (list) visit(list);
    }
  }
}

const removeFromList = (index: number) => (list: number[]): void => {
  for (let at = list.indexOf(index); at !== -1; at = list.indexOf(index)) list.splice(at, 1);
};

const placedAs = (rectangle: Rectangle): Pick<DisplayObject, 'x' | 'y' | 'scaleX' | 'scaleY'> => ({
  x: rectangle.x, y: rectangle.y, scaleX: rectangle.w / TEXTURE_SCALE, scaleY: rectangle.h / TEXTURE_SCALE,
});

export function textureAt(rectangle: Rectangle): DisplayObject | null {
  const layer = game.wallLayer();
  const Texture = game.wallTexture();
  if (!layer || !Texture) return null;
  const placed = placedAs(rectangle);
  return (layer.children ?? []).find((child) => child instanceof Texture
    && child.x === placed.x && child.y === placed.y && child.scaleX === placed.scaleX && child.scaleY === placed.scaleY) ?? null;
}

const wallAt = (index: number): Rectangle => {
  const walls = game.walls();
  return { x: walls.x[index] ?? 0, y: walls.y[index] ?? 0, w: walls.w[index] ?? 0, h: walls.h[index] ?? 0 };
};

export function moveWall(index: number, to: Rectangle): void {
  const walls = game.walls();
  if (!(index >= 0 && index < walls.count)) throw new Error(TEXT.noWall(index));
  if (!fitsGrid(to)) throw new Error(TEXT.outsideGrid);
  const from = wallAt(index);
  const body = textureAt(from);
  const trims = trimsOf(from);
  forCells(game.wallGrid(), from, removeFromList(index));
  walls.x[index] = to.x;
  walls.y[index] = to.y;
  walls.w[index] = to.w;
  walls.h[index] = to.h;
  game.addWallToGrid(index);
  if (body) Object.assign(body, placedAs(to));
  moveTrims(trims, from, to);
}

export function addWall(rectangle: Rectangle, material: unknown): number {
  const walls = game.walls();
  if (!fitsGrid(rectangle)) throw new Error(TEXT.outsideGrid);
  const index = walls.count;
  walls.x[index] = rectangle.x;
  walls.y[index] = rectangle.y;
  walls.w[index] = rectangle.w;
  walls.h[index] = rectangle.h;
  const materials = game.wallMaterials();
  if (materials) materials[index] = material;
  game.setWallCount(index + 1);
  game.addWallToGrid(index);
  const layer = game.wallLayer();
  const Texture = game.wallTexture();
  if (layer && Texture) {
    const body = layer.addChildAt(new Texture(), layer.numChildren);
    game.initDisplay(body);
    Object.assign(body, placedAs(rectangle));
  }
  return index;
}

export function removeWall(index: number): void {
  const walls = game.walls();
  const from = wallAt(index);
  const body = textureAt(from);
  const trims = trimsOf(from);
  forCells(game.wallGrid(), from, removeFromList(index));
  walls.w[index] = 0;
  walls.h[index] = 0;
  body?.parent?.removeChild?.(body);
  moveTrims(trims, from, { x: from.x, y: from.y, w: 0, h: 0 });
}
