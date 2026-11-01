import { FEATURE } from '#shared/features/keys.ts';
import type { CommandDefinition, ConsoleFeature } from '#console/feature-types.ts';
import { SERVER } from '#console/kernel/core/mode.ts';
import { serverCommand, serverShortcuts } from './entry/command.ts';
import { startHost } from './services/host.ts';

const commands: readonly CommandDefinition[] = [serverCommand, ...serverShortcuts];

export const p2pHostConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.p2pHost,
  commands,
  start: () => {
    if (SERVER) startHost();
  },
});
