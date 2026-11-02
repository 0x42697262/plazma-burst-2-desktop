import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { SERVER } from '#console/kernel/core/mode.ts';
import { SERVER_COMMAND } from './keys.ts';
import { P2P_HOST_PARTS } from './capabilities.ts';
import { startHost } from './services/host.ts';

export const p2pHostConsole = consoleFeatureOf(FEATURE.p2pHost, P2P_HOST_PARTS, {
  shells: [{ name: SERVER_COMMAND.name, server: true }],
  start: () => {
    if (SERVER) startHost();
  },
});
