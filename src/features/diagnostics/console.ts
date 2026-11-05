import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { DIAGNOSTICS_PARTS } from './capabilities.ts';
import { COMMAND } from './keys.ts';

export const diagnosticsConsole = consoleFeatureOf(FEATURE.diagnostics, DIAGNOSTICS_PARTS, {
  shells: [{ name: COMMAND.name, aliases: COMMAND.aliases }],
});
