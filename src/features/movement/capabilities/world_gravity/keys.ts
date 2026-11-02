import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  world_gravity: {
    capability: CAPABILITY.movement.worldGravity, aliases: Object.freeze(['wgrav']), type: SETTING_TYPE.number, group: GROUP.world, min: -5, max: 5, desc: 'Gravity for everything (map default is usually 0.5)',
    about: ['Applies to everything, not just you. Most maps use 0.5.'], example: '0.2',
  },
});
