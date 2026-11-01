import { FEATURE } from '#shared/features/keys.ts';
import type { CommandDefinition, ConsoleFeature } from '#console/feature-types.ts';
import { serverCommand, serverShortcuts } from '../../../desktop/dev/console/commands/server.js';
import { SERVER } from '../../../desktop/dev/console/core/server.js';
import { startHost } from '../../../desktop/dev/console/server/host.js';

const commands: readonly CommandDefinition[] = [serverCommand, ...(serverShortcuts as CommandDefinition[])];

export const p2pHostConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.p2pHost,
  commands,
  start: () => {
    if (SERVER) startHost();
  },
});
