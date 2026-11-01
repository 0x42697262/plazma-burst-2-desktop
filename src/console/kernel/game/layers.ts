import { BOTTOM_ANCHOR, COORDINATE_COUNT, CORNER, TOP_ANCHORS, TRIM_ABOVE, TRIM_RIGHT_PAST, TRIM_SLACK } from './constants.ts';
import { DRAW_OPERATION, TRIM_EDGE, type TrimEdge } from './keys.ts';
import { game } from './bindings.ts';
import type { DrawOperation, DrawnGraphics, Rectangle } from './types.ts';

type Point = [number, number];
type Matrix = { tx?: number; ty: number };
type FillGroup = { matrix: Matrix | undefined; points: DrawOperation[] };
export type Trim = { g: DrawnGraphics; group: FillGroup; edge: TrimEdge };
export type RectangleAt = { g: DrawnGraphics; k: number };

function drawnGraphics(): DrawnGraphics[] {
  const found: DrawnGraphics[] = [];
  for (const layer of [game.wallLayer(), game.frontLayer()]) {
    for (const child of layer?.children ?? []) {
      const graphics = child?.graphics;
      if (graphics && Array.isArray(graphics.draw_operations) && graphics.draw_operations.length) found.push(graphics);
    }
  }
  return found;
}

const coordinates = (operation: DrawOperation): Point => [operation[1][0] as number, operation[1][1] as number];
const isLine = (operation: DrawOperation | undefined): operation is DrawOperation => !!operation
  && (operation[0] === DRAW_OPERATION.moveTo || operation[0] === DRAW_OPERATION.lineTo);
const isPoint = (operation: DrawOperation | undefined, atX: number, atY: number): boolean => isLine(operation)
  && operation[1][0] === atX && operation[1][1] === atY;

function touched(graphics: DrawnGraphics, points: readonly Point[]): void {
  for (const [pointX, pointY] of points) {
    graphics.bounds.x1 = Math.min(graphics.bounds.x1, pointX);
    graphics.bounds.y1 = Math.min(graphics.bounds.y1, pointY);
    graphics.bounds.x2 = Math.max(graphics.bounds.x2, pointX);
    graphics.bounds.y2 = Math.max(graphics.bounds.y2, pointY);
  }
  if (typeof graphics.ScheduleBitmapUpdate === 'function') graphics.ScheduleBitmapUpdate();
}

export function findRect(rectangle: Rectangle): RectangleAt | null {
  const { x: left, y: top, w: width, h: height } = rectangle;
  for (const graphics of drawnGraphics()) {
    const operations = graphics.draw_operations;
    for (let start = 0; start + CORNER.bottomLeft < operations.length; start++) {
      const isRectangle = isPoint(operations[start + CORNER.topLeft], left, top) && isPoint(operations[start + CORNER.topRight], left + width, top)
        && isPoint(operations[start + CORNER.bottomRight], left + width, top + height) && isPoint(operations[start + CORNER.bottomLeft], left, top + height);
      if (isRectangle) return { g: graphics, k: start };
    }
  }
  return null;
}

export function moveRect({ g: graphics, k: start }: RectangleAt, rectangle: Rectangle): void {
  const { x: left, y: top, w: width, h: height } = rectangle;
  const corners: Point[] = [[left, top], [left + width, top], [left + width, top + height], [left, top + height]];
  corners.forEach((corner, offset) => {
    const operation = graphics.draw_operations[start + offset];
    if (operation) operation[1] = [...corner, ...operation[1].slice(COORDINATE_COUNT)];
  });
  touched(graphics, corners);
}

function fillGroups(graphics: DrawnGraphics): FillGroup[] {
  const groups: FillGroup[] = [];
  let current: FillGroup | null = null;
  for (const operation of graphics.draw_operations) {
    if (operation[0] === DRAW_OPERATION.beginBitmapFill) {
      current = { matrix: operation[1][1] as Matrix | undefined, points: [] };
      groups.push(current);
      continue;
    }
    if (current && isLine(operation)) current.points.push(operation);
    if (operation[0] === DRAW_OPERATION.endFill) current = null;
  }
  return groups.filter((group) => group.points.length);
}

const isAcross = (group: FillGroup, rectangle: Rectangle): boolean => group.points.every((operation) => {
  const [pointX, pointY] = coordinates(operation);
  return pointX >= rectangle.x - TRIM_SLACK && pointX <= rectangle.x + rectangle.w + TRIM_RIGHT_PAST + TRIM_SLACK
    && pointY >= rectangle.y - TRIM_ABOVE - TRIM_SLACK && pointY <= rectangle.y + rectangle.h + TRIM_SLACK;
});

export function trimsOf(rectangle: Rectangle): Trim[] {
  const trims: Trim[] = [];
  for (const graphics of drawnGraphics()) {
    for (const group of fillGroups(graphics)) {
      const anchorY = group.matrix?.ty;
      if (typeof anchorY !== 'number' || !isAcross(group, rectangle)) continue;
      if (TOP_ANCHORS.some((offset) => anchorY === rectangle.y + offset)) trims.push({ g: graphics, group, edge: TRIM_EDGE.top });
      else if (anchorY === rectangle.y + rectangle.h + BOTTOM_ANCHOR) trims.push({ g: graphics, group, edge: TRIM_EDGE.bottom });
    }
  }
  return trims;
}

export function moveTrims(trims: readonly Trim[], from: Rectangle, to: Rectangle): void {
  const scaleX = from.w ? to.w / from.w : 1;
  const mapX = (pointX: number): number => to.x + (pointX - from.x) * scaleX;
  const byGraphics = new Map<DrawnGraphics, Point[]>();
  for (const { g: graphics, group, edge } of trims) {
    const shiftY = edge === TRIM_EDGE.top ? to.y - from.y : (to.y + to.h) - (from.y + from.h);
    for (const operation of group.points) {
      const [pointX, pointY] = coordinates(operation);
      operation[1] = [mapX(pointX), pointY + shiftY, ...operation[1].slice(COORDINATE_COUNT)];
    }
    if (group.matrix) {
      if (group.matrix.tx) group.matrix.tx = mapX(group.matrix.tx);
      group.matrix.ty += shiftY;
    }
    const points = byGraphics.get(graphics) ?? [];
    points.push(...group.points.map(coordinates));
    byGraphics.set(graphics, points);
  }
  for (const [graphics, points] of byGraphics) touched(graphics, points);
}
