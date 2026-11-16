import { app } from 'electron';
import type { ClientId } from '#shared/features/keys.ts';
import { OTHER_CLIENT_LIST } from '#shared/clients/keys.ts';
import { relaunchOptions } from './relaunch-options.ts';

export function relaunchAs(id: ClientId): void {
  for (const details of OTHER_CLIENT_LIST) Reflect.deleteProperty(process.env, details.npmVariable);
  app.relaunch(relaunchOptions(process.argv, process.env, id));
  app.exit();
}
