import { AXES } from '../keys.ts';

export type Point = { x: number; y: number };
export type Bounds = { width: number; height: number; edge: number };

export function clampToScreen(origin: Point, target: Point, bounds: Bounds): Point {
  const min: Point = { x: bounds.edge, y: bounds.edge };
  const max: Point = { x: bounds.width - bounds.edge, y: bounds.height - bounds.edge };
  let fraction = 1;
  for (const axis of AXES) {
    const delta = target[axis] - origin[axis];
    if (target[axis] < min[axis] && delta) fraction = Math.min(fraction, (min[axis] - origin[axis]) / delta);
    if (target[axis] > max[axis] && delta) fraction = Math.min(fraction, (max[axis] - origin[axis]) / delta);
  }
  fraction = Math.max(0, fraction);
  const along = (axis: 'x' | 'y'): number => Math.min(Math.max(origin[axis] + fraction * (target[axis] - origin[axis]), min[axis]), max[axis]);
  return { x: along('x'), y: along('y') };
}
