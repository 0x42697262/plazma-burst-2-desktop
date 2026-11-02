import { app } from 'electron';
import type { ClientId } from '#shared/features/keys.ts';
import { ENV } from '#kernel/config/keys.ts';
import { relaunchOptions } from './relaunch-options.ts';

export function relaunchAs(id: ClientId): void {
  Reflect.deleteProperty(process.env, ENV.npmSadburst);
  app.relaunch(relaunchOptions(process.argv, process.env, id));
  app.exit();
}
