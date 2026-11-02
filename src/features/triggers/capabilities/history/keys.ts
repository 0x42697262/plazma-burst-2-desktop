import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  trigger_history: {
    capability: CAPABILITY.triggers.history, type: SETTING_TYPE.bool, group: GROUP.console, default: true, desc: 'Record trigger runs for "triggers history"',
    about: ['Turns the recording for "triggers history" on and off.'],
  },
});

export const COMMAND = Object.freeze({ name: 'history', aliases: Object.freeze(['hist', 'log']) });
