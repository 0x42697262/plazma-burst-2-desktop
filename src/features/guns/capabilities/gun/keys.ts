import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  fire_rate: { capability: CAPABILITY.guns.gun, aliases: Object.freeze(['rate', 'firerate']), type: SETTING_TYPE.number, group: GROUP.gun, min: 0.05, max: 20, desc: 'Fire-rate multiplier for held gun' },
  pellets: { capability: CAPABILITY.guns.gun, type: SETTING_TYPE.int, group: GROUP.gun, min: 1, max: 50, desc: 'Projectiles per shot for held gun' },
  spread: {
    capability: CAPABILITY.guns.gun, aliases: Object.freeze(['accuracy']), type: SETTING_TYPE.number, group: GROUP.gun, min: 0, max: 10, desc: 'Spread multiplier, 0 = perfectly accurate',
    about: ['0 makes the held gun perfectly accurate.'], example: '0',
  },
  recoil: { capability: CAPABILITY.guns.gun, type: SETTING_TYPE.number, group: GROUP.gun, min: 0, max: 10, desc: 'Recoil multiplier for held gun' },
});
