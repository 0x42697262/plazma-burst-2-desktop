import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { SETTING } from '#features/movement/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { OVERRIDE_NAME } from '../../keys.ts';
import { isAlive } from '../../services/character.ts';

function apply({ character, running, tick }: OverrideContext): void {
  const isGravityOff = settings.get(SETTING.gravity) === false;
  if (isGravityOff && running && isAlive(character) && !character.stand) character.toy -= (game.getGravity() as number) * tick;
}

const nothingToUndo = (): void => undefined;

export const gravityOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.gravity, capability: CAPABILITY.movement.gravity, apply, cleanup: nothingToUndo });
