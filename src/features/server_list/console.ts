import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { COMMAND, MASKED_PASSWORD_REPLACEMENT, PASSWORD_IN_LINE } from './keys.ts';
import { SERVER_LIST_PARTS } from './capabilities.ts';

export const serverListConsole = consoleFeatureOf(FEATURE.serverList, SERVER_LIST_PARTS, {
  shells: [{ name: COMMAND.name, aliases: COMMAND.aliases, remote: false, mask: (line: string): string => line.replace(PASSWORD_IN_LINE, MASKED_PASSWORD_REPLACEMENT) }],
});
