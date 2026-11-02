import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  swords: { capability: CAPABILITY.movement.swords, aliases: Object.freeze(['sword', 'melee']), type: SETTING_TYPE.bool, group: GROUP.player, desc: 'Your swords on/off (other characters unaffected)' },
});
