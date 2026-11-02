import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { force, original, restore, restoreObj } from '#console/kernel/overrides/force.ts';
import { NO_WEAPON } from '../../constants.ts';
import { OVERRIDE_NAME } from '../../keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

const isSet = (key: string): boolean => settings.has(key);
const valueOf = (key: string): unknown => settings.get(key);
const numberOf = (key: string): number => valueOf(key) as number;

const forcedGuns = new Set<object>();

function forceMultiplied(target: Record<string, unknown>, field: string, key: string): void {
  if (isSet(key)) force(target, field, (original(target, field) as number) * numberOf(key));
  else restore(target, field);
}

function apply({ character }: OverrideContext): void {
  const guns = game.guns();
  const held = character.curwea >= NO_WEAPON && guns ? guns[character.curwea] ?? null : null;
  for (const gun of [...forcedGuns]) {
    if (gun !== held) {
      restoreObj(gun);
      forcedGuns.delete(gun);
    }
  }
  if (!held || typeof held !== 'object') return;
  forcedGuns.add(held);
  forceMultiplied(held, GAME_FIELDS.G_RATE, KEY.FIRE_RATE);
  if (isSet(KEY.PELLETS)) force(held, GAME_FIELDS.G_PELLETS, valueOf(KEY.PELLETS));
  else restore(held, GAME_FIELDS.G_PELLETS);
  forceMultiplied(held, GAME_FIELDS.G_SPREAD, KEY.SPREAD);
  if (isSet(KEY.SPREAD) && valueOf(KEY.SPREAD) === 0) held[GAME_FIELDS.G_BLOOM] = 0;
  forceMultiplied(held, GAME_FIELDS.G_RECOIL, KEY.RECOIL);
}

export const gunOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.gun, capability: CAPABILITY.guns.gun, apply, cleanup: () => { forcedGuns.clear(); } });
