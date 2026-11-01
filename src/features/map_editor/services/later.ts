import { game } from '#console/kernel/game/bindings.ts';
import { readGlobal } from '#console/kernel/game/globals.ts';
import { escapeRe } from '#console/kernel/core/words.ts';
import type { DisplayObject } from '#console/kernel/game/types.ts';
import { EDGE_TESTS, FAR } from './constants.ts';
import { loaderSource, loopAt, runGameCode, type GameLoop } from './loader.ts';
import {
  ATTACHMENTS_GLOBAL, CODE_NAME, EDGE_SIDE, GAME_TEXT, HOLDER_CLASS, STEP_NAME, WALL_EDGE_CALL, WALL_EDGE_MODEL, doorEdgeFieldPattern, doorIndexPattern,
  moveAttachedPattern, textureTiePattern, wallEdgeClearPattern, wallEdgeMakePattern, waterShowText,
} from './keys.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

export type Rect = { x: number; y: number; w: number; h: number };
export type Attachment = { parent?: unknown; child?: unknown; type?: unknown; id?: unknown; [field: string]: unknown };
type WallEdgeStep = { clear: string | undefined; make: string | undefined; model: number };
type Steps = {
  attach: GameLoop | null;
  waterShow: GameLoop | null;
  doorTexture: GameLoop | null;
  doorEdges: GameLoop | null;
  tied: { clips: string; door: string } | null;
  edgeOf: string | null;
  wallEdge: WallEdgeStep | null;
  moveAttached: string | null;
};
type Holder = DisplayObject & { io?: unknown; clearMCInterpolationData?: () => void };
type HolderClass = new () => Holder;
type World = { children?: unknown[]; numChildren: number; addChildAt(child: unknown, index: number): Holder };
type Callable = (...args: unknown[]) => unknown;

let steps: Steps | null = null;
let stepsFor: string | null = null;

const globalOf = (name: string): unknown => Reflect.get(globalThis, name);

function loopWith(src: string, text: string, test: (body: string) => boolean = () => true): GameLoop | null {
  for (let at = src.indexOf(text); at >= 0; at = src.indexOf(text, at + 1)) {
    const loop = loopAt(src, at);
    if (loop && test(loop.body)) return loop;
  }
  return null;
}

function read(src: string): Steps {
  const doors = escapeRe(game.codeName(CODE_NAME.doors));
  const follows = game.codeName(CODE_NAME.textureFollows);
  const doorIndex = doorIndexPattern(doors);
  const doorEdges = loopWith(src, GAME_TEXT.edgeHolder, (body) => doorIndex.test(body));
  const tie = src.match(textureTiePattern(escapeRe(follows)));
  const wallEdges = loopWith(src, GAME_TEXT.edgeHolder, (body) => !doorIndex.test(body) && WALL_EDGE_CALL.test(body));
  return {
    attach: loopWith(src, GAME_TEXT.attachParent),
    waterShow: loopWith(src, waterShowText(game.codeName(CODE_NAME.waters))),
    doorTexture: loopWith(src, GAME_TEXT.newTexture, (body) => body.includes(follows + GAME_TEXT.callOpen)),
    doorEdges,
    tied: tie ? { clips: tie[2] ?? '', door: tie[3] ?? '' } : null,
    edgeOf: doorEdges?.body.match(doorEdgeFieldPattern())?.[1] || null,
    wallEdge: wallEdges && {
      clear: wallEdges.body.match(wallEdgeClearPattern())?.[1],
      make: wallEdges.body.match(wallEdgeMakePattern())?.[1],
      model: Number(wallEdges.body.match(WALL_EDGE_MODEL)?.[1]),
    },
    moveAttached: src.match(moveAttachedPattern())?.[1] || null,
  };
}

function stepsNow(): Steps | null {
  const src = loaderSource();
  if (!src) return null;
  if (stepsFor !== src) {
    steps = read(src);
    stepsFor = src;
  }
  return steps;
}

const runStep = (step: GameLoop | null | undefined, index: number, name: string): boolean => {
  if (step) runGameCode(step.body, name, { set: { [step.loopVar]: index } });
  return !!step;
};

const list = (): Attachment[] | null => (readGlobal(ATTACHMENTS_GLOBAL) as Attachment[] | null | undefined) ?? null;

export const attachMark = (): number => list()?.length ?? 0;

export function dropAttachments(isOld: (entry: Attachment) => boolean): void {
  const entries = list();
  if (!entries) return;
  for (let at = entries.length - 1; at >= 0; at--) if (isOld(entries[at] as Attachment)) entries.splice(at, 1);
}

