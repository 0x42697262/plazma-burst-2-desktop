import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { NETWORK_SAVE_PARTS } from './capabilities.ts';
import { COMMAND } from './keys.ts';

export const networkSaveConsole = consoleFeatureOf(FEATURE.networkSave, NETWORK_SAVE_PARTS, {
  shells: [{ name: COMMAND.name, aliases: COMMAND.aliases, remote: false }],
});
