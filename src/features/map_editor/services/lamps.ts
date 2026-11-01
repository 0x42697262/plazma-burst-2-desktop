import type { Attrs, MapElement } from '../domain/doc.ts';
import { LAMP_STATE } from './constants.ts';
import { branchOf, buildElement, builtCount, decoded, loopAt, loaderSource, loaderProblem, runGameCode, type GameLoop } from './loader.ts';
import {
  GAME_TEXT, LAMP_ATTR, LAMP_TAG, SHAPE_SCRATCH, STEP_NAME, flareListPattern, functionPattern, lampArrayPattern, lampStatePattern,
} from './keys.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

export type LightCode = {
  x: string; y: string; power: string; state: string; count: string;
  light: GameLoop; flare: GameLoop; flares: string; redraw: string;
};
type Lights = Omit<LightCode, 'count'> & { pointsX: number[]; pointsY: number[]; states: (number | undefined)[]; count: number };
type Flare = { x: number; y: number; visible: boolean; scaleX: number; scaleY: number };

let found = new Map<number, number>();
let code: LightCode | null = null;
let codeFor: string | null = null;

const globalOf = (name: string): unknown => Reflect.get(globalThis, name);

export function forgetLamps(): void {
  found = new Map();
}

const one = (src: string, pattern: RegExp, what: string): RegExpMatchArray => {
  const match = src.match(pattern);
  if (!match) throw new Error(TEXT.gameCodeMissing(what));
  return match;
};

export function parseLights(src: string, lampCode: string): LightCode {
  const lamp = decoded(lampCode);
  const array = (attr: string): string => one(lamp, lampArrayPattern(attr), TEXT.lampArray(attr))[1] ?? '';
  const state = one(lamp, lampStatePattern(), TEXT.lampStateArray);
  const light = loopAt(src, src.indexOf(GAME_TEXT.lightGradient));
  const flare = loopAt(src, src.indexOf(GAME_TEXT.newFlare));
  if (!light || !flare) throw new Error(TEXT.noLightDrawing);
  const flares = one(flare.body, flareListPattern(), TEXT.flareList)[1] ?? '';
  const draw = src.indexOf(GAME_TEXT.drawWithQuality);
  const functions = [...src.slice(0, draw).matchAll(functionPattern())];
  if (draw < 0 || !functions.length) throw new Error(TEXT.noLightmapDrawing);
  return {
    x: array(LAMP_ATTR.x), y: array(LAMP_ATTR.y), power: array(LAMP_ATTR.power), state: state[1] ?? '', count: state[2] ?? '',
    light, flare, flares, redraw: functions[functions.length - 1]?.[1] ?? '',
  };
}

function lights(): Lights {
  const src = loaderSource();
  const branch = branchOf(LAMP_TAG);
  if (!src || !branch) throw new Error(loaderProblem() || TEXT.noLampBranch);
  if (codeFor !== src) {
    code = parseLights(src, branch.code);
    codeFor = src;
  }
  const current = code as LightCode;
  return {
    ...current,
    pointsX: globalOf(current.x) as number[],
    pointsY: globalOf(current.y) as number[],
    states: globalOf(current.state) as (number | undefined)[],
    count: globalOf(current.count) as number,
  };
}

export function lampOf(item: MapElement): number | null {
  const known = found.get(item.id);
  if (known !== undefined) return known;
  const { pointsX, pointsY, states, count } = lights();
  const claimed = new Set(found.values());
  for (const form of [item.live?.loaded, item.attrs].filter((attrs): attrs is Attrs => !!attrs)) {
    const atX = parseFloat(form.x ?? '');
    const atY = parseFloat(form.y ?? '');
    for (let slot = 0; slot < count; slot++) {
      if (!claimed.has(slot) && states[slot] !== undefined && pointsX[slot] === atX && pointsY[slot] === atY) {
        found.set(item.id, slot);
        return slot;
      }
    }
  }
  return null;
}

function hideFlares(lightsNow: Lights, slot: number): void {
  for (const flare of (globalOf(lightsNow.flares) || []) as (Flare | null)[]) {
    if (flare && flare.x === lightsNow.pointsX[slot] && flare.y === lightsNow.pointsY[slot]) {
      flare.visible = false;
      flare.scaleX = flare.scaleY = 0;
    }
  }
}

const redraw = (lightsNow: Lights): void => {
  (globalOf(lightsNow.redraw) as (quality: boolean) => void)(false);
};
const drawLight = (lightsNow: Lights, slot: number): void => {
  runGameCode(lightsNow.light.body, STEP_NAME.lampLight, { set: { [lightsNow.light.loopVar]: slot }, keep: SHAPE_SCRATCH });
};

function putOut(lightsNow: Lights, slot: number): void {
  hideFlares(lightsNow, slot);
  (globalOf(lightsNow.power) as number[])[slot] = 0;
  drawLight(lightsNow, slot);
  (globalOf(lightsNow.state) as number[])[slot] = LAMP_STATE.off;
  redraw(lightsNow);
}

export function placeLamp(item: MapElement): number | null {
  const lightsNow = lights();
  const slot = lampOf(item);
  if (slot !== null) hideFlares(lightsNow, slot);
  const at = (slot ?? builtCount(LAMP_TAG)) as number;
  const kept = buildElement(LAMP_TAG, item.attrs, at);
  const states = globalOf(lightsNow.state) as number[];
  if (!kept) {
    if (slot !== null) putOut(lightsNow, slot);
    return null;
  }
  found.set(item.id, at);
  drawLight(lightsNow, at);
  if (states[at] === LAMP_STATE.flare) runGameCode(lightsNow.flare.body, STEP_NAME.lampFlare, { set: { [lightsNow.flare.loopVar]: at } });
  redraw(lightsNow);
  return at;
}

export function removeLamp(item: MapElement): void {
  const lightsNow = lights();
  const slot = lampOf(item);
  if (slot === null) throw new Error(TEXT.noLight);
  putOut(lightsNow, slot);
}
