import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { moveWall, textureAt } from '#console/kernel/game/walls.ts';
import { findRect, moveRect } from '#console/kernel/game/layers.ts';
import type { DisplayObject } from '#console/kernel/game/types.ts';
import { unwrap } from '#features/triggers/run-log.ts';
import { DECIMAL_RADIX } from '../domain/constants.ts';
import { boundsOf } from '../domain/kinds.ts';
import { TAG } from '../domain/keys.ts';
import type { Attrs, MapElement } from '../domain/doc.ts';
import { FIRST_ACTION, LOADER_USE_ON, SCALE_UNIT, SWITCH_MODES, TRIGGER_ACTIONS_LIMIT, WATER_GROWTH, HALF } from './constants.ts';
import { rebuildable, rebuildLive } from './rebuild.ts';
import { moveGun, remakeGun } from './guns.ts';
import { placeLamp } from './lamps.ts';
import { setStart } from './start.ts';
import { doorTexture, followMovable, placeWallEdges, type Rect } from './later.ts';
import {
  ACTION_ATTR_PATTERN, ACTION_PART, ANY_ATTR, DETACHED_VALUES, DISPLAY_PROPERTY, EMPTY_ACTION_TYPE, LIVE_SUPPORT, PLACE_AND_SIZE, UNREAD_ATTRS,
  PUSHER_FIELDS, START_ATTR, TRUE_VALUE, TRUE_VALUES, LAMP_LIVE_ATTRS, triggerActionAttr,
} from './keys.ts';
import { READ_AT_START, SERVICES_TEXT as TEXT } from './text.ts';

type Bag = Record<string, unknown>;
type Setter = (target: Bag, value: string | undefined, attrs: Attrs, item: MapElement) => boolean;
type LiveKind = {
  of: (index: number) => unknown;
  attrs: Readonly<Record<string, Setter>>;
  other?: (target: Bag, attr: string, value: string | undefined, attrs: Attrs) => boolean;
};
export type Applied = { live: true } | { live: false; why: string };
type Numbers = number[];

const integerOf = (value: string | undefined): number => parseInt(value ?? '', DECIMAL_RADIX);
const finite = (value: string | undefined): boolean => Number.isFinite(parseFloat(value ?? ''));
const floatOf = (value: string | undefined): number => parseFloat(value ?? '');

const attached = (attrs: Attrs): boolean => attrs.attach !== undefined && !DETACHED_VALUES.includes(attrs.attach);

function placeSwitch(region: Bag): void {
  const shown = region.mc as Bag | undefined;
  if (shown) {
    shown.x = (region.x as number) + (region.w as number) / HALF;
    shown.y = (region.y as number) + (region.h as number) / HALF;
  }
}
function moveRegion(region: Bag, atX: number, atY: number): boolean {
  region.x = atX;
  region.y = atY;
  placeSwitch(region);
  return true;
}
function sizeRegion(region: Bag, width: number, height: number): boolean {
  region.w = width;
  region.h = height;
  placeSwitch(region);
  return true;
}

const regionAttrs: Readonly<Record<string, Setter>> = {
  x: (region, value, attrs) => !attached(attrs) && finite(value) && moveRegion(region, floatOf(value), region.y as number),
  y: (region, value, attrs) => !attached(attrs) && finite(value) && moveRegion(region, region.x as number, floatOf(value)),
  w: (region, value, attrs) => !attached(attrs) && finite(value) && sizeRegion(region, floatOf(value), region.h as number),
  h: (region, value, attrs) => !attached(attrs) && finite(value) && sizeRegion(region, region.w as number, floatOf(value)),
  use_target: (region, value) => {
    region[GAME_FIELDS.R_TRIGGER] = game.resolveTarget(value);
    return true;
  },
  use_on: (region, value) => {
    const given = integerOf(value);
    const mode = LOADER_USE_ON[given] ?? given;
    if (!Number.isFinite(mode) || SWITCH_MODES.has(mode) !== SWITCH_MODES.has(region[GAME_FIELDS.R_USE_ON] as number)) return false;
    region[GAME_FIELDS.R_USE_ON] = mode;
    return true;
  },
  uses_timer: (region, value) => {
    region[GAME_FIELDS.R_USES_TIMER] = TRUE_VALUES.includes(value ?? '');
    return true;
  },
};

