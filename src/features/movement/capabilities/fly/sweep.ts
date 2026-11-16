import { game } from '#console/kernel/game/bindings.ts';
import { AIM_X_FIELD, AIM_Y_FIELD } from '../../keys.ts';

type AimHolder = Record<string, unknown> & { x: number; y: number };
type HeldAim = { character: AimHolder; gameAim: { x: unknown; y: unknown } };

export type SweepState = { active: boolean; direction: number; range: number; inverse: boolean; held: HeldAim | null; holdsKeys: boolean };

export const sweep: SweepState = { active: false, direction: 1, range: 0, inverse: false, held: null, holdsKeys: false };

type HeldKeys = { ragdoll: boolean; mouse: boolean; left: boolean; right: boolean };
const keys = game as unknown as { holdKeys(held: HeldKeys): void };
const NOTHING_HELD: HeldKeys = Object.freeze({ ragdoll: false, mouse: false, left: false, right: false });

export function holdKeys(withMouse: boolean, side: number): void {
  sweep.holdsKeys = true;
  keys.holdKeys({ ragdoll: true, mouse: withMouse, left: side < 0, right: side > 0 });
}

function releaseKeys(): void {
  if (!sweep.holdsKeys) return;
  sweep.holdsKeys = false;
  keys.holdKeys(NOTHING_HELD);
}

export function cursorSide(character: AimHolder, deadZone: number): number {
  const cursorX = sweep.held?.gameAim.x;
  if (typeof cursorX !== 'number' || Math.abs(cursorX - character.x) <= deadZone) return 0;
  return Math.sign(cursorX - character.x);
}

export function releaseAim(): void {
  releaseKeys();
  const { held } = sweep;
  if (!held) return;
  sweep.held = null;
  Reflect.deleteProperty(held.character, AIM_X_FIELD);
  Reflect.deleteProperty(held.character, AIM_Y_FIELD);
  held.character[AIM_X_FIELD] = held.gameAim.x;
  held.character[AIM_Y_FIELD] = held.gameAim.y;
}

function aimHeight(character: AimHolder, gameAimY: unknown): unknown {
  return sweep.inverse && typeof gameAimY === 'number' ? character.y + (character.y - gameAimY) : gameAimY;
}

export function holdAim(character: AimHolder): void {
  if (sweep.held?.character === character) return;
  releaseAim();
  const held: HeldAim = { character, gameAim: { x: character[AIM_X_FIELD], y: character[AIM_Y_FIELD] } };
  Object.defineProperty(character, AIM_X_FIELD, {
    configurable: true,
    enumerable: true,
    get: (): number => character.x + sweep.direction * sweep.range,
    set: (gameAimX: unknown): void => { held.gameAim.x = gameAimX; },
  });
  Object.defineProperty(character, AIM_Y_FIELD, {
    configurable: true,
    enumerable: true,
    get: (): unknown => aimHeight(character, held.gameAim.y),
    set: (gameAimY: unknown): void => { held.gameAim.y = gameAimY; },
  });
  sweep.held = held;
}

export function setSweeping(active: boolean): void {
  sweep.active = active;
  sweep.direction = 1;
  if (!active) releaseAim();
}
