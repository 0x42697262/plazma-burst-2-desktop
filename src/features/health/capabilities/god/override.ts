import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import type { Character } from '#console/kernel/game/types.ts';
import { SETTING } from '#features/health/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { OVERRIDE_NAME } from '../../keys.ts';
import { clampToMax, healthOf, isOverRankedLimit } from '../../services/character.ts';
import { installGod, uninstallGodExcept, uninstallAllGod } from './god.ts';

const isGodOn = (): boolean => !!settings.get(SETTING.god);

function applyGod(character: Character): void {
  uninstallGodExcept(isGodOn() ? character : null);
  if (!isGodOn()) return;
  installGod(character, isGodOn);
  if (character[GAME_FIELDS.DEAD] && healthOf(character) > 0) character[GAME_FIELDS.DEAD] = false;
}

function apply({ character }: OverrideContext): void {
  applyGod(character);
  if (!isOverRankedLimit(character)) return;
  uninstallGodExcept(null);
  clampToMax(character);
}

export const godOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.god, capability: CAPABILITY.health.god, apply, cleanup: uninstallAllGod });
