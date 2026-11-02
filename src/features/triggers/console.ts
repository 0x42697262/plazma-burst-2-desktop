import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { TRIGGERS_PARTS } from './capabilities.ts';
import { syncTriggerHooks } from './run-log.ts';
import { FRAME_HOOK_NAME } from './keys.ts';
import { LOGIC_COMMAND, REGIONS_COMMAND, TRIGGERS_COMMAND, VARS_COMMAND } from './entry/keys.ts';

export const triggersConsole = consoleFeatureOf(FEATURE.triggers, TRIGGERS_PARTS, {
  shells: [TRIGGERS_COMMAND, REGIONS_COMMAND, VARS_COMMAND, LOGIC_COMMAND].map((command) => ({ name: command.name, aliases: command.aliases })),
  frame: [{ name: FRAME_HOOK_NAME, run: () => { syncTriggerHooks(); } }],
});
