import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  jump: { capability: CAPABILITY.movement.jump, aliases: Object.freeze(['jumps']), type: SETTING_TYPE.number, group: GROUP.player, min: 0, max: 20, desc: 'Jump strength multiplier, 1 = normal', example: '2' },
});