function loadActions(trigger: Bag, attrs: Attrs): boolean {
  const types: number[] = [];
  const targetsA: unknown[] = [];
  const targetsB: unknown[] = [];
  for (let slot = FIRST_ACTION; slot <= TRIGGER_ACTIONS_LIMIT; slot++) {
    const type = attrs[triggerActionAttr(slot, ACTION_PART.type)];
    if (type === undefined || type === EMPTY_ACTION_TYPE) continue;
    types.push(integerOf(type));
    targetsA.push(game.resolveTarget(attrs[triggerActionAttr(slot, ACTION_PART.targetA)]));
    targetsB.push(game.resolveTarget(attrs[triggerActionAttr(slot, ACTION_PART.targetB)]));
  }
  trigger[GAME_FIELDS.T_TYPES] = types;
  trigger[GAME_FIELDS.T_A] = targetsA;
  trigger[GAME_FIELDS.T_B] = targetsB;
  trigger[GAME_FIELDS.T_ACTIONS] = types.length;
  return true;
}

const counted = (tag: string): Record<string, Setter> => ({
  enabled: (target, value) => {
    target[GAME_FIELDS.T_ENABLED] = value === TRUE_VALUE;
    setStart(tag, target, START_ATTR.enabled, value === TRUE_VALUE);
    return true;
  },
  maxcalls: (target, value) => {
    if (!Number.isFinite(integerOf(value))) return false;
    target[GAME_FIELDS.T_MAX_CALLS] = target[GAME_FIELDS.T_CALLS] = integerOf(value);
    return true;
  },
});

const decorNumber = (property: string, fallback?: number): Setter => (shown, value, attrs) => {
  if (attached(attrs)) return false;
  const number = value === '' || value === undefined ? fallback : parseFloat(value);
  if (!Number.isFinite(number)) return false;
  shown[property] = number;
  return true;
};
const decorAttrs: Readonly<Record<string, Setter>> = {
  x: decorNumber(DISPLAY_PROPERTY.x), y: decorNumber(DISPLAY_PROPERTY.y), r: decorNumber(DISPLAY_PROPERTY.rotation, 0),
  sx: decorNumber(DISPLAY_PROPERTY.scaleX, 1), sy: decorNumber(DISPLAY_PROPERTY.scaleY, 1),
};

function placeDoor(shown: Bag, attrs: Attrs, index: number): boolean {
  if (attached(attrs)) return false;
  const rect = boundsOf({ tag: TAG.door, attrs });
  if (!rect) return false;
  const body = doorTexture(index) ?? textureAt({ x: shown.x as number, y: shown.y as number, w: shown.w as number, h: shown.h as number });
  Object.assign(shown, { x: rect.x, y: rect.y, w: rect.w, h: rect.h, scaleX: rect.w / SCALE_UNIT, scaleY: rect.h / SCALE_UNIT });
  if (body) Object.assign(body, { x: rect.x, y: rect.y, scaleX: rect.w / SCALE_UNIT, scaleY: rect.h / SCALE_UNIT });
  setStart(TAG.door, shown, START_ATTR.x, rect.x);
  setStart(TAG.door, shown, START_ATTR.y, rect.y);
  followMovable(index);
  return true;
}
const doorPlace: Setter = (shown, _value, attrs, item) => placeDoor(shown, attrs, item.live?.index as number);
const doorTarget = (key: string): Setter => (shown, value) => {
  if (!finite(value)) return false;
  shown[key] = floatOf(value);
  setStart(TAG.door, shown, key, floatOf(value));
  return true;
};
const doorAttrs: Readonly<Record<string, Setter>> = {
  x: doorPlace, y: doorPlace, w: doorPlace, h: doorPlace, tarx: doorTarget(START_ATTR.tarx), tary: doorTarget(START_ATTR.tary),
};

const rectOf = (tag: string, attrs: Attrs): Rect | null => boundsOf({ tag, attrs });

const wallPlace = (index: number) => (_value: string | undefined, attrs: Attrs): boolean => {
  const rect = rectOf(TAG.box, attrs);
  if (!rect) return false;
  const walls = game.walls();
  const from = { x: walls.x[index] as number, y: walls.y[index] as number, w: walls.w[index] as number, h: walls.h[index] as number };
  moveWall(index, rect);
  placeWallEdges(from, rect);
  return true;
};

