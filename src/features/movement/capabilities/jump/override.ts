import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { force, restore } from '#console/kernel/overrides/force.ts';
import { OVERRIDE_NAME } from '../../keys.ts';

function apply({ character }: OverrideContext): void {
  if (settings.has(KEY.JUMP)) force(character, GAME_FIELDS.JUMP, settings.get(KEY.JUMP));
  else restore(character, GAME_FIELDS.JUMP);
}

const nothingToUndo = (): void => undefined;

export const jumpOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.jump, capability: CAPABILITY.movement.jump, apply, cleanup: nothingToUndo });
