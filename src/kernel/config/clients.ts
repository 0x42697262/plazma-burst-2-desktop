import { CLIENT, type ClientId } from '#shared/features/keys.ts';
import { CLIENT_DETAILS, CLIENT_FLAGS, type ClientDetails } from '#shared/clients/keys.ts';
import { clientOf } from './environment.ts';
import { CLIENT_PATHS } from './paths.ts';

export type GameClient = ClientDetails & Readonly<{ gameDir: string; names: string; opcodes: string }>;

export const CLIENTS: Readonly<Record<ClientId, GameClient>> = Object.freeze({
  [CLIENT.official]: Object.freeze({ ...CLIENT_DETAILS[CLIENT.official], ...CLIENT_PATHS[CLIENT.official] }),
  [CLIENT.sadburst]: Object.freeze({ ...CLIENT_DETAILS[CLIENT.sadburst], ...CLIENT_PATHS[CLIENT.sadburst] }),
  [CLIENT.sadburstErich5]: Object.freeze({ ...CLIENT_DETAILS[CLIENT.sadburstErich5], ...CLIENT_PATHS[CLIENT.sadburstErich5] }),
});

type Variables = Readonly<Record<string, string | undefined>>;

export const wantsSadburst = (argv: readonly string[] = process.argv, variables: Variables = process.env): boolean =>
  clientOf(argv, variables) === CLIENT.sadburst;

export const clientFor = (argv: readonly string[] = process.argv, variables: Variables = process.env): GameClient =>
  CLIENTS[clientOf(argv, variables)];

export const withoutClientFlag = (args: readonly string[]): string[] => args.filter((arg) => !CLIENT_FLAGS.includes(arg));

export const argsForClient = (args: readonly string[], id: ClientId): string[] => {
  const flag = CLIENT_DETAILS[id].flag;
  return flag ? [...withoutClientFlag(args), flag] : withoutClientFlag(args);
};
