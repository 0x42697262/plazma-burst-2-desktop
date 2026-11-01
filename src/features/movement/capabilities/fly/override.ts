import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { FLY_DAMPING } from '../../constants.ts';
import { OVERRIDE_NAME } from '../../keys.ts';
import { isAlive } from '../../services/character.ts';

function apply({ character, running, tick }: OverrideContext): void {
  if (settings.get(KEY.FLY) !== true || !running || !isAlive(character)) return;
  const isGravityAlreadyOff = settings.get(KEY.GRAVITY) === false;
  if (!character.stand && !isGravityAlreadyOff) character.toy -= (game.getGravity() as number) * tick;
  const flySpeed = settings.effective(KEY.FLY_SPEED) as number;
  if (game.keyUp()) character.toy = -flySpeed;
  else if (game.keyDown()) character.toy = flySpeed;
  else character.toy *= FLY_DAMPING;
}

const nothingToUndo = (): void => undefined;

export const flyOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.fly, capability: CAPABILITY.movement.fly, apply, cleanup: nothingToUndo });
