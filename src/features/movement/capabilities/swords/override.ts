import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { force, restore } from '#console/kernel/overrides/force.ts';
import { OVERRIDE_NAME } from '../../keys.ts';

function apply({ character }: OverrideContext): void {
  if (settings.has(KEY.SWORDS)) {
    const swordsOff = !settings.get(KEY.SWORDS);
    if (character[GAME_FIELDS.NO_SWORDS] !== swordsOff) {
      force(character, GAME_FIELDS.NO_SWORDS, swordsOff);
      game.refreshChar(game.me());
    }
  } else if (restore(character, GAME_FIELDS.NO_SWORDS)) {
    game.refreshChar(game.me());
  }
}

const nothingToUndo = (): void => undefined;

export const swordsOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.swords, capability: CAPABILITY.movement.swords, apply, cleanup: nothingToUndo });
