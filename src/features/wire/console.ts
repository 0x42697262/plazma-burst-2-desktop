import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { WIRE_PARTS } from './capabilities.ts';
import { COMMAND } from './keys.ts';

export const wireConsole = consoleFeatureOf(FEATURE.wire, WIRE_PARTS, {
  shells: [{ name: COMMAND.name, aliases: COMMAND.aliases }],
});
