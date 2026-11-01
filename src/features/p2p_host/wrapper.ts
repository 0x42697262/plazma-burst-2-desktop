import { CONFIG_FILE_NAME, SETTINGS_FILE_NAME } from './keys.ts';
import { HOST_LOG } from './text.ts';
import { startDedicatedServer } from './adapters/host-window.ts';

export type { ServerPage, DedicatedHostDeps } from './adapters/host-window.ts';

export const p2pHostPart = Object.freeze({
  settingsFileName: SETTINGS_FILE_NAME,
  configFileName: CONFIG_FILE_NAME,
  flagOff: HOST_LOG.flagOff,
  start: startDedicatedServer,
});

export type P2pHostPart = typeof p2pHostPart;