function placeBg(index: number, attrs: Attrs): boolean {
  if (attrs.a !== undefined && !DETACHED_VALUES.includes(attrs.a)) throw new Error(TEXT.backgroundAttached);
  const rect = rectOf(TAG.bg, attrs);
  const backgrounds = game.backgrounds() as Record<string, Numbers>;
  if (!rect) return false;
  const [bgX, bgY, bgW, bgH] = [backgrounds.x, backgrounds.y, backgrounds.w, backgrounds.h] as [Numbers, Numbers, Numbers, Numbers];
  const drawn = findRect({ x: bgX[index] as number, y: bgY[index] as number, w: bgW[index] as number, h: bgH[index] as number });
  if (!drawn) throw new Error(TEXT.drawingNotFound);
  moveRect(drawn, rect);
  bgX[index] = rect.x;
  bgY[index] = rect.y;
  bgW[index] = rect.w;
  bgH[index] = rect.h;
  return true;
}

function placePusher(index: number, attrs: Attrs): boolean {
  if (attached(attrs)) throw new Error(TEXT.pusherAttached);
  const rect = rectOf(TAG.pushf, attrs);
  if (!rect) return false;
  const pushers = game.pushers() as Record<string, Numbers>;
  const [pushX1, pushY1, pushX2, pushY2] = [pushers.x1, pushers.y1, pushers.x2, pushers.y2] as [Numbers, Numbers, Numbers, Numbers];
  pushX1[index] = rect.x;
  pushY1[index] = rect.y;
  pushX2[index] = rect.x + rect.w;
  pushY2[index] = rect.y + rect.h;
  return true;
}
const pusherNumber = (key: string): Setter => (target, value) => {
  if (!finite(value)) return false;
  (game.pushers()[key] as Numbers)[target.index as number] = floatOf(value);
  return true;
};

function placeWater(index: number, attrs: Attrs): boolean {
  if (attached(attrs)) throw new Error(TEXT.waterAttached);
  const rect = rectOf(TAG.water, attrs);
  if (!rect) return false;
  const waters = game.waters() as Record<string, Numbers | undefined>;
  const shown = (waters.shown as unknown as (DisplayObject | undefined)[] | undefined)?.[index];
  if (shown) Object.assign(shown, { x: rect.x, y: rect.y, scaleX: rect.w / SCALE_UNIT, scaleY: rect.h / SCALE_UNIT });
  (waters.x as Numbers)[index] = rect.x - WATER_GROWTH.side;
  (waters.y as Numbers)[index] = rect.y;
  (waters.w as Numbers)[index] = rect.w + WATER_GROWTH.sides * WATER_GROWTH.side;
  (waters.h as Numbers)[index] = rect.h + WATER_GROWTH.below;
  return true;
}

const each = (attrs: readonly string[], setter: Setter): Record<string, Setter> => Object.fromEntries(attrs.map((attr) => [attr, setter]));
const unread = each(UNREAD_ATTRS, () => true);
const indexed = (count: number) => (index: number): Bag | null => (index < count ? { index } : null);

