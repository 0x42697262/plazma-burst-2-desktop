import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { textureAt, addWall, removeWall } from '#console/kernel/game/walls.ts';
import { findRect, moveRect } from '#console/kernel/game/layers.ts';
import type { DisplayObject } from '#console/kernel/game/types.ts';
import { unwrap } from '#features/triggers/run-log.ts';
import { boundsOf } from '../domain/kinds.ts';
import { TAG } from '../domain/keys.ts';
import type { Attrs, LiveInfo, MapElement } from '../domain/doc.ts';
import { FAR, TIE_TYPE } from './constants.ts';
import { canRebuild, canBuild, buildElement, builtCount, loaderProblem } from './loader.ts';
import { claimNewestGun, removeGun, remakeGun } from './guns.ts';
import { placeLamp, removeLamp } from './lamps.ts';
import { setStart } from './start.ts';
import {
  attachMark, dropAttachments, resolveAttachments, moveAttachments, followMovable,
  showWater, doorTexture, makeDoorTexture, doorEdges, makeDoorEdges, placeWallEdges, type Attachment, type Rect,
} from './later.ts';
import { DEFAULT_MATERIAL, START_ATTR, VISIBLE_VALUE } from './keys.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

type Bag = Record<string, unknown>;
type Shown = (DisplayObject & { mc?: unknown }) | null | undefined;
type Was = { old?: unknown; texture?: DisplayObject | null; edges?: DisplayObject[] };
type InPlace = {
  old: (index: number) => unknown;
  drop: (old: unknown) => void;
  tied?: (entry: Attachment, old: unknown, index: number) => boolean;
  after?: (index: number, attrs: Attrs, was?: Was) => void;
};
export type AddedLive = LiveInfo & { problem?: string };
type Numbers = number[];

const detach = (shown: unknown): void => {
  const node = shown as Shown;
  if (node && node.parent && node.parent.removeChild) node.parent.removeChild(node);
};

function doorAfter(index: number, attrs: Attrs, { old = null, texture = null, edges = [] }: Was = {}): void {
  const now = game.doors()?.[index];
  if (!now) return;
  if (old) moveAttachments(old, now);
  if (attrs.vis === VISIBLE_VALUE) {
    if (texture) {
      const layer = game.wallLayer();
      if (!texture.parent && layer) layer.addChildAt(texture, layer.numChildren);
      Object.assign(texture, { x: now.x, y: now.y, scaleX: now.scaleX, scaleY: now.scaleY });
    } else makeDoorTexture(index);
    if (!edges.length) makeDoorEdges(index);
  } else if (texture) detach(texture);
  followMovable(index);
}

const nothing = (): null => null;
const dropNothing = (): void => undefined;
const tiedTo = (entry: Attachment, child: unknown): boolean => !!child && entry.child === child;

const IN_PLACE: Readonly<Record<string, InPlace>> = Object.freeze({
  region: {
    old: (index: number) => game.regions()?.[index],
    drop: (region: unknown) => { detach((region as Bag | undefined)?.mc); },
    tied: (entry: Attachment, region: unknown) => !!region && (entry.child === region || (!!(region as Bag).mc && entry.child === (region as Bag).mc)),
  },
  decor: { old: (index: number) => game.decors()?.[index], drop: detach, tied: tiedTo },
  door: { old: (index: number) => game.doors()?.[index], drop: detach, tied: tiedTo, after: doorAfter },
  trigger: { old: nothing, drop: dropNothing },
  timer: { old: nothing, drop: dropNothing },
  pushf: { old: nothing, drop: dropNothing, tied: (entry: Attachment, _old: unknown, index: number) => entry.type === TIE_TYPE.pusher && entry.child === index },
  water: {
    old: (index: number) => (game.waters().shown as unknown[] | undefined)?.[index],
    drop: detach,
    tied: (entry: Attachment, _old: unknown, index: number) => entry.type === TIE_TYPE.water && entry.id === index,
    after: (index: number) => { showWater(index); },
  },
});

const inPlaceOf = (tag: string): InPlace | undefined => (Object.hasOwn(IN_PLACE, tag) ? IN_PLACE[tag] : undefined);

export const rebuildable = (tag: string): boolean => !!inPlaceOf(tag);

export function rebuildLive(item: MapElement): void {
  const kind = inPlaceOf(item.tag);
  if (!kind) throw new Error(TEXT.notLive);
  if (!canRebuild(item.tag)) throw new Error(loaderProblem() || TEXT.cannotBuildAgain(item.tag));
  const index = (item.live as LiveInfo).index as number;
  const old = kind.old(index);
  const oldDoor = old as DisplayObject | null | undefined;
  const was: Was = item.tag === TAG.door
    ? { old, texture: doorTexture(index) ?? (oldDoor ? textureAt({ x: oldDoor.x, y: oldDoor.y, w: oldDoor.w as number, h: oldDoor.h as number }) : null), edges: doorEdges(index) }
    : { old };
  kind.drop(old);
  const tied = kind.tied;
  if (tied) dropAttachments((entry) => tied(entry, old, index));
  const mark = attachMark();
  buildElement(item.tag, item.attrs, index);
  resolveAttachments(mark);
  kind.after?.(index, item.attrs, was);
}

const NOT_ADDED: Readonly<Record<string, string>> = Object.freeze({
  player: TEXT.charactersAtStart, enemy: TEXT.charactersAtStart,
  inf: TEXT.marksAtStart, song: TEXT.songsAtStart,
});

