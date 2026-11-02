import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  god: { capability: CAPABILITY.health.god, aliases: Object.freeze(['godmode']), type: SETTING_TYPE.bool, group: GROUP.player, desc: 'Ignore all damage' },
});
