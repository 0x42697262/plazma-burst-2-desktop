import type { FrameOverride } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { OVERRIDE_NAME } from '../../keys.ts';

let originalGravity: unknown = null;

function cleanup(): void {
  if (originalGravity === null) return;
  game.setGravity(originalGravity);
  originalGravity = null;
}

function apply(): void {
  if (!settings.has(KEY.WORLD_GRAVITY)) {
    cleanup();
    return;
  }
  if (originalGravity === null) originalGravity = game.getGravity();
  if (game.getGravity() !== settings.get(KEY.WORLD_GRAVITY)) game.setGravity(settings.get(KEY.WORLD_GRAVITY));
}

export const worldGravityOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.worldGravity, capability: CAPABILITY.movement.worldGravity, apply, cleanup });
