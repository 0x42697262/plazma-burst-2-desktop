import { AIM_X_FIELD } from '../../keys.ts';

type AimHolder = Record<string, unknown> & { x: number };
type HeldAim = { character: AimHolder; gameAim: unknown };

export type SweepState = { active: boolean; direction: number; range: number; held: HeldAim | null };

export const sweep: SweepState = { active: false, direction: 1, range: 0, held: null };

export function releaseAim(): void {
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
