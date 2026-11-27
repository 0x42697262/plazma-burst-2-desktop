import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { REPUTATION_PARTS } from './capabilities.ts';
import { COMMAND } from './keys.ts';

export const reputationConsole = consoleFeatureOf(FEATURE.reputation, REPUTATION_PARTS, {
  shells: [{ name: COMMAND.name, aliases: COMMAND.aliases, remote: false }],
});
