import { isUi } from '#console/kernel/ui/theme.ts';
import { game, GAME_WIDTH, GAME_HEIGHT } from '#console/kernel/game/bindings.ts';
import { currentTransform, toWorld } from '#console/kernel/ui/overlay.ts';
import { kindOf, anchorOf, SHAPE, type Box } from '../domain/kinds.ts';
import type { MapDoc, MapElement, Spot } from '../domain/doc.ts';
import { beginAction, endAction } from '../domain/history.ts';
import { liveBounds } from '../services/live.ts';
import {
  editorDoc, pickAt, elementAt, select, selected, currentTool, currentLayer, setPreview, TOOL,
  currentPick, pickTargetAt, finishPick,
} from '../services/session.ts';
import { setPlace, addElement } from '../services/edit.ts';
import { DRAG_START, EDGE, PICK_REACH, SNAP } from './constants.ts';
import {
  AUTO, BLOCKED_DURING_PRESS, CLASS_SEPARATOR, EDGE_MARK, GRAB_MOVE, POINTER_EVENT, WHITESPACE,
} from './keys.ts';
import { INPUT_TEXT as TEXT } from './text.ts';

type ScreenPoint = { screen: Spot; world: Spot; perScreenUnit: number };
type Pointer = { button: number; clientX: number; clientY: number; altKey: boolean; target: EventTarget | null; preventDefault(): void; stopImmediatePropagation(): void };
type Press = {
  at: Spot;
  screen: Spot;
  target?: MapElement | null;
  mode?: string | null;
  start?: Box | null;
  dragging: boolean;
  fresh?: boolean;
  place?: string;
  free?: boolean;
  end?: Spot;
};
type WindowPress = { target: string; taken: boolean; x: number; y: number };
type LayerPress = { world: Spot | null; picked: string | null };
type Described = { tagName?: string; id?: string; className?: unknown; style?: { zIndex?: string; cursor?: string } };
type Canvas = { getBoundingClientRect(): DOMRect };

let listening = false;
let press: Press | null = null;
const lastPress: { window: WindowPress | null; layer: LayerPress | null } = { window: null, layer: null };
let onError: (error: Error) => void = () => undefined;

