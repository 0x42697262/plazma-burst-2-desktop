import type { FrameOverride } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { SETTING } from '#features/movement/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { OVERRIDE_NAME } from '../../keys.ts';

let originalGravity: unknown = null;

function cleanup(): void {
  if (originalGravity === null) return;
  game.setGravity(originalGravity);
  originalGravity = null;
}

function apply(): void {
  if (!settings.has(SETTING.worldGravity)) {
    cleanup();
    return;
  }
  if (originalGravity === null) originalGravity = game.getGravity();
  if (game.getGravity() !== settings.get(SETTING.worldGravity)) game.setGravity(settings.get(SETTING.worldGravity));
}

export const worldGravityOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.worldGravity, capability: CAPABILITY.movement.worldGravity, apply, cleanup });
