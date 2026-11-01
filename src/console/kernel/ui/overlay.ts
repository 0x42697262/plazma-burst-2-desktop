import { game, GAME_WIDTH, GAME_HEIGHT, type CameraView } from '../game/bindings.ts';
import { isActive, player } from '../game/level.ts';
import { OVERLAY_MARGIN } from './constants.ts';
import { CANVAS_ELEMENT, CONTEXT_2D, DEFAULT_OVERLAY_Z_INDEX, OVERLAY_ID, OVERLAY_STYLE, PIXELS } from './keys.ts';

export type Transform = { unit: number; a: number; d: number; e: number; f: number };
type Point = { x: number; y: number };
export type LayerDraw = (context: CanvasRenderingContext2D, transform: Transform) => unknown;

const layers = new Map<string, LayerDraw>();
let canvasElement: HTMLCanvasElement | null = null;
let frame = 0;

function worldTransform(canvas: HTMLCanvasElement, camera: CameraView): Transform {
  const unit = canvas.width / GAME_WIDTH;
  return {
    unit,
    a: unit * camera.parentScaleX * camera.scaleX,
    d: unit * camera.parentScaleY * camera.scaleY,
    e: unit * (camera.parentX + camera.parentScaleX * camera.x),
    f: unit * (camera.parentY + camera.parentScaleY * camera.y),
  };
}

export const toScreen = (transform: Transform, point: Point): Point => ({ x: (transform.a * point.x + transform.e) / transform.unit, y: (transform.d * point.y + transform.f) / transform.unit });
export const toWorld = (transform: Transform, point: Point): Point => ({ x: (point.x * transform.unit - transform.e) / transform.a, y: (point.y * transform.unit - transform.f) / transform.d });

export function crosshair(transform: Transform): Point | null {
  const current = player();
  const aimX = current?.tarx;
  const aimY = current?.tary;
  return typeof aimX === 'number' && typeof aimY === 'number' && Number.isFinite(aimX) && Number.isFinite(aimY) ? toScreen(transform, { x: aimX, y: aimY }) : null;
}

export const onScreen = (point: Point): boolean => point.x > -OVERLAY_MARGIN && point.x < GAME_WIDTH + OVERLAY_MARGIN && point.y > -OVERLAY_MARGIN && point.y < GAME_HEIGHT + OVERLAY_MARGIN;

const gameCanvas = (): HTMLCanvasElement | null => game.gameCanvas() as HTMLCanvasElement | null;

export function currentTransform(): Transform | null {
  const canvas = gameCanvas();
  const camera = game.camera();
  return canvas && camera && isActive() ? worldTransform(canvas, camera) : null;
}

function fit(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  if (!canvasElement) {
    canvasElement = document.createElement(CANVAS_ELEMENT);
    canvasElement.id = OVERLAY_ID;
    Object.assign(canvasElement.style, { ...OVERLAY_STYLE, zIndex: canvas.style.zIndex || DEFAULT_OVERLAY_Z_INDEX });
    canvas.after(canvasElement);
  }
  if (canvasElement.width !== canvas.width) canvasElement.width = canvas.width;
  if (canvasElement.height !== canvas.height) canvasElement.height = canvas.height;
  const box = canvas.getBoundingClientRect();
  Object.assign(canvasElement.style, { left: PIXELS(box.left), top: PIXELS(box.top), width: PIXELS(box.width), height: PIXELS(box.height) });
  return canvasElement.getContext(CONTEXT_2D) as CanvasRenderingContext2D;
}

export function drawOverlay(): Record<string, unknown> | null {
  const transform = currentTransform();
  const canvas = gameCanvas();
  if (!transform || !canvas) {
    if (canvasElement) canvasElement.getContext(CONTEXT_2D)?.clearRect(0, 0, canvasElement.width, canvasElement.height);
    return null;
  }
  const context = fit(canvas);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  const drawn: Record<string, unknown> = {};
  for (const [name, draw] of layers) {
    context.save();
    context.setTransform(transform.unit, 0, 0, transform.unit, 0, 0);
    try {
      drawn[name] = draw(context, transform);
    } finally {
      context.restore();
    }
  }
  return drawn;
}

function drawQuietly(): void {
  try {
    drawOverlay();
  } catch {
    return;
  }
}

function loop(): void {
  drawQuietly();
  frame = requestAnimationFrame(loop);
}

export function setLayer(name: string, draw: LayerDraw | null): void {
  if (draw) layers.set(name, draw);
  else layers.delete(name);
  if (layers.size && !frame) frame = requestAnimationFrame(loop);
  if (!layers.size) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (canvasElement) {
      canvasElement.remove();
      canvasElement = null;
    }
  }
}

export const hasLayer = (name: string): boolean => layers.has(name);
