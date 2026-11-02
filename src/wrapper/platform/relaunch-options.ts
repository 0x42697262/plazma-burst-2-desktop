import type { ClientId } from '#shared/features/keys.ts';
import { argsForClient } from '#kernel/config/clients.ts';
import { ENV } from '#kernel/config/keys.ts';
import { FIRST_USER_ARGUMENT } from './constants.ts';

type Variables = Readonly<Record<string, string | undefined>>;

export type RelaunchOptions = Readonly<{ args: string[]; execPath?: string }>;

export function relaunchOptions(argv: readonly string[], variables: Variables, id: ClientId): RelaunchOptions {
  const args = argsForClient(argv.slice(FIRST_USER_ARGUMENT), id);
  const appImage = variables[ENV.appImage];
  return appImage ? Object.freeze({ args, execPath: appImage }) : Object.freeze({ args });
}