const LIVE: Readonly<Record<string, LiveKind>> = Object.freeze({
  region: { of: (index: number) => (index < game.regionCount() ? game.regions()?.[index] : null), attrs: regionAttrs },
  trigger: {
    of: (index: number) => (index < game.triggerCount() ? unwrap(game.triggers()?.[index]) : null),
    attrs: {
      ...unread, ...counted(TAG.trigger),
      execute: (target: Bag, value: string | undefined) => {
        target[GAME_FIELDS.T_AT_START] = value === TRUE_VALUE;
        return true;
      },
    },
    other: (target: Bag, attr: string, _value: string | undefined, attrs: Attrs) => ACTION_ATTR_PATTERN.test(attr) && loadActions(target, attrs),
  },
  decor: { of: (index: number) => game.decors()?.[index], attrs: decorAttrs },
  door: { of: (index: number) => (index < game.doorCount() ? game.doors()?.[index] : null), attrs: doorAttrs },
  box: {
    of: (index: number) => indexed(game.walls().count)(index),
    attrs: each(PLACE_AND_SIZE, (target, value, attrs) => wallPlace(target.index as number)(value, attrs)),
  },
  gun: {
    of: () => ({}),
    attrs: {
      x: (_target: Bag, _value: string | undefined, _attrs: Attrs, item: MapElement) => moveGun(item),
      y: (_target: Bag, _value: string | undefined, _attrs: Attrs, item: MapElement) => moveGun(item),
      model: (_target: Bag, _value: string | undefined, _attrs: Attrs, item: MapElement) => remakeGun(item),
      upg: (_target: Bag, _value: string | undefined, _attrs: Attrs, item: MapElement) => remakeGun(item),
      command: (_target: Bag, _value: string | undefined, _attrs: Attrs, item: MapElement) => remakeGun(item),
    },
  },
  bg: {
    of: (index: number) => indexed(game.backgrounds().count as number)(index),
    attrs: each(PLACE_AND_SIZE, (target, _value, attrs) => placeBg(target.index as number, attrs)),
  },
  pushf: {
    of: (index: number) => indexed(game.pushers().count as number)(index),
    attrs: {
      ...each(PLACE_AND_SIZE, (target, _value, attrs) => placePusher(target.index as number, attrs)),
      tox: pusherNumber(PUSHER_FIELDS.tox), toy: pusherNumber(PUSHER_FIELDS.toy), stab: pusherNumber(PUSHER_FIELDS.stab), damage: pusherNumber(PUSHER_FIELDS.damage),
    },
  },
  water: {
    of: (index: number) => indexed(game.waters().count as number)(index),
    attrs: each(PLACE_AND_SIZE, (target, _value, attrs) => placeWater(target.index as number, attrs)),
  },
  lamp: {
    of: () => ({}),
    attrs: each(LAMP_LIVE_ATTRS, (_target, _value, _attrs, item) => {
      placeLamp(item);
      return true;
    }),
  },
  timer: {
    of: (index: number) => (index < game.timerCount() ? game.timers()?.[index] : null),
    attrs: {
      ...unread, ...counted(TAG.timer),
      target: (target: Bag, value: string | undefined) => {
        target[GAME_FIELDS.TIMER_TARGET] = game.resolveTarget(value);
        return true;
      },
    },
  },
});

const liveKindOf = (tag: string): LiveKind | undefined => (Object.hasOwn(LIVE, tag) ? LIVE[tag] : undefined);
const setterOf = (kind: LiveKind, attr: string): Setter | undefined => (Object.hasOwn(kind.attrs, attr) ? kind.attrs[attr] : undefined);

const readAtStart = (tag: string, attr: string): string | null => {
  const reasons = Object.hasOwn(READ_AT_START, tag) ? READ_AT_START[tag] : undefined;
  if (!reasons) return null;
  return (Object.hasOwn(reasons, attr) ? reasons[attr] : undefined) ?? reasons[ANY_ATTR] ?? null;
};

export function liveSupport(tag: string, attr: string): string {
  const kind = liveKindOf(tag);
  if (kind && (setterOf(kind, attr) || (kind.other && tag === TAG.trigger && ACTION_ATTR_PATTERN.test(attr)))) return LIVE_SUPPORT.direct;
  const why = readAtStart(tag, attr);
  if (why) return why;
  return rebuildable(tag) ? LIVE_SUPPORT.rebuild : TEXT.notLive;
}

export function applyLive(item: MapElement, attr: string): Applied {
  const kind = liveKindOf(item.tag);
  let finer: Applied = { live: false, why: TEXT.notLive };
  try {
    const target = kind && item.live && kind.of(item.live.index as number) as Bag | null | undefined;
    if (kind && item.live && !target) return { live: false, why: TEXT.notInGame };
    const value = item.attrs[attr];
    const other = kind?.other;
    const setter = target && kind ? setterOf(kind, attr) || (other && ((found: Bag, given: string | undefined, attrs: Attrs) => other(found, attr, given, attrs))) : undefined;
    if (target && setter && setter(target, value, item.attrs, item)) return { live: true };
  } catch (error) {
    finer = { live: false, why: (error as Error).message };
  }
  if (!item.live) return { live: false, why: TEXT.notInGame };
  const why = readAtStart(item.tag, attr);
  if (why) return { live: false, why: finer.live === false && finer.why !== TEXT.notLive ? finer.why : why };
  if (!rebuildable(item.tag)) return finer;
  try {
    rebuildLive(item);
    return { live: true };
  } catch (error) {
    return { live: false, why: (error as Error).message };
  }
}
