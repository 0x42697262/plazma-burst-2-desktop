import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  builtin: { capability: CAPABILITY.gameChat.builtin, type: SETTING_TYPE.bool, group: GROUP.console, desc: 'game <cmd>: on = silent, works on any map and in multiplayer; off = normal game chat' },
});
