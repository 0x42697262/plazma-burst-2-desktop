import { game } from '#console/kernel/game/bindings.ts';
import { AIM_X_FIELD } from '../../keys.ts';

type AimHolder = Record<string, unknown> & { x: number };
type HeldAim = { character: AimHolder; gameAim: unknown };

export type SweepState = { active: boolean; direction: number; range: number; held: HeldAim | null; holdsKeys: boolean };

export const sweep: SweepState = { active: false, direction: 1, range: 0, held: null, holdsKeys: false };

const keys = game as unknown as { holdKeys(ragdoll: boolean, mouse: boolean): void };

export function holdKeys(withMouse: boolean): void {
  sweep.holdsKeys = true;
  keys.holdKeys(true, withMouse);
}

function releaseKeys(): void {
  if (!sweep.holdsKeys) return;
  sweep.holdsKeys = false;
  keys.holdKeys(false, false);
}

export function releaseAim(): void {
  releaseKeys();
  const { held } = sweep;
  if (!held) return;
  sweep.held = null;
  Reflect.deleteProperty(held.character, AIM_X_FIELD);
  held.character[AIM_X_FIELD] = held.gameAim;
}

export function holdAim(character: AimHolder): void {
  if (sweep.held?.character === character) return;
  releaseAim();
  const held: HeldAim = { character, gameAim: character[AIM_X_FIELD] };
  Object.defineProperty(character, AIM_X_FIELD, {
    configurable: true,
    enumerable: true,
    get: (): number => character.x + sweep.direction * sweep.range,
    set: (gameAim: unknown): void => { held.gameAim = gameAim; },
  });
  sweep.held = held;
}

export function setSweeping(active: boolean): void {
  sweep.active = active;
  sweep.direction = 1;
  if (!active) releaseAim();
}
