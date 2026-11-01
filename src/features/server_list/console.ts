import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { serversCommand } from './entry/command.ts';

export const serverListConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.serverList,
  commands: [serversCommand],
});
