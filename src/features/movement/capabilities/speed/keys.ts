import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  speed: { capability: CAPABILITY.movement.speed, type: SETTING_TYPE.number, group: GROUP.player, min: 0.1, max: 10, desc: 'Run speed multiplier, 1 = normal', example: '1.8' },
});
