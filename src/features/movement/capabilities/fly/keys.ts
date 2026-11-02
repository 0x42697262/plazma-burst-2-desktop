import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  fly: {
    capability: CAPABILITY.movement.fly, type: SETTING_TYPE.bool, group: GROUP.player, desc: 'Fly with jump/crouch keys (turns gravity off)',
    about: ['Fly with the jump and crouch keys. Turns gravity off while it is on.'],
  },
  fly_speed: { capability: CAPABILITY.movement.fly, type: SETTING_TYPE.number, group: GROUP.player, min: 0.5, max: 50, default: 6, desc: 'Vertical fly speed', example: '10' },
});
