import { z } from 'zod';
import { OTHER_CLIENT_LIST, type ClientDetails } from '#shared/clients/keys.ts';
import { CLIENT, FEATURE, MODE, type ClientId, type Mode } from '#shared/features/keys.ts';
import type { FeatureToggle } from '#shared/features/types.ts';
import { DEFAULT_LOG_FORMAT, LOG_FORMATS, type LogFormat, type LogLevel } from '#kernel/log/constants.ts';
import { DISABLED_VALUE, FALSE_VALUE, FEATURE_ON_SIGN, FEATURE_TOGGLE_LIST, FEATURE_TOGGLE_SEPARATOR, SIGN_LENGTH } from './constants.ts';
import { ARG, ENV } from './keys.ts';
import { parseLogLevel, type EnvironmentVariables } from './log-level.ts';
import { TEXT } from './text.ts';

export type Credentials = Readonly<{ login?: string; password?: string; pb2uid?: string }>;

export type Environment = Readonly<{
  client: ClientId;
  mode: Mode;
  gameDir: string | null;
  gameVersion: string | null;
  logLevel: LogLevel;
  logFormat: LogFormat;
  featureToggles: readonly FeatureToggle[];
  credentials: Credentials;
  diagnosticsUrl: string | null;
  diagnosticsKey: string | null;
  listFeatures: boolean;
  args: readonly string[];
}>;

export type EnvironmentResult = Readonly<{ environment: Environment; problems: readonly string[] }>;

const optionalText = z.string().optional();
const environmentSchema = z.object({
  [ENV.gameDir]: optionalText,
  [ENV.gameVersion]: optionalText,
  [ENV.devConsole]: optionalText,
  [ENV.hooks]: optionalText,
  [ENV.features]: optionalText,
  [ENV.logFormat]: optionalText,
  [ENV.login]: optionalText,
  [ENV.password]: optionalText,
  [ENV.uid]: optionalText,
  [ENV.diagnosticsUrl]: optionalText,
  [ENV.diagnosticsKey]: optionalText,
});

const isLogFormat = (value: string): value is LogFormat => (LOG_FORMATS as readonly string[]).includes(value);

type AskedClients = Readonly<{ fromFlags: readonly ClientDetails[]; fromNpm: readonly ClientDetails[] }>;

function askedClients(argv: readonly string[], variables: EnvironmentVariables): AskedClients {
  const isAskedByNpm = (details: ClientDetails): boolean => {
    const fromNpm = variables[details.npmVariable];
    return fromNpm !== undefined && fromNpm !== FALSE_VALUE && fromNpm !== DISABLED_VALUE;
  };
  return { fromFlags: OTHER_CLIENT_LIST.filter((details) => argv.includes(details.flag)), fromNpm: OTHER_CLIENT_LIST.filter(isAskedByNpm) };
}

const strongestAsk = ({ fromFlags, fromNpm }: AskedClients): readonly ClientDetails[] => (fromFlags.length ? fromFlags : fromNpm);

export function clientOf(argv: readonly string[], variables: EnvironmentVariables): ClientId {
  return strongestAsk(askedClients(argv, variables))[0]?.id ?? CLIENT.official;
}

function clientProblem(argv: readonly string[], variables: EnvironmentVariables): string | null {
  const asked = strongestAsk(askedClients(argv, variables));
  return asked.length > 1 ? TEXT.severalClients(asked.map((details) => details.flag)) : null;
}

function modeOf(argv: readonly string[]): Mode {
  if (argv.includes(ARG.remoteHost)) return MODE.remote;
  if (argv.includes(ARG.p2pHost)) return MODE.server;
  return MODE.local;
}

function featureTogglesOf(list: string | undefined, devConsole: string | undefined, hooks: string | undefined, problems: string[]): FeatureToggle[] {
  const toggles: FeatureToggle[] = [];
  if (devConsole === DISABLED_VALUE) toggles.push({ id: FEATURE.devConsole, on: false });
  if (hooks === DISABLED_VALUE) toggles.push({ id: FEATURE.hooks, on: false });
  if (!list) return toggles;
  if (!FEATURE_TOGGLE_LIST.test(list)) {
    problems.push(TEXT.badFeatureList(list));
    return toggles;
  }
  for (const item of list.split(FEATURE_TOGGLE_SEPARATOR)) toggles.push({ id: item.slice(SIGN_LENGTH), on: item.startsWith(FEATURE_ON_SIGN) });
  return toggles;
}

function logFormatOf(argv: readonly string[], fromEnv: string | undefined, problems: string[]): LogFormat {
  const fromArgs = argv.find((argument) => argument.startsWith(ARG.logFormatPrefix))?.slice(ARG.logFormatPrefix.length);
  const asked = fromArgs ?? fromEnv;
  if (asked === undefined) return DEFAULT_LOG_FORMAT;
  if (isLogFormat(asked)) return asked;
  problems.push(TEXT.unknownLogFormat(asked));
  return DEFAULT_LOG_FORMAT;
}

const nonEmpty = (value: string | undefined): string | null => (value ? value : null);

function credentialsOf(variables: z.infer<typeof environmentSchema>): Credentials {
  const pairs: [keyof Credentials, string | undefined][] = [['login', variables[ENV.login]], ['password', variables[ENV.password]], ['pb2uid', variables[ENV.uid]]];
  return Object.freeze(Object.fromEntries(pairs.filter(([, value]) => value)));
}

export function parseEnvironment(argv: readonly string[], env: EnvironmentVariables): EnvironmentResult {
  const problems: string[] = [];
  const variables = environmentSchema.parse(env);
  const logLevel = parseLogLevel(argv, env);
  if (logLevel.problem) problems.push(logLevel.problem);
  const severalClients = clientProblem(argv, env);
  if (severalClients) problems.push(severalClients);
  const environment: Environment = Object.freeze({
    client: clientOf(argv, env),
    mode: modeOf(argv),
    gameDir: nonEmpty(variables[ENV.gameDir]),
    gameVersion: nonEmpty(variables[ENV.gameVersion]),
    logLevel: logLevel.level,
    logFormat: logFormatOf(argv, variables[ENV.logFormat], problems),
    featureToggles: Object.freeze(featureTogglesOf(variables[ENV.features], variables[ENV.devConsole], variables[ENV.hooks], problems)),
    credentials: credentialsOf(variables),
    diagnosticsUrl: nonEmpty(variables[ENV.diagnosticsUrl]),
    diagnosticsKey: nonEmpty(variables[ENV.diagnosticsKey]),
    listFeatures: argv.includes(ARG.listFeatures),
    args: Object.freeze([...argv]),
  });
  return Object.freeze({ environment, problems: Object.freeze(problems) });
}
