import { CLIENT, type ClientId } from '#shared/features/keys.ts';
import { CLIENT_DETAILS, SADBURST_FLAG, type ClientDetails } from '#shared/clients/keys.ts';
import { clientOf } from './environment.ts';
import { ENV } from './keys.ts';
import { CLIENT_PATHS } from './paths.ts';

export type GameClient = ClientDetails & Readonly<{ gameDir: string; names: string; opcodes: string }>;

export const CLIENTS: Readonly<Record<ClientId, GameClient>> = Object.freeze({
  [CLIENT.official]: Object.freeze({ ...CLIENT_DETAILS.official, ...CLIENT_PATHS.official }),
  [CLIENT.sadburst]: Object.freeze({ ...CLIENT_DETAILS.sadburst, ...CLIENT_PATHS.sadburst }),
});

export const FLAG = SADBURST_FLAG;

type Variables = Readonly<Record<string, string | undefined>>;

export const wantsSadburst = (argv: readonly string[] = process.argv, variables: Variables = process.env): boolean =>
  clientOf(argv, variables[ENV.npmSadburst]) === CLIENT.sadburst;

export const clientFor = (argv: readonly string[] = process.argv, variables: Variables = process.env): GameClient =>
  CLIENTS[clientOf(argv, variables[ENV.npmSadburst])];

export const withoutClientFlag = (args: readonly string[]): string[] => args.filter((arg) => arg !== SADBURST_FLAG);
