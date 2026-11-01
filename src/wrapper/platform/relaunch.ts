import { app } from 'electron';
import type { ClientId } from '#shared/features/keys.ts';
import { argsForClient } from '#kernel/config/clients.ts';
import { ENV } from '#kernel/config/keys.ts';
import { FIRST_USER_ARGUMENT } from './constants.ts';

export function relaunchAs(id: ClientId): void {
  Reflect.deleteProperty(process.env, ENV.npmSadburst);
  app.relaunch({ args: argsForClient(process.argv.slice(FIRST_USER_ARGUMENT), id) });
  app.exit();
}
