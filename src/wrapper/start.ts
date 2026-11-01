import path from 'node:path';
import { app } from 'electron';
import { CLIENTS } from '#kernel/config/clients.ts';
import { CLIENT, MODE } from '#shared/features/keys.ts';
import type { WrapperContext } from './context.ts';
import { WRAPPER_PARTS } from './features.ts';
import { startApp } from './app.ts';
import { WINDOW_ALL_CLOSED } from './keys.ts';

const keepRunningWhileTheGameIsPrepared = (): void => undefined;

export function start(context: WrapperContext): void {
  const { environment, flags, log } = context;
  const { remotePlayPart, gameSetupPart } = WRAPPER_PARTS;
  const client = CLIENTS[environment.client];
  if (environment.mode === MODE.remote && remotePlayPart) app.commandLine.appendSwitch(remotePlayPart.scaleFactorSwitch, remotePlayPart.scaleFactorOne);
  const isRefusedClient = client.id === CLIENT.sadburst && !flags.client_sadburst.on;
  const preparesGame = gameSetupPart !== undefined && flags.game_setup.on && !environment.gameDir && !isRefusedClient;
  app.on(WINDOW_ALL_CLOSED, keepRunningWhileTheGameIsPrepared);
  app.whenReady()
    .then(() => (preparesGame ? gameSetupPart.prepare({ client, gameDir: path.resolve(client.gameDir), checksForUpdates: app.isPackaged, log }) : true))
    .catch((error: unknown) => { log.error((error as Error).stack ?? String(error)); })
    .then(() => {
      startApp(context);
      app.off(WINDOW_ALL_CLOSED, keepRunningWhileTheGameIsPrepared);
    })
    .catch((error: unknown) => { log.error((error as Error).stack ?? String(error)); });
}
