import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { AIR_TOP_SPEED, AIR_WALK, STAND_WALK_BASE, STAND_WALK_SCALE, STAND_WALK_SIT_FACTOR } from '../../constants.ts';
import { OVERRIDE_NAME } from '../../keys.ts';
import { isAlive } from '../../services/character.ts';

const standWalk = (sit: number): number => (STAND_WALK_BASE - sit * STAND_WALK_SIT_FACTOR) * STAND_WALK_SCALE;

function apply({ character, running, tick }: OverrideContext): void {
  if (!settings.has(KEY.SPEED) || !running || !isAlive(character)) return;
  const speed = settings.get(KEY.SPEED) as number;
  const walk = character[GAME_FIELDS.WALK] as number;
  if (!walk) return;
  if (character.stand) character.tox += walk * standWalk(character.sit) * tick * (speed - 1);
  else if (speed > 1 && character.tox * Math.sign(walk) < AIR_TOP_SPEED * speed) character.tox += walk * AIR_WALK * tick * (speed - 1);
}

const nothingToUndo = (): void => undefined;

export const speedOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.speed, capability: CAPABILITY.movement.speed, apply, cleanup: nothingToUndo });
