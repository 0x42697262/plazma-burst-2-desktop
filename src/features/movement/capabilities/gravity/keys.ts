import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  gravity: { capability: CAPABILITY.movement.gravity, aliases: Object.freeze(['grav']), type: SETTING_TYPE.bool, group: GROUP.player, desc: 'Player gravity on/off' },
});