export function addLive(item: MapElement): AddedLive {
  const notAdded = Object.hasOwn(NOT_ADDED, item.tag) ? NOT_ADDED[item.tag] : undefined;
  if (notAdded) throw new Error(notAdded);
  if (item.tag === TAG.box) {
    const rect = boundsOf(item) as Rect;
    const index = addWall(rect, item.attrs.m ?? DEFAULT_MATERIAL);
    return placeWallEdges(null, rect) ? { index } : { index, problem: TEXT.noWallEdgeCode };
  }
  if (item.tag === TAG.lamp) {
    const index = builtCount(TAG.lamp) as number;
    placeLamp(item);
    return { index };
  }
  if (!canBuild(item.tag)) throw new Error(loaderProblem() || TEXT.noLoaderBranch(item.tag));
  const index = builtCount(item.tag);
  const mark = attachMark();
  buildElement(item.tag, item.attrs, index ?? 0);
  const live: AddedLive = {};
  try {
    resolveAttachments(mark);
    if (item.tag === TAG.gun) claimNewestGun(item);
    else if (index !== null) {
      live.index = index;
      inPlaceOf(item.tag)?.after?.(index, item.attrs);
    }
  } catch (error) {
    live.problem = (error as Error).message;
  }
  return live;
}

const hide = (shown: unknown): void => {
  detach(shown);
};

const disableCounted = (tag: string, counted: Bag): void => {
  counted[GAME_FIELDS.T_ENABLED] = false;
  counted[GAME_FIELDS.T_CALLS] = counted[GAME_FIELDS.T_MAX_CALLS] = 0;
  setStart(tag, counted, START_ATTR.enabled, false);
};

const REMOVE: Readonly<Record<string, (index: number, item: MapElement) => void>> = Object.freeze({
  box: (index: number) => {
    const walls = game.walls();
    placeWallEdges({ x: walls.x[index] as number, y: walls.y[index] as number, w: walls.w[index] as number, h: walls.h[index] as number }, null);
    removeWall(index);
  },
  region: (index: number) => {
    const region = game.regions()[index] as Bag;
    detach(region.mc);
    region.mc = undefined;
    region.x = region.y = FAR;
    region[GAME_FIELDS.R_USE_ON] = 0;
  },
  trigger: (index: number) => { disableCounted(TAG.trigger, unwrap(game.triggers()[index]) as Bag); },
  timer: (index: number) => { disableCounted(TAG.timer, game.timers()[index] as Bag); },
  decor: (index: number) => { hide(game.decors()[index]); },
  door: (index: number) => {
    const door = game.doors()[index] as DisplayObject;
    const texture = doorTexture(index) ?? textureAt({ x: door.x, y: door.y, w: door.w as number, h: door.h as number });
    if (texture) Object.assign(texture, { scaleX: 0, scaleY: 0 });
    hide(door);
    door.x = door.y = FAR;
    door.tarx = door.tary = FAR;
  },
  bg: (index: number) => {
    const backgrounds = game.backgrounds() as Record<string, Numbers>;
    const [bgX, bgY, bgW, bgH] = [backgrounds.x, backgrounds.y, backgrounds.w, backgrounds.h] as Numbers[] as [Numbers, Numbers, Numbers, Numbers];
    const drawn = findRect({ x: bgX[index] as number, y: bgY[index] as number, w: bgW[index] as number, h: bgH[index] as number });
    if (drawn) moveRect(drawn, { x: bgX[index] as number, y: bgY[index] as number, w: 0, h: 0 });
    bgW[index] = 0;
    bgH[index] = 0;
  },
  water: (index: number) => {
    const waters = game.waters() as Record<string, Numbers | undefined>;
    hide((waters.shown as unknown[] | undefined)?.[index]);
    (waters.w as Numbers)[index] = 0;
    (waters.h as Numbers)[index] = 0;
  },
  pushf: (index: number) => {
    const pushers = game.pushers() as Record<string, Numbers>;
    const [pushX1, pushY1, pushX2, pushY2] = [pushers.x1, pushers.y1, pushers.x2, pushers.y2] as Numbers[] as [Numbers, Numbers, Numbers, Numbers];
    pushX2[index] = pushX1[index] as number;
    pushY2[index] = pushY1[index] as number;
  },
  gun: (_index: number, item: MapElement) => { removeGun(item); },
  lamp: (_index: number, item: MapElement) => { removeLamp(item); },
});

export function removeLive(item: MapElement): void {
  const remove = Object.hasOwn(REMOVE, item.tag) ? REMOVE[item.tag] : undefined;
  if (!remove || !item.live || (item.live.index === undefined && item.tag !== TAG.gun)) throw new Error(TEXT.cannotTakeOut(item.tag));
  remove(item.live.index as number, item);
}

export function restoreLive(item: MapElement): void {
  if (item.tag === TAG.gun && item.live) {
    remakeGun(item);
    return;
  }
  if (item.tag === TAG.lamp && item.live) {
    placeLamp(item);
    return;
  }
  if (!item.live || item.live.index === undefined) throw new Error(TEXT.notInLevel);
  if (rebuildable(item.tag)) {
    rebuildLive(item);
    return;
  }
  throw new Error(TEXT.backOnLoad(item.tag));
}