function pointOfEvent(event: Pointer): ScreenPoint | null {
  const transform = currentTransform();
  const canvas = game.gameCanvas() as Canvas | null;
  if (!transform || !canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const screen = { x: (event.clientX - rect.left) / rect.width * GAME_WIDTH, y: (event.clientY - rect.top) / rect.height * GAME_HEIGHT };
  return { screen, world: toWorld(transform, screen), perScreenUnit: transform.unit / Math.abs(transform.a) };
}
export const worldOfEvent = (event: Pointer): Spot | null => pointOfEvent(event)?.world ?? null;

export function grabOf(item: MapElement, bounds: Box, point: Spot, slop: number): string | null {
  if (point.x < bounds.x - slop || point.x > bounds.x + bounds.w + slop || point.y < bounds.y - slop || point.y > bounds.y + bounds.h + slop) return null;
  if (kindOf(item.tag)?.shape !== SHAPE.RECT) return GRAB_MOVE;
  let edges = '';
  if (point.x <= bounds.x + slop) edges += EDGE_MARK.left;
  else if (point.x >= bounds.x + bounds.w - slop) edges += EDGE_MARK.right;
  if (point.y <= bounds.y + slop) edges += EDGE_MARK.top;
  else if (point.y >= bounds.y + bounds.h - slop) edges += EDGE_MARK.bottom;
  return edges || GRAB_MOVE;
}

const snap = (value: number, free: boolean | undefined): number => (free ? value : Math.round(value / SNAP) * SNAP);

export function dragPlace(start: Box, mode: string, shiftX: number, shiftY: number, free: boolean): Box {
  if (mode === GRAB_MOVE) return { ...start, x: snap(start.x + shiftX, free), y: snap(start.y + shiftY, free) };
  let { x: left, y: top } = start;
  let right = left + start.w;
  let bottom = top + start.h;
  if (mode.includes(EDGE_MARK.left)) left = snap(left + shiftX, free);
  if (mode.includes(EDGE_MARK.right)) right = snap(right + shiftX, free);
  if (mode.includes(EDGE_MARK.top)) top = snap(top + shiftY, free);
  if (mode.includes(EDGE_MARK.bottom)) bottom = snap(bottom + shiftY, free);
  return { x: Math.min(left, right), y: Math.min(top, bottom), w: Math.abs(right - left), h: Math.abs(bottom - top) };
}

function spanOf(from: Spot, to: Spot, free: boolean | undefined): Box {
  const fromX = snap(from.x, free);
  const fromY = snap(from.y, free);
  const toX = snap(to.x, free);
  const toY = snap(to.y, free);
  return { x: Math.min(fromX, toX), y: Math.min(fromY, toY), w: Math.abs(toX - fromX), h: Math.abs(toY - fromY) };
}

function describe(target: unknown): string {
  const node = target as Described | null;
  if (!node || !node.tagName) return String(target);
  const css = typeof globalThis.getComputedStyle === 'function' ? getComputedStyle(node as Element) : node.style ?? {};
  const classes = typeof node.className === 'string' && node.className ? TEXT.classes(node.className.split(WHITESPACE).join(CLASS_SEPARATOR)) : '';
  return TEXT.element(node.tagName.toLowerCase(), node.id ? TEXT.id(node.id) : '', classes, css.zIndex || AUTO, css.cursor || AUTO);
}

const inGame = (point: ScreenPoint): boolean => point.screen.x >= 0 && point.screen.x <= GAME_WIDTH && point.screen.y >= 0 && point.screen.y <= GAME_HEIGHT;
function take(event: Pointer | Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

const roundedWorld = (point: ScreenPoint): Spot => ({ x: Math.round(point.world.x), y: Math.round(point.world.y) });
const pickedName = (doc: MapDoc, item: MapElement): string => TEXT.picked(item.tag, doc.ordinal(item), item.attrs.uid);

function onMouseDown(event: Pointer, point: ScreenPoint | null = pointOfEvent(event)): void {
  if (event.button !== 0) return;
  lastPress.layer = { world: point && roundedWorld(point), picked: null };
  if (!point) return;
  if (currentTool() === TOOL.PLACE) {
    press = { at: point.world, screen: point.screen, place: currentLayer(), dragging: false, free: event.altKey };
    return;
  }
  const slop = EDGE * point.perScreenUnit;
  let current = selected();
  let bounds = current && liveBounds(editorDoc(), current);
  let mode = bounds && current ? grabOf(current, bounds, point.world, slop) : null;
  let fresh = false;
  if (!mode) {
    const under = elementAt(point.world);
    if (under) {
      select(under);
      current = under;
      bounds = liveBounds(editorDoc(), current);
      mode = grabOf(current, bounds as Box, point.world, slop) || GRAB_MOVE;
      fresh = true;
    }
  }
  const grabbed = current as MapElement;
  const start = mode ? (kindOf(grabbed.tag)?.shape === SHAPE.RECT ? bounds : { ...anchorOf(grabbed), w: (bounds as Box).w, h: (bounds as Box).h }) : null;
  press = { at: point.world, screen: point.screen, target: mode ? current : null, mode, start: start || null, dragging: false, fresh };
}

function onPointerDown(event: Pointer): void {
  const point = event.button === 0 && !isUi(event.target) ? pointOfEvent(event) : null;
  lastPress.window = { target: describe(event.target), taken: !!(point && inGame(point)), x: Math.round(event.clientX), y: Math.round(event.clientY) };
  if (!point || !inGame(point)) return;
  take(event);
  if (currentPick()) {
    const target = pickTargetAt(point.world, PICK_REACH * point.perScreenUnit);
    lastPress.layer = { world: roundedWorld(point), picked: target ? TEXT.pickedFor(target.tag) : TEXT.nothingToPick };
    finishPick(target);
    return;
  }
  onMouseDown(event, point);
}

function onMouseMove(event: Pointer): void {
  if (!press || !(press.target || press.place)) return;
  const point = pointOfEvent(event);
  if (!point) return;
  if (!press.dragging && Math.hypot(point.screen.x - press.screen.x, point.screen.y - press.screen.y) < DRAG_START) return;
  if (press.place) {
    press.dragging = kindOf(press.place)?.shape === SHAPE.RECT;
    press.free = event.altKey;
    press.end = point.world;
    if (press.dragging) setPreview({ tag: press.place, ...spanOf(press.at, press.end, press.free) });
    return;
  }
  if (!press.dragging) beginAction();
  press.dragging = true;
  const place = dragPlace(press.start as Box, press.mode as string, point.world.x - press.at.x, point.world.y - press.at.y, event.altKey);
  try {
    setPlace(press.target as MapElement, place);
  } catch (error) {
    onError(error as Error);
    press = null;
    endAction();
  }
}

function finishPlace(tag: string, at: Spot, end: Spot | null, free: boolean | undefined): void {
  setPreview(null);
  try {
    if (!end) {
      addElement(tag, { x: snap(at.x, free), y: snap(at.y, free) });
      return;
    }
    const rect = spanOf(at, end, free);
    addElement(tag, { ...rect, w: Math.max(rect.w, free ? 1 : SNAP), h: Math.max(rect.h, free ? 1 : SNAP) });
  } catch (error) {
    onError(error as Error);
  }
}

function onMouseUp(): void {
  if (!press) return;
  const { dragging, at, place, end, free, fresh, target } = press;
  press = null;
  if (place) {
    finishPlace(place, at, dragging ? end ?? null : null, free);
    return;
  }
  if (dragging) endAction();
  else if (fresh) {
    if (lastPress.layer) lastPress.layer.picked = pickedName(editorDoc() as MapDoc, target as MapElement);
  } else {
    const item = pickAt(at);
    if (lastPress.layer) lastPress.layer.picked = item ? pickedName(editorDoc() as MapDoc, item) : TEXT.nothing;
  }
}

function onPointerUp(event: Pointer): void {
  if (!press) return;
  take(event);
  onMouseUp();
}

function blockWhilePressed(event: Event): void {
  if (press) take(event);
}

type Listen = (type: string, listener: (event: never) => void, capture: boolean) => void;

export function captureMouse(on: boolean, errors?: (error: Error) => void): void {
  const doc = globalThis.document as Document | undefined;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- each call below passes the document as this
  const listen = doc && (on ? doc.addEventListener : doc.removeEventListener) as unknown as Listen | undefined;
  if (on === listening || !listen) return;
  listening = on;
  if (!on) {
    if (press && press.dragging && press.target) endAction();
    press = null;
    setPreview(null);
  } else {
    if (errors) onError = errors;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  listen.call(doc, POINTER_EVENT.down, onPointerDown, true);
  listen.call(doc, POINTER_EVENT.move, onMouseMove, true);
  listen.call(doc, POINTER_EVENT.up, onPointerUp, true);
  for (const type of BLOCKED_DURING_PRESS) listen.call(doc, type, blockWhilePressed, true);
}

export function inputStatus(): { listening: boolean; pointerLocked: boolean; lastPress: typeof lastPress } {
  return {
    listening,
    pointerLocked: !!(globalThis.document as Document | undefined)?.pointerLockElement,
    lastPress,
  };
}

export const mouse = { down: onMouseDown, move: onMouseMove, up: onMouseUp };