export function resolveAttachments(mark: number): void {
  const entries = list();
  const step = stepsNow()?.attach;
  if (!entries || entries.length <= mark) return;
  if (!step) {
    entries.splice(mark);
    throw new Error(TEXT.noAttachCode);
  }
  for (let at = mark; at < entries.length;) {
    try {
      runStep(step, at, STEP_NAME.attach);
      if (!(entries[at] as Attachment).parent) throw new Error(TEXT.noSuchMovable);
      at++;
    } catch {
      entries.splice(at, 1);
    }
  }
}

export function moveAttachments(from: unknown, to: unknown): void {
  for (const entry of list() || []) if (entry.parent === from) entry.parent = to;
}

export function followMovable(index: number): void {
  const name = stepsNow()?.moveAttached;
  const move = name ? globalOf(name) : undefined;
  if (name && typeof move === 'function') (move as Callable)(index, 0, 0);
}

export function showWater(index: number): void {
  if (!runStep(stepsNow()?.waterShow, index, STEP_NAME.water)) throw new Error(TEXT.noWaterCode);
}

export function doorTexture(index: number): DisplayObject | null {
  const tied = stepsNow()?.tied;
  const clips = tied && globalOf(tied.clips) as DisplayObject[] | undefined;
  const door = tied && globalOf(tied.door) as number[] | undefined;
  if (!clips || !door) return null;
  const Texture = game.wallTexture();
  for (let at = clips.length - 1; at >= 0; at--) if (door[at] === index && (!Texture || clips[at] instanceof Texture)) return clips[at] as DisplayObject;
  return null;
}

export function makeDoorTexture(index: number): void {
  if (!runStep(stepsNow()?.doorTexture, index, STEP_NAME.doorTexture)) throw new Error(TEXT.noTextureCode);
}

export function doorEdges(index: number): DisplayObject[] {
  const field = stepsNow()?.edgeOf;
  const world = game.worldLayer();
  if (!field || !world) return [];
  return ((world.children || []) as (DisplayObject | null)[]).filter((child): child is DisplayObject => !!child && child[field] === index);
}

export function makeDoorEdges(index: number): void {
  if (!runStep(stepsNow()?.doorEdges, index, STEP_NAME.doorEdges)) throw new Error(TEXT.noEdgesCode);
}

function roomAt(clear: Callable, atX: number, atY: number, side: number): boolean {
  return EDGE_TESTS.every(([fromX, fromY, toX, toY]) => clear(atX + fromX * side, atY + fromY, atX + toX * side, atY + toY));
}

function edgesAt(rect: Rect | null): { left: Holder | null; right: Holder | null } {
  const HolderType = globalOf(HOLDER_CLASS) as HolderClass | undefined;
  const world = game.worldLayer();
  const tie = stepsNow()?.edgeOf;
  const found: { left: Holder | null; right: Holder | null } = { left: null, right: null };
  if (!HolderType || !world || !rect) return found;
  for (const child of (world.children || []) as unknown[]) {
    if (!(child instanceof HolderType) || child.io === false || (tie && child[tie] !== undefined && child[tie] !== -1) || child.y !== rect.y) continue;
    if (child.x === rect.x && !found.left) found.left = child;
    else if (child.x === rect.x + rect.w && !found.right) found.right = child;
  }
  return found;
}

const retire = (holder: Holder | null): void => {
  if (holder) Object.assign(holder, { io: false, visible: false, x: FAR, y: FAR });
};

export function placeWallEdges(from: Rect | null, to: Rect | null): boolean {
  const step = stepsNow()?.wallEdge;
  const clear = step?.clear && globalOf(step.clear);
  const make = step?.make && globalOf(step.make);
  const had = edgesAt(from);
  if (!to) {
    retire(had.left);
    retire(had.right);
    return true;
  }
  if (typeof clear !== 'function' || typeof make !== 'function' || !Number.isFinite((step as WallEdgeStep).model)) {
    retire(had.left);
    retire(had.right);
    return false;
  }
  const world = game.worldLayer() as unknown as World;
  const HolderType = globalOf(HOLDER_CLASS) as HolderClass;
  const corners = [[EDGE_SIDE.left, to.x, 1], [EDGE_SIDE.right, to.x + to.w, -1]] as const;
  for (const [key, atX, side] of corners) {
    const old = had[key];
    if (!roomAt(clear as Callable, atX, to.y, side)) {
      retire(old);
      continue;
    }
    if (old) {
      old.x = atX;
      old.y = to.y;
      old.clearMCInterpolationData?.();
      continue;
    }
    const holder = world.addChildAt(new HolderType(), world.numChildren);
    game.initDisplay(holder);
    holder.x = atX;
    holder.y = to.y;
    (make as Callable)(holder, (step as WallEdgeStep).model, side);
  }
  return true;
}
