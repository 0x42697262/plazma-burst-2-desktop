import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  bullet_damage: { capability: CAPABILITY.guns.bullets, aliases: Object.freeze(['dmg', 'damage']), type: SETTING_TYPE.number, group: GROUP.bullets, min: 0, max: 1000, desc: 'Damage multiplier for your bullets', example: '5' },
  bullet_speed: { capability: CAPABILITY.guns.bullets, aliases: Object.freeze(['bspeed']), type: SETTING_TYPE.number, group: GROUP.bullets, min: 0.05, max: 20, desc: 'Speed multiplier for your bullets' },
  bullet_life: { capability: CAPABILITY.guns.bullets, aliases: Object.freeze(['range']), type: SETTING_TYPE.number, group: GROUP.bullets, min: 0.05, max: 50, desc: 'Lifetime/range multiplier for your bullets' },
  penetration: {
    capability: CAPABILITY.guns.bullets, aliases: Object.freeze(['pen', 'pierce']), type: SETTING_TYPE.number, group: GROUP.bullets, min: 0, max: 1, desc: 'Damage kept per hit: 0 = game default (30%), 1 = no loss',
    about: ['How much damage a bullet keeps after each hit it passes through.'], example: '1',
  },
});
